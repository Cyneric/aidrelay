/**
 * @file src/renderer/lib/__tests__/useFeatureGate.test.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the `useFeatureGate` React hook. Each gate key
 * is verified to return the correct Free tier value. Tests run in JSDOM so
 * React hooks work as expected.
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFeatureGate } from '../useFeatureGate'
import { FREE_GATES } from '@shared/feature-gates'

describe('useFeatureGate()', () => {
  it('returns the correct maxServers limit', () => {
    const { result } = renderHook(() => useFeatureGate('maxServers'))
    expect(result.current).toBe(10)
  })

  it('returns the correct maxRules limit', () => {
    const { result } = renderHook(() => useFeatureGate('maxRules'))
    expect(result.current).toBe(10)
  })

  it('returns the correct maxProfiles limit', () => {
    const { result } = renderHook(() => useFeatureGate('maxProfiles'))
    expect(result.current).toBe(2)
  })

  it('returns false for gitSync on Free tier', () => {
    const { result } = renderHook(() => useFeatureGate('gitSync'))
    expect(result.current).toBe(false)
  })

  it('returns false for serverTesting on Free tier', () => {
    const { result } = renderHook(() => useFeatureGate('serverTesting'))
    expect(result.current).toBe(false)
  })

  it('returns false for stackExport on Free tier', () => {
    const { result } = renderHook(() => useFeatureGate('stackExport'))
    expect(result.current).toBe(false)
  })

  it('returns 7 for activityLogDays on Free tier', () => {
    const { result } = renderHook(() => useFeatureGate('activityLogDays'))
    expect(result.current).toBe(7)
  })

  it('returns false for ruleTemplates on Free tier', () => {
    const { result } = renderHook(() => useFeatureGate('ruleTemplates'))
    expect(result.current).toBe(false)
  })

  it('matches every FREE_GATES value', () => {
    const keys = Object.keys(FREE_GATES) as (keyof typeof FREE_GATES)[]

    for (const key of keys) {
      const { result } = renderHook(() => useFeatureGate(key))
      expect(result.current).toBe(FREE_GATES[key])
    }
  })
})
