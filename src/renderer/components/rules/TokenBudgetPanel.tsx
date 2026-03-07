/**
 * @file src/renderer/components/rules/TokenBudgetPanel.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Collapsible panel that shows a per-client token budget bar
 * for every installed AI client. Reads rules from the rules store and
 * clients from the clients store; delegates computation to `useTokenBudgets`.
 */

import { useRulesStore } from '@/stores/rules.store'
import { useClientsStore } from '@/stores/clients.store'
import { useTokenBudgets } from '@/hooks/useTokenBudgets'
import { TokenBudgetBar } from './TokenBudgetBar'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Inner content for the token budget panel.  Shown when the collapsible
 * section is expanded in `RulesPage`.
 */
const TokenBudgetPanel = () => {
  const rules = useRulesStore((s) => s.rules)
  const clients = useClientsStore((s) => s.clients)
  const budgets = useTokenBudgets(rules, clients)

  if (budgets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="token-budget-empty">
        No installed clients detected. Launch an AI tool and click Detect.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3" data-testid="token-budget-panel">
      {budgets.map((budget) => (
        <TokenBudgetBar key={budget.clientId} budget={budget} />
      ))}
    </div>
  )
}

export { TokenBudgetPanel }
