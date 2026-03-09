/**
 * @file src/renderer/components/rules/__tests__/tokenBadgeSeverity.test.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @description Unit tests for token badge color threshold mapping.
 */

import { describe, expect, it } from 'vitest'
import {
  BLUE_CLASS,
  BLUE_TEXT_CLASS,
  DEFAULT_RULE_TOKEN_LIMIT,
  GREEN_CLASS,
  GREEN_TEXT_CLASS,
  ORANGE_CLASS,
  ORANGE_TEXT_CLASS,
  RED_CLASS,
  RED_TEXT_CLASS,
  YELLOW_CLASS,
  YELLOW_TEXT_CLASS,
  tokenBadgeClass,
  tokenTextClass,
  tokenUsageFraction,
} from '../tokenBadgeSeverity'

const limit = DEFAULT_RULE_TOKEN_LIMIT

describe('tokenBadgeSeverity', () => {
  it('maps usage percentage boundaries to the expected class', () => {
    expect(tokenBadgeClass(0, limit)).toBe(GREEN_CLASS)
    expect(tokenBadgeClass(Math.floor(limit * 0.1999), limit)).toBe(GREEN_CLASS)

    expect(tokenBadgeClass(Math.ceil(limit * 0.2), limit)).toBe(BLUE_CLASS)
    expect(tokenBadgeClass(Math.floor(limit * 0.3999), limit)).toBe(BLUE_CLASS)

    expect(tokenBadgeClass(Math.ceil(limit * 0.4), limit)).toBe(YELLOW_CLASS)
    expect(tokenBadgeClass(Math.floor(limit * 0.5999), limit)).toBe(YELLOW_CLASS)

    expect(tokenBadgeClass(Math.ceil(limit * 0.6), limit)).toBe(ORANGE_CLASS)
    expect(tokenBadgeClass(Math.floor(limit * 0.7999), limit)).toBe(ORANGE_CLASS)

    expect(tokenBadgeClass(Math.ceil(limit * 0.8), limit)).toBe(RED_CLASS)
    expect(tokenBadgeClass(Math.ceil(limit * 1.2), limit)).toBe(RED_CLASS)
  })

  it('maps usage percentage boundaries to the expected text class', () => {
    expect(tokenTextClass(0, limit)).toBe(GREEN_TEXT_CLASS)
    expect(tokenTextClass(Math.floor(limit * 0.1999), limit)).toBe(GREEN_TEXT_CLASS)

    expect(tokenTextClass(Math.ceil(limit * 0.2), limit)).toBe(BLUE_TEXT_CLASS)
    expect(tokenTextClass(Math.floor(limit * 0.3999), limit)).toBe(BLUE_TEXT_CLASS)

    expect(tokenTextClass(Math.ceil(limit * 0.4), limit)).toBe(YELLOW_TEXT_CLASS)
    expect(tokenTextClass(Math.floor(limit * 0.5999), limit)).toBe(YELLOW_TEXT_CLASS)

    expect(tokenTextClass(Math.ceil(limit * 0.6), limit)).toBe(ORANGE_TEXT_CLASS)
    expect(tokenTextClass(Math.floor(limit * 0.7999), limit)).toBe(ORANGE_TEXT_CLASS)

    expect(tokenTextClass(Math.ceil(limit * 0.8), limit)).toBe(RED_TEXT_CLASS)
    expect(tokenTextClass(Math.ceil(limit * 1.2), limit)).toBe(RED_TEXT_CLASS)
  })

  it('clamps negative estimates to 0 usage', () => {
    expect(tokenUsageFraction(-10, limit)).toBe(0)
    expect(tokenBadgeClass(-10, limit)).toBe(GREEN_CLASS)
    expect(tokenTextClass(-10, limit)).toBe(GREEN_TEXT_CLASS)
  })
})
