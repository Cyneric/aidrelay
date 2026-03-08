/**
 * @file src/main/rules/__tests__/rules-sync.service.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for RulesSyncService. Uses a temporary directory
 * as USERPROFILE to avoid touching the real filesystem and mocks the
 * better-sqlite3 DB dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { RulesSyncService } from '../rules-sync.service'
import type { AiRule } from '@shared/types'
import type { Database } from 'better-sqlite3'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Minimal in-memory rule store shared across mocked repo instances
const storedRules: AiRule[] = []

vi.mock('@main/db/rules.repo', () => ({
  RulesRepo: vi.fn().mockImplementation(() => ({
    findAll: () => storedRules,
  })),
}))

vi.mock('@main/db/activity-log.repo', () => ({
  ActivityLogRepo: vi.fn().mockImplementation(() => ({
    insert: vi.fn(),
  })),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeRule = (overrides: Partial<AiRule> = {}): AiRule =>
  ({
    id: 'r1',
    name: 'my rule',
    description: '',
    content: 'Rule content.',
    category: 'general',
    priority: 'normal',
    scope: 'global',
    fileGlobs: [],
    alwaysApply: false,
    tags: [],
    enabled: true,
    clientOverrides: {} as AiRule['clientOverrides'],
    tokenEstimate: 5,
    createdAt: '2026-03-07T00:00:00.000Z',
    updatedAt: '2026-03-07T00:00:00.000Z',
    ...overrides,
  }) as AiRule

const makeDb = () => ({}) as unknown as Database

// ─── Setup ────────────────────────────────────────────────────────────────────

let tmpDir: string
let originalUserProfile: string | undefined
let service: RulesSyncService

beforeEach(() => {
  storedRules.length = 0
  tmpDir = mkdtempSync(join(tmpdir(), 'aidrelay-rules-sync-'))
  originalUserProfile = process.env['USERPROFILE']
  process.env['USERPROFILE'] = tmpDir
  service = new RulesSyncService(makeDb())
})

afterEach(() => {
  process.env['USERPROFILE'] = originalUserProfile
  rmSync(tmpDir, { recursive: true, force: true })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RulesSyncService.sync — claude-code', () => {
  it('writes a .md file to the global claude rules dir', () => {
    storedRules.push(makeRule({ name: 'test-rule', content: 'Do this.' }))
    const result = service.sync('claude-code')
    expect(result.success).toBe(true)
    expect(result.serversWritten).toBe(1)

    const filePath = join(tmpDir, '.claude', 'rules', 'test-rule.md')
    expect(existsSync(filePath)).toBe(true)
    expect(readFileSync(filePath, 'utf-8')).toContain('Do this.')
  })

  it('sanitises rule names to safe file names', () => {
    storedRules.push(makeRule({ name: 'My Rule! (v2)', content: 'body' }))
    service.sync('claude-code')
    const filePath = join(tmpDir, '.claude', 'rules', 'my-rule-v2.md')
    expect(existsSync(filePath)).toBe(true)
  })

  it('skips disabled rules', () => {
    storedRules.push(makeRule({ name: 'disabled', enabled: false }))
    const result = service.sync('claude-code')
    expect(result.serversWritten).toBe(0)
  })

  it('skips rules overridden to disabled for the client', () => {
    storedRules.push(
      makeRule({
        name: 'overridden',
        clientOverrides: { 'claude-code': { enabled: false } } as AiRule['clientOverrides'],
      }),
    )
    const result = service.sync('claude-code')
    expect(result.serversWritten).toBe(0)
  })

  it('writes project-scoped rules to the project directory', () => {
    const projectPath = join(tmpDir, 'my-project')
    mkdirSync(projectPath, { recursive: true })

    storedRules.push(makeRule({ name: 'proj-rule', scope: 'project', projectPath }))
    service.sync('claude-code')

    const filePath = join(projectPath, '.claude', 'rules', 'proj-rule.md')
    expect(existsSync(filePath)).toBe(true)
  })
})

describe('RulesSyncService.sync — cursor', () => {
  it('writes a .mdc file to the global cursor rules dir', () => {
    storedRules.push(makeRule({ name: 'cursor-rule', description: 'desc', content: 'Body.' }))
    const result = service.sync('cursor')
    expect(result.success).toBe(true)

    const filePath = join(tmpDir, '.cursor', 'rules', 'cursor-rule.mdc')
    expect(existsSync(filePath)).toBe(true)

    const fileContent = readFileSync(filePath, 'utf-8')
    expect(fileContent).toContain('---')
    expect(fileContent).toContain('description: desc')
    expect(fileContent).toContain('Body.')
  })
})

describe('RulesSyncService.sync — vscode', () => {
  it('skips global-scope rules (no global path for vscode)', () => {
    storedRules.push(makeRule({ name: 'global-rule', scope: 'global' }))
    const result = service.sync('vscode')
    // Global rules have no projectPath → all skipped
    expect(result.serversWritten).toBe(0)
  })

  it('writes concatenated file to .github/copilot-instructions.md', () => {
    const projectPath = join(tmpDir, 'proj')
    mkdirSync(projectPath, { recursive: true })

    storedRules.push(
      makeRule({ name: 'rule-a', scope: 'project', projectPath, content: 'Rule A content.' }),
      makeRule({
        id: 'r2',
        name: 'rule-b',
        scope: 'project',
        projectPath,
        content: 'Rule B content.',
      }),
    )
    service.sync('vscode')

    const filePath = join(projectPath, '.github', 'copilot-instructions.md')
    expect(existsSync(filePath)).toBe(true)

    const fileContent = readFileSync(filePath, 'utf-8')
    expect(fileContent).toContain('# rule-a')
    expect(fileContent).toContain('Rule A content.')
    expect(fileContent).toContain('# rule-b')
  })
})

describe('RulesSyncService.sync — vscode family', () => {
  it.each(['vscode-insiders', 'visual-studio'] as const)(
    'writes concatenated file for %s to .github/copilot-instructions.md',
    (clientId) => {
      const projectPath = join(tmpDir, `proj-${clientId}`)
      mkdirSync(projectPath, { recursive: true })

      storedRules.push(
        makeRule({
          name: 'rule-a',
          scope: 'project',
          projectPath,
          content: 'Rule A content.',
        }),
      )
      service.sync(clientId)

      const filePath = join(projectPath, '.github', 'copilot-instructions.md')
      expect(existsSync(filePath)).toBe(true)
      expect(readFileSync(filePath, 'utf-8')).toContain('Rule A content.')
    },
  )
})

describe('RulesSyncService.sync — windsurf', () => {
  it('writes concatenated file to .windsurfrules', () => {
    const projectPath = join(tmpDir, 'ws-proj')
    mkdirSync(projectPath, { recursive: true })

    storedRules.push(
      makeRule({ name: 'ws-rule', scope: 'project', projectPath, content: 'WS body.' }),
    )
    service.sync('windsurf')

    expect(existsSync(join(projectPath, '.windsurfrules'))).toBe(true)
  })
})

describe('RulesSyncService.sync — codex clients', () => {
  it.each(['codex-cli', 'codex-gui'] as const)(
    'writes concatenated file to .codex/AGENTS.md for %s',
    (clientId) => {
      const projectPath = join(tmpDir, `codex-proj-${clientId}`)
      mkdirSync(projectPath, { recursive: true })

      storedRules.push(
        makeRule({
          name: 'codex-rule',
          scope: 'project',
          projectPath,
          content: 'Codex body.',
        }),
      )
      service.sync(clientId)

      expect(existsSync(join(projectPath, '.codex', 'AGENTS.md'))).toBe(true)
    },
  )
})

describe('RulesSyncService.sync — opencode', () => {
  it('writes concatenated instructions to opencode.json', () => {
    const projectPath = join(tmpDir, 'opencode-proj')
    mkdirSync(projectPath, { recursive: true })

    storedRules.push(
      makeRule({
        name: 'open-rule',
        scope: 'project',
        projectPath,
        content: 'Open body.',
      }),
    )

    const result = service.sync('opencode')
    expect(result.success).toBe(true)

    const configPath = join(projectPath, 'opencode.json')
    expect(existsSync(configPath)).toBe(true)
    const content = JSON.parse(readFileSync(configPath, 'utf-8')) as { instructions?: string }
    expect(content.instructions).toContain('Open body.')
  })
})

describe('RulesSyncService.sync — unsupported clients', () => {
  it('returns success with 0 written for clients without rules support', () => {
    storedRules.push(makeRule())
    const result = service.sync('claude-desktop')
    expect(result.success).toBe(true)
    expect(result.serversWritten).toBe(0)
  })
})

describe('RulesSyncService.syncAll', () => {
  it('returns one result per client ID', () => {
    const results = service.syncAll(['claude-code', 'cursor'])
    expect(results).toHaveLength(2)
    expect(results[0]!.clientId).toBe('claude-code')
    expect(results[1]!.clientId).toBe('cursor')
  })
})
