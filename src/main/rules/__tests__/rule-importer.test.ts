/**
 * @file src/main/rules/__tests__/rule-importer.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the RuleImporter class. Uses a temporary
 * directory to simulate a project structure and mocks the DB repository.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { RuleImporter } from '../rule-importer'
import type { AiRule } from '@shared/types'
import type { Database } from 'better-sqlite3'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const storedRules: AiRule[] = []
const mockCreate = vi.fn((input: unknown) => {
  const rule = { id: `r${storedRules.length + 1}`, ...(input as object) } as AiRule
  storedRules.push(rule)
  return rule
})
const mockUpdate = vi.fn((id: string, updates: unknown) => {
  const existing = storedRules.find((r) => r.id === id)
  if (!existing) throw new Error(`Rule not found: ${id}`)
  const updated = { ...existing, ...(updates as object) } as AiRule
  const idx = storedRules.findIndex((r) => r.id === id)
  storedRules[idx] = updated
  return updated
})

vi.mock('@main/db/rules.repo', () => ({
  RulesRepo: vi.fn().mockImplementation(() => ({
    findAll: () => storedRules,
    create: mockCreate,
    update: mockUpdate,
  })),
}))

// ─── Setup ────────────────────────────────────────────────────────────────────

let tmpDir: string
let importer: RuleImporter

beforeEach(() => {
  storedRules.length = 0
  mockCreate.mockClear()
  mockUpdate.mockClear()
  tmpDir = mkdtempSync(join(tmpdir(), 'aidrelay-importer-'))
  importer = new RuleImporter({} as unknown as Database)
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RuleImporter.importFromDirectory', () => {
  it('returns zero imported/skipped for an empty project', () => {
    const result = importer.importFromDirectory(tmpDir)
    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('imports Cursor .mdc files from .cursor/rules/', () => {
    const rulesDir = join(tmpDir, '.cursor', 'rules')
    mkdirSync(rulesDir, { recursive: true })
    writeFileSync(
      join(rulesDir, 'my-rule.mdc'),
      '---\ndescription: My rule\nglobs: []\nalwaysApply: false\n---\n\nDo this.',
    )

    const result = importer.importFromDirectory(tmpDir)
    expect(result.imported).toBe(1)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'my-rule', content: 'Do this.' }),
    )
  })

  it('imports Claude Code .md files from .claude/rules/', () => {
    const rulesDir = join(tmpDir, '.claude', 'rules')
    mkdirSync(rulesDir, { recursive: true })
    writeFileSync(join(rulesDir, 'coding-style.md'), '# Style\n\nUse spaces.')

    const result = importer.importFromDirectory(tmpDir)
    expect(result.imported).toBe(1)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'coding-style' }))
  })

  it('imports CLAUDE.md from project root', () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), 'Project-wide Claude rules.')

    const result = importer.importFromDirectory(tmpDir)
    expect(result.imported).toBe(1)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'CLAUDE' }))
    expect(mockUpdate).toHaveBeenCalledWith('r1', expect.objectContaining({ tokenEstimate: 4 }))
  })

  it('imports VS Code copilot-instructions.md', () => {
    const githubDir = join(tmpDir, '.github')
    mkdirSync(githubDir, { recursive: true })
    writeFileSync(join(githubDir, 'copilot-instructions.md'), '# Rule A\n\nDo A.')

    const result = importer.importFromDirectory(tmpDir)
    expect(result.imported).toBe(1)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rule A' }))
  })

  it('imports Windsurf .windsurfrules', () => {
    writeFileSync(join(tmpDir, '.windsurfrules'), '# WS Rule\n\nDo WS.')

    const result = importer.importFromDirectory(tmpDir)
    expect(result.imported).toBe(1)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'WS Rule' }))
  })

  it('imports OpenCode instructions from opencode.json', () => {
    writeFileSync(
      join(tmpDir, 'opencode.json'),
      JSON.stringify({ instructions: '# OpenCode Rule\n\nDo OpenCode.' }),
    )

    const result = importer.importFromDirectory(tmpDir)
    expect(result.imported).toBe(1)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'OpenCode Rule' }))
  })

  it('imports AGENTS.md from project root', () => {
    writeFileSync(join(tmpDir, 'AGENTS.md'), 'Agent instructions.')

    const result = importer.importFromDirectory(tmpDir)
    expect(result.imported).toBe(1)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'AGENTS' }))
  })

  it('imports .codex/AGENTS.md', () => {
    const codexDir = join(tmpDir, '.codex')
    mkdirSync(codexDir, { recursive: true })
    writeFileSync(join(codexDir, 'AGENTS.md'), '# Codex Rule\n\nCodex body.')

    const result = importer.importFromDirectory(tmpDir)
    expect(result.imported).toBe(1)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Codex Rule' }))
  })

  it('skips duplicate rules (same name already in DB)', () => {
    storedRules.push({ id: 'existing', name: 'my-rule' } as AiRule)

    const rulesDir = join(tmpDir, '.cursor', 'rules')
    mkdirSync(rulesDir, { recursive: true })
    writeFileSync(join(rulesDir, 'my-rule.mdc'), '---\n---\n\nContent.')

    const result = importer.importFromDirectory(tmpDir)
    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(1)
  })

  it('skips rules with empty content', () => {
    writeFileSync(join(tmpDir, 'AGENTS.md'), '   ')

    const result = importer.importFromDirectory(tmpDir)
    expect(result.skipped).toBe(1)
    expect(result.imported).toBe(0)
  })

  it('tags imported rules with their source', () => {
    const rulesDir = join(tmpDir, '.cursor', 'rules')
    mkdirSync(rulesDir, { recursive: true })
    writeFileSync(join(rulesDir, 'rule.mdc'), '---\n---\n\nBody.')

    importer.importFromDirectory(tmpDir)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.arrayContaining(['cursor-import']) as string[],
        scope: 'project',
        projectPath: tmpDir,
      }),
    )
  })

  it('imports from multiple sources in one scan', () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), 'Claude rules.')
    writeFileSync(join(tmpDir, 'AGENTS.md'), 'Agent rules.')

    const result = importer.importFromDirectory(tmpDir)
    expect(result.imported).toBe(2)
  })

  it('persists non-zero token estimates for imported non-empty content', () => {
    writeFileSync(join(tmpDir, 'AGENTS.md'), 'Always write tests and document edge cases.')

    const result = importer.importFromDirectory(tmpDir)

    expect(result.imported).toBe(1)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const firstCall = mockUpdate.mock.calls[0]
    expect(firstCall).toBeDefined()
    const [, updates] = firstCall as [string, { tokenEstimate: number }]
    expect(updates.tokenEstimate).toBeGreaterThan(0)
  })
})
