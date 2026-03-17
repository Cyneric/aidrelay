/**
 * @file src/renderer/components/common/EmptyState.tsx
 *
 * @created 17.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Reusable empty state component displayed when a page or section
 * has no data. Shows a muted icon, descriptive text, and one or two call-to-action
 * buttons to guide the user toward the next step.
 */

import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmptyStateAction {
  readonly label: string
  readonly onClick: () => void
}

interface EmptyStateProps {
  /** Large muted icon rendered above the title */
  readonly icon?: LucideIcon
  /** Primary message displayed to the user */
  readonly title: string
  /** Supporting description below the title */
  readonly description?: string
  /** Primary call-to-action button */
  readonly action?: EmptyStateAction
  /** Secondary call-to-action button rendered as outline variant */
  readonly secondaryAction?: EmptyStateAction
  /** Test identifier */
  readonly testId?: string
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Renders a centered empty state panel with optional icon, description,
 * and action buttons.
 *
 * @param props - Empty state configuration.
 * @returns The empty state element.
 */
const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  testId = 'empty-state',
}: Readonly<EmptyStateProps>) => (
  <div
    className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-12 text-center"
    data-testid={testId}
  >
    {Icon ? <Icon size={40} className="text-text-secondary/50" aria-hidden="true" /> : null}
    <p className="text-sm font-medium text-text-primary">{title}</p>
    {description ? <p className="max-w-sm text-xs text-text-secondary">{description}</p> : null}
    {action || secondaryAction ? (
      <div className="mt-2 flex items-center gap-2">
        {action ? (
          <Button size="sm" onClick={action.onClick} data-testid={`${testId}-action`}>
            {action.label}
          </Button>
        ) : null}
        {secondaryAction ? (
          <Button
            variant="outline"
            size="sm"
            onClick={secondaryAction.onClick}
            data-testid={`${testId}-secondary-action`}
          >
            {secondaryAction.label}
          </Button>
        ) : null}
      </div>
    ) : null}
  </div>
)

export { EmptyState }
export type { EmptyStateProps, EmptyStateAction }
