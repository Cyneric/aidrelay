/**
 * @file src/renderer/pages/ClientsPage.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Dedicated client management page. Lists all supported AI tool
 * clients in a table with their installation status, config file paths, server
 * count, sync status, and per-client sync + validate actions.
 *
 * Only installed clients can be synced or validated. Uninstalled clients are
 * shown in a muted state so users know which tools aidrelay supports.
 */

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  RefreshCw,
  ShieldCheck,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useClientsStore } from '@/stores/clients.store'
import type { ClientStatus } from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SYNC_STATUS_META = {
  synced: { label: 'Synced', icon: CheckCircle2, className: 'text-green-600 dark:text-green-400' },
  'out-of-sync': {
    label: 'Out of sync',
    icon: AlertCircle,
    className: 'text-amber-600 dark:text-amber-400',
  },
  'never-synced': { label: 'Never synced', icon: Clock, className: 'text-muted-foreground' },
  error: { label: 'Error', icon: XCircle, className: 'text-destructive' },
} as const satisfies Record<
  ClientStatus['syncStatus'],
  { label: string; icon: typeof CheckCircle2; className: string }
>

// ─── Row Component ────────────────────────────────────────────────────────────

interface RowProps {
  readonly client: ClientStatus
  readonly syncing: boolean
  readonly validating: boolean
  readonly onSync: (id: ClientStatus['id']) => void
  readonly onValidate: (id: ClientStatus['id']) => void
}

/**
 * A single table row for one client.
 */
const ClientRow = ({ client, syncing, validating, onSync, onValidate }: Readonly<RowProps>) => {
  const meta = SYNC_STATUS_META[client.syncStatus]
  const StatusIcon = meta.icon

  return (
    <TableRow
      className={cn(
        'border-b last:border-b-0 transition-colors',
        !client.installed && 'opacity-50',
      )}
      data-testid={`client-row-${client.id}`}
    >
      {/* Name + install badge */}
      <TableCell className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{client.displayName}</span>
          <span
            className={cn(
              'text-xs',
              client.installed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
            )}
            data-testid={`client-install-${client.id}`}
          >
            {client.installed ? 'Installed' : 'Not installed'}
          </span>
        </div>
      </TableCell>

      {/* Config paths */}
      <TableCell className="px-4 py-3 max-w-xs">
        {client.configPaths.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <ul className="space-y-0.5">
            {client.configPaths.map((p) => (
              <li
                key={p}
                className="flex items-center gap-1 text-xs text-muted-foreground font-mono truncate"
                title={p}
              >
                <FolderOpen size={11} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{p}</span>
              </li>
            ))}
          </ul>
        )}
      </TableCell>

      {/* Servers */}
      <TableCell className="px-4 py-3 text-center">
        <span className="text-sm" data-testid={`client-server-count-${client.id}`}>
          {client.serverCount}
        </span>
      </TableCell>

      {/* Sync status */}
      <TableCell className="px-4 py-3">
        <span
          className={cn('inline-flex items-center gap-1 text-xs font-medium', meta.className)}
          data-testid={`client-sync-status-${client.id}`}
        >
          <StatusIcon size={13} aria-hidden="true" />
          {meta.label}
        </span>
      </TableCell>

      {/* Last synced */}
      <TableCell className="px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {client.lastSyncedAt ? new Date(client.lastSyncedAt).toLocaleString() : '—'}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="xs"
                onClick={() => onSync(client.id)}
                disabled={!client.installed || syncing}
                className="gap-1"
                aria-label={`Sync ${client.displayName}`}
                data-testid={`btn-sync-${client.id}`}
              >
                <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
                {syncing ? 'Syncing…' : 'Sync'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {!client.installed
                ? `${client.displayName} is not installed`
                : `Write current profile config to ${client.displayName}`}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onValidate(client.id)}
                disabled={!client.installed || validating}
                className="gap-1"
                aria-label={`Validate ${client.displayName} config`}
                data-testid={`btn-validate-${client.id}`}
              >
                <ShieldCheck size={11} aria-hidden="true" />
                {validating ? 'Checking…' : 'Validate'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Check the config file for schema errors</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Client management page. Shows all supported AI tool clients with their
 * status, config paths, server counts, and sync/validate actions.
 */
const ClientsPage = () => {
  const { clients, loading, detectAll, syncClient } = useClientsStore()
  const [syncingId, setSyncingId] = useState<ClientStatus['id'] | null>(null)
  const [validatingId, setValidatingId] = useState<ClientStatus['id'] | null>(null)

  useEffect(() => {
    void detectAll()
  }, [detectAll])

  const handleSync = useCallback(
    async (clientId: ClientStatus['id']) => {
      setSyncingId(clientId)
      await syncClient(clientId)
      setSyncingId(null)
    },
    [syncClient],
  )

  const handleValidate = useCallback(async (clientId: ClientStatus['id']) => {
    setValidatingId(clientId)
    try {
      const result = await window.api.clientsValidateConfig(clientId)
      if (result.valid) {
        toast.success(`${clientId} config is valid.`)
      } else {
        toast.warning(`${clientId} config has issues: ${result.errors.join(', ')}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed.'
      toast.error(message)
    } finally {
      setValidatingId(null)
    }
  }, [])

  const handleSyncAll = useCallback(async () => {
    const installed = clients.filter((c) => c.installed)
    for (const client of installed) {
      await handleSync(client.id)
    }
    toast.success('All clients synced.')
  }, [clients, handleSync])

  const installedCount = clients.filter((c) => c.installed).length

  return (
    <main className="flex flex-col gap-6" data-testid="clients-page">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? 'Detecting installed AI tools…'
              : `${installedCount} of ${clients.length} supported tools installed`}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void detectAll()}
            disabled={loading}
            className="gap-1.5"
            data-testid="btn-refresh-clients"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {loading ? 'Detecting…' : 'Refresh'}
          </Button>

          <Button
            type="button"
            onClick={() => void handleSyncAll()}
            disabled={loading || installedCount === 0}
            className="gap-1.5"
            data-testid="btn-sync-all"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Sync all
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table className="w-full text-sm" data-testid="clients-table">
          <TableHeader className="border-b bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Client
              </TableHead>
              <TableHead className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Config path
              </TableHead>
              <TableHead className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">
                Servers
              </TableHead>
              <TableHead className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Last synced
              </TableHead>
              <TableHead className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && clients.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="border-b last:border-b-0">
                    <TableCell colSpan={6} className="px-4 py-3">
                      <div
                        className="h-4 w-full animate-pulse rounded bg-muted"
                        aria-hidden="true"
                      />
                    </TableCell>
                  </TableRow>
                ))
              : clients.map((client) => (
                  <ClientRow
                    key={client.id}
                    client={client}
                    syncing={syncingId === client.id}
                    validating={validatingId === client.id}
                    onSync={(id) => void handleSync(id)}
                    onValidate={(id) => void handleValidate(id)}
                  />
                ))}
          </TableBody>
        </Table>
      </div>
    </main>
  )
}

export { ClientsPage }
