/**
 * @file src/renderer/components/rules/TokenBudgetBar.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Single-row token budget indicator for one AI client. Shows
 * the client name, a coloured progress bar, and a "used / limit" label.
 * A warning icon appears when usage exceeds 80% of the limit.
 */

import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClientTokenBudget } from '@/hooks/useTokenBudgets'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the Tailwind fill class for the progress bar based on usage fraction. */
const barColor = (fraction: number): string => {
  if (fraction >= 1) return 'bg-destructive'
  if (fraction >= 0.8) return 'bg-amber-500'
  return 'bg-emerald-500'
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TokenBudgetBarProps {
  readonly budget: ClientTokenBudget
}

/**
 * Renders a labelled progress bar for a single client's token budget.
 * The bar is clamped to 100% visually even if `used` exceeds `limit`.
 */
const TokenBudgetBar = ({ budget }: TokenBudgetBarProps) => {
  const { clientName, clientId, used, limit, fraction } = budget
  const pct = Math.min(fraction * 100, 100)
  const isWarning = fraction >= 0.8

  return (
    <div
      className="flex items-center gap-3"
      data-testid={`token-budget-bar-${clientId}`}
      role="group"
      aria-label={`Token budget for ${clientName}`}
    >
      {/* Client name */}
      <span className="w-28 shrink-0 text-sm font-medium truncate" title={clientName}>
        {clientName}
      </span>

      {/* Progress bar */}
      <div
        className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${used.toLocaleString()} of ${limit.toLocaleString()} tokens used`}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor(fraction))}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Usage label */}
      <span
        className={cn(
          'w-36 shrink-0 text-right text-xs tabular-nums',
          fraction >= 1
            ? 'text-destructive font-medium'
            : fraction >= 0.8
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-muted-foreground',
        )}
        data-testid={`token-budget-label-${clientId}`}
      >
        {used.toLocaleString()} / {limit.toLocaleString()}
      </span>

      {/* Warning icon */}
      {isWarning ? (
        <AlertTriangle
          size={14}
          className={cn('shrink-0', fraction >= 1 ? 'text-destructive' : 'text-amber-500')}
          aria-label="Token budget warning"
          data-testid={`token-budget-warning-${clientId}`}
        />
      ) : (
        <div className="w-3.5 shrink-0" aria-hidden="true" />
      )}
    </div>
  )
}

export { TokenBudgetBar }
