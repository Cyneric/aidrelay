/**
 * @file src/main/ipc/__tests__/stacks.ipc.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for stacks IPC handlers. DB repos and feature gates
 * are backed by an in-memory SQLite database so tests verify real persistence
 * behavior without touching the filesystem.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestDb } from '@main/db/__tests__/helpers'
import { getDatabase } from '@main/db/connection'
import type { McpStack } from '@shared/channels'

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}))

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@main/db/connection', () => ({ getDatabase: vi.fn() }))

vi.mock('@main/licensing/feature-gates', () => ({
  checkGate: vi.fn().mockImplementation((key: string) => {
    if (key === 'stackExport') return true
    return true
  }),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { ipcMain } from 'electron'
import { checkGate } from '@main/licensing/feature-gates'
import { registerStacksIpc } from '../stacks.ipc'

type IpcHandler = (_event: unknown, ...args: unknown[]) => unknown

const getHandler = (channel: string): IpcHandler => {
  const calls = vi.mocked(ipcMain.handle).mock.calls
  const call = calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`No handler registered for "${channel}"`)
  return call[1] as IpcHandler
}

const makeStack = (overrides: Partial<McpStack> = {}): string =>
  JSON.stringify({
    name: 'My Stack',
    description: '',
    version: '1.0.0',
    servers: [
      {
        name: 'test-server',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@test/mcp'],
        env: {},
        enabled: true,
        tags: [],
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    rules: [
      {
        name: 'test-rule',
        description: '',
        content: '# Test rule',
        category: 'general',
        tags: [],
        enabled: true,
        priority: 'normal',
        scope: 'global',
        fileGlobs: [],
        alwaysApply: false,
        tokenEstimate: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    exportedAt: new Date().toISOString(),
    ...overrides,
  } satisfies McpStack)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('stacks IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const db = createTestDb()
    vi.mocked(getDatabase).mockReturnValue(db)
    vi.mocked(checkGate).mockImplementation((key: string) => {
      if (key === 'stackExport') return true
      if (key === 'maxServers') return Infinity
      return true
    })
    registerStacksIpc()
  })

  describe('stacks:export', () => {
    it('returns a JSON string with the correct structure', async () => {
      const handler = getHandler('stacks:export')
      // No servers/rules seeded — exporting empty selection is valid.
      const json = (await handler(null, [], [], 'Empty Stack')) as string

      const stack = JSON.parse(json) as McpStack
      expect(stack.name).toBe('Empty Stack')
      expect(stack.version).toBe('1.0.0')
      expect(stack.servers).toEqual([])
      expect(stack.rules).toEqual([])
      expect(typeof stack.exportedAt).toBe('string')
    })

    it('throws when the stackExport gate is false', async () => {
      vi.mocked(checkGate).mockReturnValue(false)

      const handler = getHandler('stacks:export')
      await expect(handler(null, [], [], 'Stack')).rejects.toThrow('Pro')
    })
  })

  describe('stacks:import', () => {
    it('imports servers and rules from a valid stack JSON', async () => {
      const handler = getHandler('stacks:import')
      const result = (await handler(null, makeStack())) as {
        imported: number
        skipped: number
        errors: string[]
      }

      expect(result.imported).toBe(2) // 1 server + 1 rule
      expect(result.skipped).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('skips duplicate server names on second import', async () => {
      const handler = getHandler('stacks:import')
      await handler(null, makeStack())
      const result = (await handler(null, makeStack())) as { imported: number; skipped: number }

      expect(result.skipped).toBe(2)
      expect(result.imported).toBe(0)
    })

    it('returns an error for invalid JSON', async () => {
      const handler = getHandler('stacks:import')
      const result = (await handler(null, 'not-json')) as { imported: number; errors: string[] }

      expect(result.imported).toBe(0)
      expect(result.errors[0]).toMatch(/Invalid JSON/)
    })

    it('returns an error for JSON missing servers/rules arrays', async () => {
      const handler = getHandler('stacks:import')
      const result = (await handler(null, JSON.stringify({ name: 'bad' }))) as { errors: string[] }

      expect(result.errors[0]).toMatch(/Invalid stack format/)
    })
  })
})
