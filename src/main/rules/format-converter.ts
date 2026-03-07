/**
 * @file src/main/rules/format-converter.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Pure functions for converting AiRule objects to and from the
 * various file formats used by each AI client. No external dependencies — all
 * YAML frontmatter parsing is hand-rolled to avoid adding a YAML library.
 *
 * Supported formats:
 *   - Claude Code  → plain Markdown  (.md)
 *   - Cursor       → MDC with YAML frontmatter  (.mdc)
 *   - VS Code / Windsurf / Codex → single concatenated Markdown file
 */

import type { AiRule } from '@shared/types'
import type { CreateRuleInput } from '@shared/channels'

// ─── Serialisers ──────────────────────────────────────────────────────────────

/**
 * Serialises an AiRule to plain Markdown for Claude Code.
 * The file name should be `{rule.name}.md` in the `.claude/rules/` directory.
 *
 * @param rule - The rule to serialise.
 * @returns Markdown string ready to write to disk.
 */
export const toClaudeCodeMd = (rule: AiRule): string => rule.content.trimEnd() + '\n'

/**
 * Serialises an AiRule to Cursor's MDC format (.mdc).
 * Writes a YAML frontmatter block followed by the rule body.
 *
 * @param rule - The rule to serialise.
 * @returns MDC-formatted string ready to write to disk.
 */
export const toCursorMdc = (rule: AiRule): string => {
  const lines: string[] = ['---']

  lines.push(`description: ${rule.description || rule.name}`)

  if (rule.fileGlobs.length > 0) {
    const globs = rule.fileGlobs.map((g) => `"${g}"`).join(', ')
    lines.push(`globs: [${globs}]`)
  } else {
    lines.push('globs: []')
  }

  lines.push(`alwaysApply: ${rule.alwaysApply ? 'true' : 'false'}`)
  lines.push('---')
  lines.push('')
  lines.push(rule.content.trimEnd())
  lines.push('')

  return lines.join('\n')
}

/**
 * Concatenates multiple rules into a single Markdown document.
 * Used for VS Code, Windsurf, and Codex CLI which expect one file.
 * Rules are separated by a horizontal rule (`---`).
 *
 * @param rules - Ordered list of rules to concatenate.
 * @returns Single Markdown string with all rule bodies.
 */
export const toConcat = (rules: readonly AiRule[]): string => {
  if (rules.length === 0) return ''

  return (
    rules.map((rule) => `# ${rule.name}\n\n${rule.content.trimEnd()}`).join('\n\n---\n\n') + '\n'
  )
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Parses a minimal YAML frontmatter block from a string delimited by `---`.
 * Supports string values, boolean literals, and simple bracket-array syntax.
 * Returns `null` if no valid frontmatter is found.
 */
const parseFrontmatter = (
  content: string,
): { meta: Record<string, unknown>; body: string } | null => {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('---')) return null

  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) return null

  const fmBlock = trimmed.slice(4, end).trimEnd()
  const body = trimmed.slice(end + 4).trimStart()

  const meta: Record<string, unknown> = {}

  for (const line of fmBlock.split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const rawVal = line.slice(colon + 1).trim()

    if (rawVal === 'true') {
      meta[key] = true
    } else if (rawVal === 'false') {
      meta[key] = false
    } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      // Simple bracket-array: [a, b, "c"]
      const inner = rawVal.slice(1, -1)
      if (inner.trim() === '') {
        meta[key] = []
      } else {
        meta[key] = inner.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''))
      }
    } else {
      meta[key] = rawVal.replace(/^["']|["']$/g, '')
    }
  }

  return { meta, body }
}

/**
 * Parses a Cursor `.mdc` file into a partial `CreateRuleInput`.
 * Extracts YAML frontmatter (`description`, `globs`, `alwaysApply`) and
 * treats the remaining text as the rule body.
 *
 * @param content - Raw file content of the `.mdc` file.
 * @param name    - Rule name derived from the file name (without extension).
 * @returns Partial rule input ready to pass to `RulesRepo.create`.
 */
export const parseCursorMdc = (content: string, name: string): Partial<CreateRuleInput> => {
  const parsed = parseFrontmatter(content)

  if (!parsed) {
    return { name, content: content.trim() }
  }

  const { meta, body } = parsed
  const description = typeof meta['description'] === 'string' ? meta['description'] : undefined
  const alwaysApply = typeof meta['alwaysApply'] === 'boolean' ? meta['alwaysApply'] : false

  const rawGlobs = meta['globs']
  const fileGlobs = Array.isArray(rawGlobs) ? (rawGlobs as string[]).filter(Boolean) : []

  return {
    name,
    ...(description !== undefined && { description }),
    content: body.trim(),
    fileGlobs,
    alwaysApply,
  }
}

/**
 * Parses a plain Markdown file from Claude Code's rules directory.
 * The entire file content is used as the rule body.
 *
 * @param content - Raw file content.
 * @param name    - Rule name derived from the file name (without extension).
 * @returns Partial rule input.
 */
export const parseClaudeCodeMd = (content: string, name: string): Partial<CreateRuleInput> => ({
  name,
  content: content.trim(),
})

/**
 * Splits a concatenated Markdown document (VS Code / Windsurf / Codex format)
 * into individual rules. Each section starts with a level-1 heading (`# Name`).
 *
 * @param content - Raw file content.
 * @param source  - Descriptive source tag added to each rule's tags array.
 * @returns Array of partial rule inputs, one per `# Heading` section.
 */
export const parseConcatMd = (content: string, source: string): Partial<CreateRuleInput>[] => {
  // Split on lines that start with exactly `# ` (H1 headings)
  const sections = content.split(/^(?=# )/m).filter((s) => s.trim())

  return sections.map((section) => {
    const firstNewline = section.indexOf('\n')
    const heading = (firstNewline === -1 ? section : section.slice(0, firstNewline)).trim()
    const name = heading.replace(/^# /, '').trim() || source
    const body =
      firstNewline === -1
        ? ''
        : section
            .slice(firstNewline + 1)
            .replace(/^---\n?/, '')
            .trim()

    return {
      name,
      content: body,
      tags: [source],
    }
  })
}
