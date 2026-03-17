/**
 * @file src/renderer/components/profiles/ProfileCard.tsx
 *
 * @created 07.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Card widget for a single configuration profile. Shows the
 * name, icon, color swatch, description, and an "Active" badge when the
 * profile is current. Uses RowActions dropdown for edit/delete actions.
 */

import { Zap, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { RowActions } from '@/components/common/RowActions'
import type { RowActionMenuItem } from '@/components/common/RowActions'
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
const ProfileCard = ({ profile, onActivate, onEdit, onDelete }: ProfileCardProps) => {
  const { t } = useTranslation()
  const isDefault = profile.name.toLowerCase() === 'default'

  const menuItems: ReadonlyArray<RowActionMenuItem> = [
    {
      label: t('common.edit'),
      icon: Pencil,
      onClick: () => onEdit(profile),
      disabled: isDefault,
    },
    {
      label: t('common.delete'),
      icon: Trash2,
      onClick: () => onDelete(profile),
      disabled: profile.isActive || isDefault,
      destructive: true,
    },
  ]

  return (
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
            <h3
              className="font-semibold text-sm truncate"
              data-testid={`profile-name-${profile.id}`}
            >
              {profile.name}
            </h3>
          </div>
          {/* Active badge */}
          {profile.isActive && (
            <Badge
              variant="secondary"
              className="shrink-0 bg-primary/15 text-primary hover:bg-primary/15"
              data-testid={`profile-active-badge-${profile.id}`}
            >
              {t('profiles.active')}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <RowActions
          primaryAction={
            !profile.isActive
              ? {
                  label: t('profiles.activateTooltip'),
                  icon: Zap,
                  onClick: () => onActivate(profile),
                }
              : undefined
          }
          menuItems={menuItems}
          testId={`profile-actions-${profile.id}`}
        />
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
          {t('profiles.serverOverrides', { count: Object.keys(profile.serverOverrides).length })}
        </span>
        <span aria-hidden="true">·</span>
        <span data-testid={`profile-rule-overrides-${profile.id}`}>
          {t('profiles.ruleOverrides', { count: Object.keys(profile.ruleOverrides).length })}
        </span>
      </div>
    </article>
  )
}

export { ProfileCard }
