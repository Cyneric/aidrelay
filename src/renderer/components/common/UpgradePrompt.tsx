/**
 * @file src/renderer/components/common/UpgradePrompt.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description A small inline banner shown whenever the user tries to use a
 * Pro-gated feature on the free tier. Explains which feature is locked and
 * provides a direct link to upgrade. Designed to be embedded inside any
 * component — not a modal — so it does not disrupt the overall layout.
 */

import { Lock } from 'lucide-react'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Short label for the locked feature, e.g. "Git Sync" or "Registry Install". */
  readonly feature: string
  /** Optional override for the description line shown below the heading. */
  readonly description?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Inline upgrade prompt shown when a Pro-only feature is blocked for a free
 * tier user. Provides context about what is locked and a call-to-action to
 * upgrade.
 *
 * @param props - Feature name and optional description.
 */
export const UpgradePrompt = ({ feature, description }: Readonly<Props>) => (
  <div
    className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
    role="alert"
    aria-label={`${feature} requires a Pro license`}
    data-testid="upgrade-prompt"
  >
    <Lock
      className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
      aria-hidden="true"
    />
    <div className="min-w-0">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        {feature} is a Pro feature
      </p>
      <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">
        {description ?? 'Upgrade to aidrelay Pro to unlock this feature and remove all limits.'}
      </p>
      <a
        href="https://aidrelay.dev/pricing"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center text-sm font-medium text-amber-800 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
      >
        View pricing
      </a>
    </div>
  </div>
)
