/**
 * @file src/renderer/pages/ClientsPage.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
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
    <tr
      className={cn(
        'border-b last:border-b-0 transition-colors',
        !client.installed && 'opacity-50',
      )}
      data-testid={`client-row-${client.id}`}
    >
      {/* Name + install badge */}
      <td className="px-4 py-3">
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
      </td>

      {/* Config paths */}
      <td className="px-4 py-3 max-w-xs">
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
      </td>

      {/* Servers */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm" data-testid={`client-server-count-${client.id}`}>
          {client.serverCount}
        </span>
      </td>

      {/* Sync status */}
      <td className="px-4 py-3">
        <span
          className={cn('inline-flex items-center gap-1 text-xs font-medium', meta.className)}
          data-testid={`client-sync-status-${client.id}`}
        >
          <StatusIcon size={13} aria-hidden="true" />
          {meta.label}
        </span>
      </td>

      {/* Last synced */}
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {client.lastSyncedAt ? new Date(client.lastSyncedAt).toLocaleString() : '—'}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSync(client.id)}
            disabled={!client.installed || syncing}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
            )}
            aria-label={`Sync ${client.displayName}`}
            data-testid={`btn-sync-${client.id}`}
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>

          <button
            type="button"
            onClick={() => onValidate(client.id)}
            disabled={!client.installed || validating}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium',
              'border hover:bg-accent transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
            aria-label={`Validate ${client.displayName} config`}
            data-testid={`btn-validate-${client.id}`}
          >
            <ShieldCheck size={11} aria-hidden="true" />
            {validating ? 'Checking…' : 'Validate'}
          </button>
        </div>
      </td>
    </tr>
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
          <button
            type="button"
            onClick={() => void detectAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border hover:bg-accent transition-colors disabled:opacity-50"
            data-testid="btn-refresh-clients"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {loading ? 'Detecting…' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={() => void handleSyncAll()}
            disabled={loading || installedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            data-testid="btn-sync-all"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Sync all
          </button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm" data-testid="clients-table">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Client
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Config path
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">
                Servers
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Last synced
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && clients.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td colSpan={6} className="px-4 py-3">
                      <div
                        className="h-4 w-full animate-pulse rounded bg-muted"
                        aria-hidden="true"
                      />
                    </td>
                  </tr>
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
          </tbody>
        </table>
      </div>
    </main>
  )
}

export { ClientsPage }
