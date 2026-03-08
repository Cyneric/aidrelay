/**
 * @file src/renderer/pages/ClientsPage.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
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
import { useTranslation } from 'react-i18next'
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
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CreateConfigConfirmDialog } from '@/components/clients/CreateConfigConfirmDialog'
import { useClientsStore } from '@/stores/clients.store'
import { isConfigCreationRequiredError } from '@/lib/sync-errors'
import { clientsService } from '@/services/clients.service'
import type { ClientStatus, SyncClientOptions, SyncResult } from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SYNC_STATUS_KEYS = {
  synced: {
    labelKey: 'dashboard.synced',
    icon: CheckCircle2,
    className: 'text-green-600 dark:text-green-400',
  },
  'out-of-sync': {
    labelKey: 'dashboard.outOfSync',
    icon: AlertCircle,
    className: 'text-amber-600 dark:text-amber-400',
  },
  'never-synced': {
    labelKey: 'dashboard.neverSynced',
    icon: Clock,
    className: 'text-muted-foreground',
  },
  error: { labelKey: 'dashboard.error', icon: XCircle, className: 'text-destructive' },
} as const satisfies Record<
  ClientStatus['syncStatus'],
  { labelKey: string; icon: typeof CheckCircle2; className: string }
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
  const { t } = useTranslation()
  const metaBase = SYNC_STATUS_KEYS[client.syncStatus]
  const StatusIcon = metaBase.icon
  const meta = { ...metaBase, label: t(metaBase.labelKey as Parameters<typeof t>[0]) }
  const missingConfig = client.installed && client.configPaths.length === 0

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
            {client.installed ? t('clients.installed') : t('clients.notInstalled')}
          </span>
          {missingConfig && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="w-fit text-[10px] uppercase tracking-wide"
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
      </TableCell>

      {/* Config paths */}
      <TableCell className="px-4 py-3 max-w-xs">
        {client.configPaths.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {missingConfig ? t('clients.noConfigPath') : '—'}
          </span>
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
                {syncing ? t('clients.syncingButton') : t('clients.syncButton')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {!client.installed
                ? client.id === 'codex-gui'
                  ? t('clients.notInstalledCodexGuiTooltip', { name: client.displayName })
                  : t('clients.notInstalledTooltip', { name: client.displayName })
                : t('clients.syncTooltip', { name: client.displayName })}
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
                {validating ? t('clients.checkingButton') : t('clients.validateButton')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('clients.validateTooltip')}</TooltipContent>
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
  const { t } = useTranslation()
  const { clients, loading, detectAll, syncClient } = useClientsStore()
  const [syncingId, setSyncingId] = useState<ClientStatus['id'] | null>(null)
  const [validatingId, setValidatingId] = useState<ClientStatus['id'] | null>(null)
  const [createConfigClientId, setCreateConfigClientId] = useState<ClientStatus['id'] | null>(null)

  useEffect(() => {
    void detectAll()
  }, [detectAll])

  const handleSync = useCallback(
    async (
      clientId: ClientStatus['id'],
      options?: SyncClientOptions,
      interactive = true,
    ): Promise<SyncResult> => {
      setSyncingId(clientId)
      try {
        return await syncClient(clientId, options)
      } catch (err) {
        if (interactive && isConfigCreationRequiredError(err)) {
          const errorMessage = err instanceof Error ? err.message : t('common.error')
          setCreateConfigClientId(clientId)
          return {
            clientId,
            success: false,
            serversWritten: 0,
            errorCode: 'config_creation_required',
            error: errorMessage,
            syncedAt: new Date().toISOString(),
          }
        }
        const message = err instanceof Error ? err.message : t('common.error')
        toast.error(message)
        throw err
      } finally {
        setSyncingId(null)
      }
    },
    [syncClient, t],
  )

  const handleValidate = useCallback(
    async (clientId: ClientStatus['id']) => {
      setValidatingId(clientId)
      try {
        const result = await clientsService.validateConfig(clientId)
        if (result.valid) {
          toast.success(t('clients.configValid', { clientId }))
        } else {
          toast.warning(
            t('clients.configHasIssues', { clientId, errors: result.errors.join(', ') }),
          )
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t('common.error')
        toast.error(message)
      } finally {
        setValidatingId(null)
      }
    },
    [t],
  )

  const handleSyncAll = useCallback(async () => {
    const installed = clients.filter((c) => c.installed)
    const results: SyncResult[] = []
    for (const client of installed) {
      try {
        const result = await handleSync(client.id, undefined, false)
        results.push(result)
      } catch {
        results.push({
          clientId: client.id,
          success: false,
          serversWritten: 0,
          syncedAt: new Date().toISOString(),
        })
      }
    }
    const succeeded = results.filter((r) => r.success).length
    const failed = results.length - succeeded

    if (failed === 0) {
      toast.success(t('clients.allClientsSynced'))
      return
    }

    toast.warning(
      t('clients.syncSummary', {
        succeeded,
        total: results.length,
        failed,
        count: results.length,
      }),
    )
  }, [clients, handleSync, t])

  const installedCount = clients.filter((c) => c.installed).length
  const createConfigClient = clients.find((client) => client.id === createConfigClientId) ?? null

  const handleConfirmCreateConfig = useCallback(async () => {
    if (!createConfigClient) return
    try {
      await handleSync(createConfigClient.id, { allowCreateConfigIfMissing: true }, false)
    } catch {
      // Error toast is already handled in handleSync for non-interactive retries.
    } finally {
      setCreateConfigClientId(null)
    }
  }, [createConfigClient, handleSync])

  return (
    <main className="flex flex-col gap-6" data-testid="clients-page">
      <CreateConfigConfirmDialog
        open={createConfigClient !== null}
        clientName={createConfigClient?.displayName ?? ''}
        submitting={createConfigClient !== null && syncingId === createConfigClient.id}
        onCancel={() => setCreateConfigClientId(null)}
        onConfirm={() => void handleConfirmCreateConfig()}
      />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('clients.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? t('clients.detecting')
              : t('clients.installedCount', { installed: installedCount, total: clients.length })}
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
            {loading ? t('clients.detecting_button') : t('clients.refresh')}
          </Button>

          <Button
            type="button"
            onClick={() => void handleSyncAll()}
            disabled={loading || installedCount === 0}
            className="gap-1.5"
            data-testid="btn-sync-all"
          >
            <RefreshCw size={14} aria-hidden="true" />
            {t('clients.syncAll')}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table className="w-full text-sm" data-testid="clients-table">
          <TableHeader className="border-b bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                {t('clients.colClient')}
              </TableHead>
              <TableHead className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                {t('clients.colConfigPath')}
              </TableHead>
              <TableHead className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">
                {t('clients.colServers')}
              </TableHead>
              <TableHead className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                {t('clients.colStatus')}
              </TableHead>
              <TableHead className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                {t('clients.colLastSynced')}
              </TableHead>
              <TableHead className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                {t('clients.colActions')}
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
