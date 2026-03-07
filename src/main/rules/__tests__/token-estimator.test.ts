/**
 * @file src/main/rules/__tests__/token-estimator.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the token estimation heuristic. Verifies the
 * word-count * 1.3 formula with ceiling, edge cases (empty, whitespace-only,
 * markdown syntax), and that the result is always a non-negative integer.
 */

import { describe, it, expect } from 'vitest'
import { estimateTokens } from '../token-estimator'

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('returns 0 for whitespace-only string', () => {
    expect(estimateTokens('   \n\t  ')).toBe(0)
  })

  it('applies the word-count * 1.3 ceiling formula', () => {
    // 6 words → 6 * 1.3 = 7.8 → ceil = 8
    expect(estimateTokens('Use TypeScript strict mode always please')).toBe(8)
  })

  it('handles single word', () => {
    // 1 word → 1 * 1.3 = 1.3 → ceil = 2
    expect(estimateTokens('Hello')).toBe(2)
  })

  it('handles 10 words exactly', () => {
    // 10 * 1.3 = 13 → ceil = 13
    expect(estimateTokens('one two three four five six seven eight nine ten')).toBe(13)
  })

  it('treats multiple whitespace types as word separators', () => {
    // Same words, different separators — should produce the same result
    const normal = estimateTokens('one two three')
    const mixed = estimateTokens('one\ttwo\nthree')
    expect(normal).toBe(mixed)
  })

  it('counts markdown syntax tokens conservatively', () => {
    const content = `# My Rule\n\nAlways use **strict mode** in TypeScript.\n\n- Item one\n- Item two`
    const result = estimateTokens(content)
    expect(result).toBeGreaterThan(0)
    expect(Number.isInteger(result)).toBe(true)
  })

  it('always returns a non-negative integer', () => {
    const inputs = ['', 'hello', 'one two three four five']
    for (const input of inputs) {
      const result = estimateTokens(input)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(result)).toBe(true)
    }
  })
})
