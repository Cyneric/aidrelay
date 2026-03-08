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
 * AI tool client. Shows install status, server count, sync state, and a
 * one-click Sync button.
 */

import { RefreshCw, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ClientStatus } from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps a `syncStatus` value to a human-readable label, icon, and colour class.
 */
const SYNC_STATUS_MAP = {
  synced: {
    labelKey: 'dashboard.synced',
    icon: CheckCircle2,
    className: 'text-green-500',
  },
  'out-of-sync': {
    labelKey: 'dashboard.outOfSync',
    icon: AlertCircle,
    className: 'text-yellow-500',
  },
  'never-synced': {
    labelKey: 'dashboard.neverSynced',
    icon: Clock,
    className: 'text-muted-foreground',
  },
  error: {
    labelKey: 'dashboard.error',
    icon: XCircle,
    className: 'text-destructive',
  },
} as const satisfies Record<
  ClientStatus['syncStatus'],
  { labelKey: string; icon: typeof CheckCircle2; className: string }
>

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClientCardProps {
  readonly client: ClientStatus
  readonly onSync: (clientId: ClientStatus['id']) => void
  readonly syncing?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays a summary card for a single AI tool client. Always rendered —
 * even if the client is not installed — so the dashboard always shows the
 * full list of supported tools.
 */
const ClientCard = ({ client, onSync, syncing = false }: ClientCardProps) => {
  const { t } = useTranslation()
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

  return (
    <Card
      className={cn('transition-opacity', !client.installed && 'opacity-50')}
      data-testid={`client-card-${client.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <h3 className="font-semibold text-sm leading-none">{client.displayName}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={cn(
                'inline-block text-xs',
                client.installed ? 'text-green-600' : 'text-muted-foreground',
              )}
              data-testid={`client-install-status-${client.id}`}
            >
              {client.installed ? t('clients.installed') : t('clients.notInstalled')}
            </span>
            {missingConfig && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wide"
                    data-testid={`client-missing-config-badge-${client.id}`}
                  >
                    {t('clients.missingConfigBadge')}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {t('clients.missingConfigTooltip', { name: client.displayName })}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn('flex items-center gap-1 text-xs cursor-default', statusMeta.className)}
              data-testid={`client-sync-status-${client.id}`}
            >
              <StatusIcon size={13} aria-hidden="true" />
              {statusMeta.label}
            </span>
          </TooltipTrigger>
          <TooltipContent>{statusMeta.label}</TooltipContent>
        </Tooltip>
      </CardHeader>

      <CardContent className="py-0">
        <p
          className="text-sm text-muted-foreground"
          data-testid={`client-server-count-${client.id}`}
        >
          {t('dashboard.servers', { count: serverCount })}
        </p>
      </CardContent>

      <CardFooter>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              onClick={() => onSync(client.id)}
              disabled={!client.installed || syncing}
              className="gap-1.5"
              data-testid={`client-sync-button-${client.id}`}
              aria-label={`Sync ${client.displayName}`}
            >
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
              {syncing ? t('clients.syncingButton') : t('clients.syncButton')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {!client.installed
              ? t('clients.notInstalledTooltip', { name: client.displayName })
              : t('clients.syncTooltip', { name: client.displayName })}
          </TooltipContent>
        </Tooltip>
      </CardFooter>
    </Card>
  )
}

export { ClientCard }
