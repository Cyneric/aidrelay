/**
 * @file src/renderer/hooks/useTokenBudgets.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Pure computation hook that derives per-client token usage
 * from the rules store. For each installed client it sums `tokenEstimate`
 * across all enabled rules that are not overridden to disabled for that
 * client. The app currently uses one shared placeholder limit for all
 * clients until server-configured values are introduced in a later phase.
 */

import { useMemo } from 'react'
import type { AiRule, ClientStatus } from '@shared/types'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum context budget (tokens) available for rules per client.
 * All clients currently share the same default placeholder limit.
 */
export const TOKEN_LIMITS: Readonly<Record<string, number>> = {
  default: 200_000,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientTokenBudget {
  /** Stable client identifier. */
  readonly clientId: string
  /** Human-readable client name. */
  readonly clientName: string
  /** Total tokens used by enabled rules for this client. */
  readonly used: number
  /** Maximum tokens available for this client. */
  readonly limit: number
  /** Fraction 0–1 of the limit used. Values > 1 indicate overflow. */
  readonly fraction: number
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Computes per-client token usage from the current rule and client state.
 *
 * A rule contributes to a client's budget when:
 * - The rule's global `enabled` flag is `true`, AND
 * - The rule's `clientOverrides` map does not explicitly disable the client.
 *
 * @param rules   - Full list of rules from the rules store.
 * @param clients - Full list of detected clients from the clients store.
 * @returns One budget entry per installed client, sorted by client name.
 */
const useTokenBudgets = (
  rules: readonly AiRule[],
  clients: readonly ClientStatus[],
): ClientTokenBudget[] =>
  useMemo(() => {
    const installed = clients.filter((c) => c.installed)

    return installed
      .map((client) => {
        const used = rules.reduce((sum, rule) => {
          if (!rule.enabled) return sum
          // Check per-client override — explicit `false` disables the rule.
          const override = rule.clientOverrides[client.id]
          if (override !== undefined && !override.enabled) return sum
          return sum + rule.tokenEstimate
        }, 0)

        const limit = TOKEN_LIMITS[client.id] ?? TOKEN_LIMITS['default'] ?? 200_000

        return {
          clientId: client.id,
          clientName: client.displayName,
          used,
          limit,
          fraction: limit > 0 ? used / limit : 0,
        }
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
  }, [rules, clients])

export { useTokenBudgets }
