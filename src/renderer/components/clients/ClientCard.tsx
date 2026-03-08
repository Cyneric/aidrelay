/**
 * @file src/renderer/components/clients/ClientCard.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Card component that displays the status of a single detected
 * AI tool client. Emphasizes one primary action with progressive disclosure
 * for secondary details.
 */

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Clock, XCircle, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ClientStatus } from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps a `syncStatus` value to a human-readable label, icon, and colour class.
 */
const SYNC_STATUS_MAP = {
  synced: {
    labelKey: 'dashboard.synced',
    icon: CheckCircle2,
    className: 'text-status-success',
    badgeClassName: 'border-status-success/50 bg-status-success/15 text-status-success',
  },
  'out-of-sync': {
    labelKey: 'dashboard.outOfSync',
    icon: AlertCircle,
    className: 'text-status-warn',
    badgeClassName: 'border-status-warn/50 bg-status-warn/15 text-status-warn',
  },
  'never-synced': {
    labelKey: 'dashboard.neverSynced',
    icon: Clock,
    className: 'text-text-secondary',
    badgeClassName: 'border-border/80 bg-surface-3 text-text-secondary',
  },
  error: {
    labelKey: 'dashboard.error',
    icon: XCircle,
    className: 'text-status-error',
    badgeClassName: 'border-status-error/50 bg-status-error/15 text-status-error',
  },
} as const satisfies Record<
  ClientStatus['syncStatus'],
  { labelKey: string; icon: typeof CheckCircle2; className: string; badgeClassName: string }
>

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClientCardProps {
  readonly client: ClientStatus
  readonly onSync: (clientId: ClientStatus['id']) => void
  readonly onCreateConfig: (clientId: ClientStatus['id']) => void
  readonly syncing?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays a summary card for a single AI tool client. Always rendered —
 * even if the client is not installed — so the dashboard always shows the
 * full list of supported tools.
 */
const ClientCard = ({ client, onSync, onCreateConfig, syncing = false }: ClientCardProps) => {
  const { t } = useTranslation()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const serverCount =
    Number.isFinite(client.serverCount) && client.serverCount > 0
      ? Math.trunc(client.serverCount)
      : 0
  const statusMetaBase = SYNC_STATUS_MAP[client.syncStatus]
  const StatusIcon = statusMetaBase.icon
  const statusMeta = {
    ...statusMetaBase,
    label: t(statusMetaBase.labelKey as Parameters<typeof t>[0]),
  }
  const missingConfig = client.installed && client.configPaths.length === 0
  const primaryActionLabel = missingConfig
    ? t('dashboard.createConfigAction')
    : syncing
      ? t('clients.syncingButton')
      : t('clients.syncButton')

  const lastSyncedLabel = (() => {
    if (!client.lastSyncedAt) return t('dashboard.lastSyncedNever')
    const parsed = new Date(client.lastSyncedAt)
    if (Number.isNaN(parsed.getTime())) return t('dashboard.lastSyncedUnknown')
    return parsed.toLocaleString()
  })()

  const copyConfigPath = async () => {
    const firstPath = client.configPaths[0]
    if (!firstPath || !navigator?.clipboard?.writeText) return
    await navigator.clipboard.writeText(firstPath)
  }

  const onPrimaryAction = () => {
    if (!client.installed || syncing) return
    if (missingConfig) {
      onCreateConfig(client.id)
      return
    }
    onSync(client.id)
  }

  return (
    <Card
      className={cn(
        'gap-4 border-border/70 bg-surface-1 py-4 shadow-none transition-colors',
        !client.installed && 'opacity-80',
      )}
      data-testid={`client-card-${client.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-0">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold leading-none text-text-primary">
            {client.displayName}
          </h3>
          <p
            className="text-xs text-text-secondary"
            data-testid={`client-install-status-${client.id}`}
          >
            {client.installed ? t('clients.installed') : t('clients.notInstalled')}
          </p>
        </div>

        <Badge
          variant="outline"
          className={cn(
            'gap-1 rounded-full border px-2 py-1 text-[11px] font-medium',
            missingConfig
              ? 'border-status-warn/50 bg-status-warn/15 text-status-warn'
              : statusMeta.badgeClassName,
          )}
          data-testid={`client-sync-status-${client.id}`}
        >
          <StatusIcon size={12} aria-hidden="true" className={statusMeta.className} />
          {missingConfig ? t('dashboard.statusMissingConfig') : statusMeta.label}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-2 py-0">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-text-secondary">{t('dashboard.detailServers')}</dt>
          <dd
            className="text-right text-text-primary"
            data-testid={`client-server-count-${client.id}`}
          >
            {t('dashboard.servers', { count: serverCount })}
          </dd>

          <dt className="text-text-secondary">{t('dashboard.detailLastSync')}</dt>
          <dd className="text-right text-text-primary">{lastSyncedLabel}</dd>
        </dl>

        {detailsOpen ? (
          <div className="rounded-md border border-border/70 bg-surface-2 p-3 text-xs text-text-secondary">
            <p className="mb-1 text-text-primary">
              <span className="font-medium">{t('dashboard.detailSyncStatus')}:</span>{' '}
              {missingConfig ? t('dashboard.statusMissingConfig') : statusMeta.label}
            </p>
            <p className="mb-1 text-text-primary">
              <span className="font-medium">{t('dashboard.detailClientId')}:</span> {client.id}
            </p>
            <div>
              <p className="mb-1 font-medium text-text-primary">
                {t('dashboard.detailConfigPaths')}
              </p>
              {client.configPaths.length > 0 ? (
                <ul className="space-y-1">
                  {client.configPaths.map((path) => (
                    <li key={path} className="break-all">
                      {path}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('clients.noConfigPath')}</p>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="justify-between gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onPrimaryAction}
          disabled={!client.installed || syncing}
          className="gap-1.5"
          data-testid={`client-sync-button-${client.id}`}
          aria-label={`${primaryActionLabel} ${client.displayName}`}
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
          {primaryActionLabel}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={t('dashboard.moreActions', { name: client.displayName })}
              data-testid={`client-more-actions-${client.id}`}
            >
              <MoreHorizontal size={14} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                setDetailsOpen((value) => !value)
              }}
              data-testid={`client-view-details-${client.id}`}
            >
              {detailsOpen ? t('dashboard.hideDetails') : t('dashboard.viewDetails')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={client.configPaths.length === 0}
              onSelect={(event) => {
                event.preventDefault()
                void copyConfigPath()
              }}
            >
              {t('dashboard.copyConfigPath')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  )
}

export { ClientCard }
