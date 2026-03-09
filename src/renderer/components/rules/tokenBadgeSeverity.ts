/**
 * @file src/renderer/components/rules/tokenBadgeSeverity.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @description Shared token-badge severity mapping for rule editors.
 * Maps token usage percentage to a 5-step color scale.
 */

import { TOKEN_LIMITS } from '@/hooks/useTokenBudgets'

const DEFAULT_RULE_TOKEN_LIMIT = TOKEN_LIMITS.default ?? 200_000

const GREEN_CLASS = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
const BLUE_CLASS = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
const YELLOW_CLASS = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
const ORANGE_CLASS = 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
const RED_CLASS = 'bg-destructive/15 text-destructive'

const GREEN_TEXT_CLASS = 'text-emerald-700 dark:text-emerald-300'
const BLUE_TEXT_CLASS = 'text-blue-700 dark:text-blue-300'
const YELLOW_TEXT_CLASS = 'text-yellow-700 dark:text-yellow-300'
const ORANGE_TEXT_CLASS = 'text-orange-700 dark:text-orange-300'
const RED_TEXT_CLASS = 'text-destructive font-medium'

const tokenUsageFraction = (tokenEstimate: number, limit = DEFAULT_RULE_TOKEN_LIMIT): number => {
  if (limit <= 0) return 0
  const safeEstimate = Math.max(0, tokenEstimate)
  return safeEstimate / limit
}

const tokenBadgeClass = (tokenEstimate: number, limit = DEFAULT_RULE_TOKEN_LIMIT): string => {
  const usagePct = tokenUsageFraction(tokenEstimate, limit) * 100

  if (usagePct < 20) return GREEN_CLASS
  if (usagePct < 40) return BLUE_CLASS
  if (usagePct < 60) return YELLOW_CLASS
  if (usagePct < 80) return ORANGE_CLASS
  return RED_CLASS
}

const tokenTextClass = (tokenEstimate: number, limit = DEFAULT_RULE_TOKEN_LIMIT): string => {
  const usagePct = tokenUsageFraction(tokenEstimate, limit) * 100

  if (usagePct < 20) return GREEN_TEXT_CLASS
  if (usagePct < 40) return BLUE_TEXT_CLASS
  if (usagePct < 60) return YELLOW_TEXT_CLASS
  if (usagePct < 80) return ORANGE_TEXT_CLASS
  return RED_TEXT_CLASS
}

export {
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
}
