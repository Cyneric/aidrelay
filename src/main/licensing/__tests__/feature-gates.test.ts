/**
 * @file src/main/licensing/__tests__/feature-gates.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the main-process feature gate helpers.
 * Verifies that `checkGate` returns the correct values for all defined gates
 * at the Free tier (the only active tier until Step 34).
 */

import { describe, it, expect } from 'vitest'
import { checkGate, getActiveGates } from '../feature-gates'
import { FREE_GATES } from '@shared/feature-gates'

describe('getActiveGates()', () => {
  it('returns the FREE_GATES set before licence integration', () => {
    const gates = getActiveGates()
    expect(gates).toEqual(FREE_GATES)
  })
})

describe('checkGate()', () => {
  it('returns the correct numeric limit for maxServers', () => {
    expect(checkGate('maxServers')).toBe(10)
  })

  it('returns the correct numeric limit for maxRules', () => {
    expect(checkGate('maxRules')).toBe(10)
  })

  it('returns the correct numeric limit for maxProfiles', () => {
    expect(checkGate('maxProfiles')).toBe(2)
  })

  it('returns false for gitSync on Free tier', () => {
    expect(checkGate('gitSync')).toBe(false)
  })

  it('returns false for serverTesting on Free tier', () => {
    expect(checkGate('serverTesting')).toBe(false)
  })

  it('returns true for registryInstall on Free tier', () => {
    expect(checkGate('registryInstall')).toBe(true)
  })

  it('returns false for stackExport on Free tier', () => {
    expect(checkGate('stackExport')).toBe(false)
  })

  it('returns false for tokenBudgetDetailed on Free tier', () => {
    expect(checkGate('tokenBudgetDetailed')).toBe(false)
  })

  it('returns 7 for activityLogDays on Free tier', () => {
    expect(checkGate('activityLogDays')).toBe(7)
  })

  it('returns false for ruleTemplates on Free tier', () => {
    expect(checkGate('ruleTemplates')).toBe(false)
  })

  it('matches every value in FREE_GATES', () => {
    const gates = FREE_GATES
    for (const key of Object.keys(gates) as (keyof typeof gates)[]) {
      expect(checkGate(key)).toBe(gates[key])
    }
  })
})
