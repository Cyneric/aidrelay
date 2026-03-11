import { describe, expect, it } from 'vitest'
import { extractSkillDescription } from '@main/skills/skill-description'

describe('extractSkillDescription', () => {
  it('uses frontmatter description when present', () => {
    const markdown = [
      '---',
      'name: deploy-checks',
      'description: Validate production-safe rollout checks.',
      '---',
      '',
      '# Deploy checks',
      '',
      'Body paragraph.',
    ].join('\n')

    expect(extractSkillDescription(markdown)).toEqual({
      description: 'Validate production-safe rollout checks.',
      source: 'frontmatter',
    })
  })

  it('falls back to first meaningful body paragraph when frontmatter is missing', () => {
    const markdown = [
      '# Title',
      '',
      '- Bullet item',
      '',
      'This paragraph explains what the skill does in practice.',
      '',
      '## Next section',
      '',
      'More text.',
    ].join('\n')

    expect(extractSkillDescription(markdown)).toEqual({
      description: 'This paragraph explains what the skill does in practice.',
      source: 'body',
    })
  })

  it('returns none for heading-only markdown', () => {
    const markdown = ['# Skill', '## Quick start', '- step one', '- step two'].join('\n')
    expect(extractSkillDescription(markdown)).toEqual({
      description: '',
      source: 'none',
    })
  })

  it('normalizes whitespace and truncates to 160 chars with ellipsis', () => {
    const longText =
      'This    line should normalize whitespace and then be truncated because it is intentionally very long. '.repeat(
        4,
      )

    const markdown = ['---', `description: ${longText}`, '---', '', '# Demo'].join('\n')
    const result = extractSkillDescription(markdown)

    expect(result.source).toBe('frontmatter')
    expect(result.description.length).toBeLessThanOrEqual(160)
    expect(result.description.endsWith('…')).toBe(true)
    expect(result.description).not.toMatch(/\s{2,}/)
  })
})
