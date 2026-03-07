/**
 * @file src/renderer/components/profiles/ProfileCard.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Card widget for a single configuration profile. Shows the
 * name, icon, color swatch, description, and an "Active" badge when the
 * profile is current. Exposes Activate, Edit, and Delete action buttons.
 */

import { Pencil, Trash2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile } from '@shared/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileCardProps {
  readonly profile: Profile
  /** Called when the user confirms activation. */
  readonly onActivate: (profile: Profile) => void
  /** Called when the user clicks the edit (pencil) button. */
  readonly onEdit: (profile: Profile) => void
  /** Called when the user confirms deletion. */
  readonly onDelete: (profile: Profile) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays a single profile as a card with action buttons.
 */
const ProfileCard = ({ profile, onActivate, onEdit, onDelete }: ProfileCardProps) => (
  <article
    className={cn(
      'rounded-lg border p-4 flex flex-col gap-3 transition-shadow hover:shadow-md',
      profile.isActive ? 'border-primary/50 bg-primary/5' : 'border-border bg-card',
    )}
    aria-label={`Profile: ${profile.name}`}
    data-testid={`profile-card-${profile.id}`}
  >
    {/* Header row */}
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {/* Color swatch */}
        <div
          className="w-4 h-4 rounded-full shrink-0 ring-1 ring-black/10"
          style={{ backgroundColor: profile.color || '#6366f1' }}
          aria-hidden="true"
        />
        {/* Icon + name */}
        <div className="flex items-center gap-1.5 min-w-0">
          {profile.icon && (
            <span className="text-base leading-none" aria-hidden="true">
              {profile.icon}
            </span>
          )}
          <h3 className="font-semibold text-sm truncate" data-testid={`profile-name-${profile.id}`}>
            {profile.name}
          </h3>
        </div>
        {/* Active badge */}
        {profile.isActive && (
          <span
            className="shrink-0 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-medium"
            data-testid={`profile-active-badge-${profile.id}`}
          >
            Active
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {!profile.isActive && (
          <button
            type="button"
            onClick={() => onActivate(profile)}
            className="p-1.5 text-muted-foreground hover:text-primary rounded transition-colors"
            aria-label={`Activate profile ${profile.name}`}
            data-testid={`profile-activate-${profile.id}`}
          >
            <Zap size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(profile)}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
          aria-label={`Edit profile ${profile.name}`}
          data-testid={`profile-edit-${profile.id}`}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(profile)}
          disabled={profile.isActive}
          className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`Delete profile ${profile.name}`}
          data-testid={`profile-delete-${profile.id}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>

    {/* Description */}
    {profile.description && (
      <p
        className="text-xs text-muted-foreground line-clamp-2"
        data-testid={`profile-description-${profile.id}`}
      >
        {profile.description}
      </p>
    )}

    {/* Override counts */}
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span data-testid={`profile-server-overrides-${profile.id}`}>
        {Object.keys(profile.serverOverrides).length} server override
        {Object.keys(profile.serverOverrides).length !== 1 ? 's' : ''}
      </span>
      <span aria-hidden="true">·</span>
      <span data-testid={`profile-rule-overrides-${profile.id}`}>
        {Object.keys(profile.ruleOverrides).length} rule override
        {Object.keys(profile.ruleOverrides).length !== 1 ? 's' : ''}
      </span>
    </div>
  </article>
)

export { ProfileCard }
