/**
 * @file src/renderer/components/clients/ClientCard.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Card component that displays the status of a single detected
 * AI tool client. Shows install status, server count, sync state, and a
 * one-click Sync button.
 */

import { RefreshCw, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ClientStatus } from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps a `syncStatus` value to a human-readable label, icon, and colour class.
 */
const SYNC_STATUS_MAP = {
  synced: {
    label: 'Synced',
    icon: CheckCircle2,
    className: 'text-green-500',
  },
  'out-of-sync': {
    label: 'Out of sync',
    icon: AlertCircle,
    className: 'text-yellow-500',
  },
  'never-synced': {
    label: 'Never synced',
    icon: Clock,
    className: 'text-muted-foreground',
  },
  error: {
    label: 'Error',
    icon: XCircle,
    className: 'text-destructive',
  },
} as const satisfies Record<
  ClientStatus['syncStatus'],
  { label: string; icon: typeof CheckCircle2; className: string }
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
  const statusMeta = SYNC_STATUS_MAP[client.syncStatus]
  const StatusIcon = statusMeta.icon

  return (
    <Card
      className={cn('transition-opacity', !client.installed && 'opacity-50')}
      data-testid={`client-card-${client.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <h3 className="font-semibold text-sm leading-none">{client.displayName}</h3>
          <span
            className={cn(
              'mt-1 inline-block text-xs',
              client.installed ? 'text-green-600' : 'text-muted-foreground',
            )}
            data-testid={`client-install-status-${client.id}`}
          >
            {client.installed ? 'Installed' : 'Not installed'}
          </span>
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
          <TooltipContent>{statusMeta.label} — last checked at app startup</TooltipContent>
        </Tooltip>
      </CardHeader>

      <CardContent className="py-0">
        <p
          className="text-sm text-muted-foreground"
          data-testid={`client-server-count-${client.id}`}
        >
          {client.serverCount === 1 ? '1 server' : `${client.serverCount} servers`}
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
              {syncing ? 'Syncing…' : 'Sync'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {!client.installed
              ? `${client.displayName} is not installed`
              : `Write active profile servers and rules to ${client.displayName} config`}
          </TooltipContent>
        </Tooltip>
      </CardFooter>
    </Card>
  )
}

export { ClientCard }
