/**
 * @file src/main/ipc/__tests__/rules.ipc.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the rules IPC handlers. Electron's `ipcMain`
 * is mocked so the test environment stays in plain Node.js. Handlers are
 * extracted and invoked directly, while `getDatabase` is replaced with an
 * in-memory SQLite database to avoid filesystem side effects.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { RulesRepo } from '@main/db/rules.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { createTestDb } from '@main/db/__tests__/helpers'

// ─── Electron mock ────────────────────────────────────────────────────────────

/** Captured handler map: channel name → handler function. */
const handlers: Record<string, (...args: unknown[]) => unknown> = {}

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers[channel] = fn
    },
  },
}))

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@main/clients/registry', () => ({
  ADAPTER_IDS: [],
  ADAPTERS: new Map(),
}))

// ─── DB mock ──────────────────────────────────────────────────────────────────

let testDb: Database.Database

vi.mock('@main/db/connection', () => ({
  getDatabase: () => testDb,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calls a registered IPC handler by channel name, simulating what
 * `ipcMain.handle` does when the renderer invokes the channel.
 */
const call = <T>(channel: string, ...args: unknown[]): T => {
  const handler = handlers[channel]
  if (!handler) throw new Error(`Handler not registered for channel: ${channel}`)
  return handler(undefined, ...args) as T
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('rules IPC handlers', () => {
  let rulesRepo: RulesRepo
  let logRepo: ActivityLogRepo
  let tempProjectDir: string

  beforeEach(async () => {
    testDb = createTestDb()
    rulesRepo = new RulesRepo(testDb)
    logRepo = new ActivityLogRepo(testDb)
    tempProjectDir = mkdtempSync(join(tmpdir(), 'aidrelay-rules-ipc-'))

    vi.resetModules()
    const { registerRulesIpc } = await import('../rules.ipc')
    registerRulesIpc()
  })

  afterEach(() => {
    if (tempProjectDir) {
      rmSync(tempProjectDir, { recursive: true, force: true })
    }
    testDb?.close()
  })

  // ─── rules:list ───────────────────────────────────────────────────────────

  it('rules:list returns empty array when no rules exist', () => {
    const result = call<unknown[]>('rules:list')
    expect(result).toEqual([])
  })

  it('rules:list returns all rules after creation', () => {
    rulesRepo.create({ name: 'alpha-rule', content: 'Use TypeScript strict mode.' })
    rulesRepo.create({ name: 'beta-rule', content: 'Always write tests.' })

    const result = call<{ name: string }[]>('rules:list')
    expect(result).toHaveLength(2)
  })

  // ─── rules:get ────────────────────────────────────────────────────────────

  it('rules:get returns null for unknown id', () => {
    expect(call('rules:get', 'does-not-exist')).toBeNull()
  })

  it('rules:get returns the correct rule', () => {
    const rule = rulesRepo.create({ name: 'get-test', content: 'Some content.' })
    const result = call<{ id: string; name: string }>('rules:get', rule.id)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('get-test')
  })

  // ─── rules:create ─────────────────────────────────────────────────────────

  it('rules:create persists the rule and logs the action', () => {
    const result = call<{ id: string; name: string; tokenEstimate: number }>('rules:create', {
      name: 'created-via-ipc',
      content: 'Always use arrow functions.',
    })

    expect(result.name).toBe('created-via-ipc')
    expect(rulesRepo.findById(result.id)).not.toBeNull()

    const logs = logRepo.query({ action: 'rule.created' })
    expect(logs).toHaveLength(1)
    expect(logs[0]?.details).toMatchObject({ ruleName: 'created-via-ipc' })
  })

  it('rules:create calculates and persists a non-zero token estimate', () => {
    const result = call<{ tokenEstimate: number }>('rules:create', {
      name: 'token-test',
      content: 'Always use arrow functions for readability.',
    })

    // 7 words * 1.3 = 9.1 → ceil = 10
    expect(result.tokenEstimate).toBeGreaterThan(0)
  })

  // ─── rules:update ─────────────────────────────────────────────────────────

  it('rules:update applies changes and logs the action', () => {
    const rule = rulesRepo.create({ name: 'to-update', content: 'Original.' })
    const result = call<{ content: string }>('rules:update', rule.id, {
      content: 'Updated content.',
    })

    expect(result.content).toBe('Updated content.')

    const logs = logRepo.query({ action: 'rule.updated' })
    expect(logs).toHaveLength(1)
  })

  it('rules:update recalculates token estimate when content changes', () => {
    const rule = rulesRepo.create({ name: 'estimate-update', content: 'Short.' })
    const before = rulesRepo.findById(rule.id)!.tokenEstimate

    const result = call<{ tokenEstimate: number }>('rules:update', rule.id, {
      content: 'A much longer rule with many more words to push the token estimate higher.',
    })

    expect(result.tokenEstimate).toBeGreaterThan(before)
  })

  it('rules:update can toggle enabled flag', () => {
    const rule = rulesRepo.create({ name: 'enable-test', content: 'Some rule.' })
    const result = call<{ enabled: boolean }>('rules:update', rule.id, { enabled: false })

    expect(result.enabled).toBe(false)
  })

  it('rules:update merges clientOverrides without wiping existing entries', () => {
    const rule = rulesRepo.create({ name: 'override-test', content: 'Test.' })

    call('rules:update', rule.id, {
      clientOverrides: { cursor: { enabled: false } },
    })

    const result = call<{
      clientOverrides: Record<string, { enabled: boolean }>
    }>('rules:update', rule.id, {
      clientOverrides: { vscode: { enabled: false } },
    })

    expect(result.clientOverrides['cursor']).toEqual({ enabled: false })
    expect(result.clientOverrides['vscode']).toEqual({ enabled: false })
  })

  // ─── rules:delete ─────────────────────────────────────────────────────────

  it('rules:delete removes the rule and logs the action', () => {
    const rule = rulesRepo.create({ name: 'to-delete', content: 'Delete me.' })
    call('rules:delete', rule.id)

    expect(rulesRepo.findById(rule.id)).toBeNull()

    const logs = logRepo.query({ action: 'rule.deleted' })
    expect(logs).toHaveLength(1)
  })

  // ─── rules:estimate-tokens ────────────────────────────────────────────────

  it('rules:estimate-tokens returns a positive integer for non-empty content', () => {
    const result = call<number>('rules:estimate-tokens', 'Use TypeScript strict mode always.')
    // 5 words * 1.3 = 6.5 → ceil = 7
    expect(result).toBe(7)
  })

  it('rules:estimate-tokens returns 0 for empty content', () => {
    const result = call<number>('rules:estimate-tokens', '')
    expect(result).toBe(0)
  })

  it('rules:estimate-tokens returns 0 for whitespace-only content', () => {
    const result = call<number>('rules:estimate-tokens', '   \n\t  ')
    expect(result).toBe(0)
  })

  // ─── stub channels ────────────────────────────────────────────────────────

  it('rules:sync succeeds with an empty rule set', () => {
    const result = call<{ success: boolean; serversWritten: number }>('rules:sync', 'cursor')
    expect(result.success).toBe(true)
    expect(result.serversWritten).toBe(0)
  })

  it('rules:sync-all returns an array of sync results', async () => {
    // Registry is mocked with no adapters so the result is always an empty array.
    const result = await call<Promise<unknown[]>>('rules:sync-all')
    expect(result).toEqual([])
  })

  it('rules:import-from-project returns zero imports for a non-existent path', () => {
    const result = call<{ imported: number; skipped: number; errors: readonly string[] }>(
      'rules:import-from-project',
      '/non/existent/path',
    )
    expect(result.imported).toBe(0)
  })

  it('rules:import-from-project imports CLAUDE.md with a non-zero token estimate', () => {
    writeFileSync(join(tempProjectDir, 'CLAUDE.md'), 'Always use strict TypeScript settings.')

    const imported = call<{ imported: number; skipped: number; errors: readonly string[] }>(
      'rules:import-from-project',
      tempProjectDir,
    )
    expect(imported.imported).toBe(1)
    expect(imported.errors).toHaveLength(0)

    const rules = call<
      Array<{
        name: string
        tokenEstimate: number
      }>
    >('rules:list')
    const claudeRule = rules.find((r) => r.name === 'CLAUDE')
    expect(claudeRule).toBeDefined()
    expect(claudeRule?.tokenEstimate).toBeGreaterThan(0)
  })

  it('rules:detect-workspaces returns an empty array (stub)', () => {
    const result = call<unknown[]>('rules:detect-workspaces')
    expect(result).toEqual([])
  })
})
