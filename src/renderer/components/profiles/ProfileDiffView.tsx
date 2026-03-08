/**
 * @file src/renderer/components/profiles/ProfileDiffView.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Confirmation modal shown before activating a profile. Compares
 * the profile's server and rule overrides against the current store state and
 * renders a diff: items that will change highlight with before → after badges.
 * Items with no change are shown in muted text for reference.
 */

import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useServersStore } from '@/stores/servers.store'
import { useRulesStore } from '@/stores/rules.store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent
        className="max-w-lg flex flex-col max-h-[80vh]"
        data-testid="profile-diff-view"
      >
        <DialogHeader>
          <DialogTitle>Activate &ldquo;{profile.name}&rdquo;</DialogTitle>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="flex flex-col gap-5 py-2">
            {noChanges ? (
              <p className="text-sm text-muted-foreground">
                This profile has no MCP server or rule overrides. Activating it will trigger a full
                sync with your current settings.
              </p>
            ) : (
              <>
                {serverEntries.length > 0 && (
                  <section aria-labelledby="server-changes-heading">
                    <h3
                      id="server-changes-heading"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2"
                    >
                      MCP Server changes
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
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="profile-diff-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={activating}
            data-testid="profile-diff-confirm"
          >
            {activating ? 'Activating…' : 'Activate profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ProfileDiffView }
