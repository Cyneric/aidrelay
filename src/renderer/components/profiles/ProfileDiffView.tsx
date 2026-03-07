/**
 * @file src/renderer/components/profiles/ProfileDiffView.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Confirmation modal shown before activating a profile. Compares
 * the profile's server and rule overrides against the current store state and
 * renders a diff: items that will change highlight with before → after badges.
 * Items with no change are shown in muted text for reference.
 */

import { ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useServersStore } from '@/stores/servers.store'
import { useRulesStore } from '@/stores/rules.store'
import type { Profile } from '@shared/types'

// ─── DiffRow ──────────────────────────────────────────────────────────────────

interface DiffRowProps {
  readonly name: string
  readonly currentEnabled: boolean
  readonly nextEnabled: boolean
}

const EnabledBadge = ({ enabled }: { enabled: boolean }) => (
  <span
    className={cn(
      'text-xs px-1.5 py-0.5 rounded shrink-0',
      enabled
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-muted text-muted-foreground',
    )}
  >
    {enabled ? 'enabled' : 'disabled'}
  </span>
)

const DiffRow = ({ name, currentEnabled, nextEnabled }: DiffRowProps) => {
  const changed = currentEnabled !== nextEnabled
  return (
    <li
      className={cn(
        'flex items-center gap-2 py-1.5 px-2 rounded text-sm',
        changed ? 'bg-muted/50' : 'text-muted-foreground',
      )}
    >
      <span className="flex-1 truncate font-medium">{name}</span>
      <EnabledBadge enabled={currentEnabled} />
      {changed && (
        <>
          <ArrowRight size={12} className="text-muted-foreground shrink-0" aria-hidden="true" />
          <EnabledBadge enabled={nextEnabled} />
        </>
      )}
    </li>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileDiffViewProps {
  /** The profile about to be activated. */
  readonly profile: Profile
  /** True while the activation IPC call is in flight. */
  readonly activating?: boolean
  /** Called when the user confirms activation. */
  readonly onConfirm: () => void
  /** Called when the user cancels. */
  readonly onCancel: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal dialog showing a before/after diff of all overrides that will be
 * applied when the given profile is activated. The user must explicitly
 * confirm before any changes are committed.
 */
const ProfileDiffView = ({
  profile,
  activating = false,
  onConfirm,
  onCancel,
}: ProfileDiffViewProps) => {
  const { servers } = useServersStore()
  const { rules } = useRulesStore()

  const serverEntries = Object.entries(profile.serverOverrides).map(([id, override]) => {
    const server = servers.find((s) => s.id === id)
    return {
      id,
      name: server?.name ?? id,
      current: server?.enabled ?? true,
      next: override.enabled,
    }
  })

  const ruleEntries = Object.entries(profile.ruleOverrides).map(([id, override]) => {
    const rule = rules.find((r) => r.id === id)
    return {
      id,
      name: rule?.name ?? id,
      current: rule?.enabled ?? true,
      next: override.enabled,
    }
  })

  const noChanges = serverEntries.length === 0 && ruleEntries.length === 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
        onClick={onCancel}
        data-testid="profile-diff-backdrop"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="diff-dialog-heading"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        data-testid="profile-diff-view"
      >
        <div className="w-full max-w-lg rounded-lg bg-background border border-border shadow-xl flex flex-col max-h-[80vh]">
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 id="diff-dialog-heading" className="font-semibold text-base">
              Activate &ldquo;{profile.name}&rdquo;
            </h2>
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
              aria-label="Close"
              data-testid="profile-diff-close"
            >
              <X size={18} />
            </button>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            {noChanges ? (
              <p className="text-sm text-muted-foreground">
                This profile has no server or rule overrides. Activating it will trigger a full sync
                with your current settings.
              </p>
            ) : (
              <>
                {serverEntries.length > 0 && (
                  <section aria-labelledby="server-changes-heading">
                    <h3
                      id="server-changes-heading"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2"
                    >
                      Server changes
                    </h3>
                    <ul className="flex flex-col gap-0.5">
                      {serverEntries.map((entry) => (
                        <DiffRow
                          key={entry.id}
                          name={entry.name}
                          currentEnabled={entry.current}
                          nextEnabled={entry.next}
                        />
                      ))}
                    </ul>
                  </section>
                )}

                {ruleEntries.length > 0 && (
                  <section aria-labelledby="rule-changes-heading">
                    <h3
                      id="rule-changes-heading"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2"
                    >
                      Rule changes
                    </h3>
                    <ul className="flex flex-col gap-0.5">
                      {ruleEntries.map((entry) => (
                        <DiffRow
                          key={entry.id}
                          name={entry.name}
                          currentEnabled={entry.current}
                          nextEnabled={entry.next}
                        />
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <footer className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-4 py-2 text-sm border border-input hover:bg-accent transition-colors"
              data-testid="profile-diff-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={activating}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              data-testid="profile-diff-confirm"
            >
              {activating ? 'Activating…' : 'Activate profile'}
            </button>
          </footer>
        </div>
      </div>
    </>
  )
}

export { ProfileDiffView }
