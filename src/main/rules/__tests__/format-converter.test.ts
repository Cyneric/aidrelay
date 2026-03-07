/**
 * @file src/main/rules/__tests__/format-converter.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the format converter pure functions. These tests
 * cover serialisation (rule → file content) and parsing (file content → rule)
 * for all supported client formats.
 */

import { describe, it, expect } from 'vitest'
import {
  toClaudeCodeMd,
  toCursorMdc,
  toConcat,
  parseCursorMdc,
  parseClaudeCodeMd,
  parseConcatMd,
} from '../format-converter'
import type { AiRule } from '@shared/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseRule: AiRule = {
  id: 'rule-1',
  name: 'my-rule',
  description: 'A test rule',
  content: '# My Rule\n\nDo something useful.',
  category: 'general',
  priority: 'normal',
  scope: 'global',
  fileGlobs: [],
  alwaysApply: false,
  tags: [],
  enabled: true,
  clientOverrides: {} as AiRule['clientOverrides'],
  tokenEstimate: 10,
  createdAt: '2026-03-07T00:00:00.000Z',
  updatedAt: '2026-03-07T00:00:00.000Z',
}

// ─── toClaudeCodeMd ───────────────────────────────────────────────────────────

describe('toClaudeCodeMd', () => {
  it('returns rule content with a trailing newline', () => {
    const result = toClaudeCodeMd(baseRule)
    expect(result).toBe('# My Rule\n\nDo something useful.\n')
  })

  it('trims trailing whitespace before adding the newline', () => {
    const rule = { ...baseRule, content: 'Hello   ' }
    expect(toClaudeCodeMd(rule)).toBe('Hello\n')
  })
})

// ─── toCursorMdc ─────────────────────────────────────────────────────────────

describe('toCursorMdc', () => {
  it('generates a valid YAML frontmatter block', () => {
    const result = toCursorMdc(baseRule)
    expect(result).toContain('---\n')
    expect(result).toContain('description: A test rule')
    expect(result).toContain('globs: []')
    expect(result).toContain('alwaysApply: false')
  })

  it('includes globs in array syntax when present', () => {
    const rule = { ...baseRule, fileGlobs: ['**/*.ts', 'src/**'] }
    const result = toCursorMdc(rule)
    expect(result).toContain('globs: ["**/*.ts", "src/**"]')
  })

  it('sets alwaysApply to true when rule has alwaysApply enabled', () => {
    const rule = { ...baseRule, alwaysApply: true }
    expect(toCursorMdc(rule)).toContain('alwaysApply: true')
  })

  it('appends the rule body after the frontmatter', () => {
    const result = toCursorMdc(baseRule)
    expect(result).toContain('Do something useful.')
  })

  it('uses rule name as description when description is empty', () => {
    const rule = { ...baseRule, description: '' }
    const result = toCursorMdc(rule)
    expect(result).toContain('description: my-rule')
  })
})

// ─── toConcat ─────────────────────────────────────────────────────────────────

describe('toConcat', () => {
  it('returns an empty string for an empty rule list', () => {
    expect(toConcat([])).toBe('')
  })

  it('wraps a single rule in a H1 heading', () => {
    const result = toConcat([baseRule])
    expect(result).toContain('# my-rule')
    expect(result).toContain('Do something useful.')
  })

  it('separates multiple rules with a horizontal rule', () => {
    const rule2 = { ...baseRule, id: 'r2', name: 'second-rule', content: 'Second content.' }
    const result = toConcat([baseRule, rule2])
    expect(result).toContain('---')
    expect(result).toContain('# my-rule')
    expect(result).toContain('# second-rule')
  })

  it('ends with a trailing newline', () => {
    const result = toConcat([baseRule])
    expect(result.endsWith('\n')).toBe(true)
  })
})

// ─── parseCursorMdc ───────────────────────────────────────────────────────────

describe('parseCursorMdc', () => {
  it('parses description, globs, and alwaysApply from frontmatter', () => {
    const content = `---
description: My description
globs: ["**/*.ts"]
alwaysApply: true
---

Rule body here.`

    const result = parseCursorMdc(content, 'test-rule')
    expect(result.name).toBe('test-rule')
    expect(result.description).toBe('My description')
    expect(result.fileGlobs).toEqual(['**/*.ts'])
    expect(result.alwaysApply).toBe(true)
    expect(result.content).toBe('Rule body here.')
  })

  it('handles empty globs array', () => {
    const content = '---\ndescription: test\nglobs: []\nalwaysApply: false\n---\n\nBody.'
    const result = parseCursorMdc(content, 'r')
    expect(result.fileGlobs).toEqual([])
  })

  it('falls back gracefully when there is no frontmatter', () => {
    const content = 'Just plain markdown content.'
    const result = parseCursorMdc(content, 'plain')
    expect(result.name).toBe('plain')
    expect(result.content).toBe('Just plain markdown content.')
  })

  it('defaults alwaysApply to false when not in frontmatter', () => {
    const content = '---\ndescription: hi\n---\n\nBody.'
    const result = parseCursorMdc(content, 'r')
    expect(result.alwaysApply).toBe(false)
  })
})

// ─── parseClaudeCodeMd ────────────────────────────────────────────────────────

describe('parseClaudeCodeMd', () => {
  it('returns the full content trimmed with the given name', () => {
    const result = parseClaudeCodeMd('  Hello world  ', 'my-rule')
    expect(result.name).toBe('my-rule')
    expect(result.content).toBe('Hello world')
  })

  it('handles multiline content', () => {
    const result = parseClaudeCodeMd('# Title\n\nBody text.', 'r')
    expect(result.content).toBe('# Title\n\nBody text.')
  })
})

// ─── parseConcatMd ────────────────────────────────────────────────────────────

describe('parseConcatMd', () => {
  it('returns an empty array for empty content', () => {
    expect(parseConcatMd('', 'source')).toEqual([])
  })

  it('parses a single H1 section', () => {
    const content = '# Rule One\n\nDo this.'
    const result = parseConcatMd(content, 'vscode')
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('Rule One')
    expect(result[0]!.content).toBe('Do this.')
  })

  it('splits multiple H1 sections', () => {
    const content = '# First Rule\n\nFirst body.\n\n---\n\n# Second Rule\n\nSecond body.'
    const result = parseConcatMd(content, 'windsurf')
    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('First Rule')
    expect(result[1]!.name).toBe('Second Rule')
  })

  it('tags each parsed rule with the source string', () => {
    const content = '# My Rule\n\nBody.'
    const result = parseConcatMd(content, 'codex-import')
    expect(result[0]!.tags).toContain('codex-import')
  })
})
