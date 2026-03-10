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
  Check,
  X,
  RefreshCw,
  ShieldCheck,
  FileX2,
  FilePlus2,
  Download,
  Trash2,
  FolderInput,
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
import { ClientIcon } from '@/components/common/icons/ClientIcon'
import { CreateConfigConfirmDialog } from '@/components/clients/CreateConfigConfirmDialog'
import { SyncDiffDialog } from '@/components/clients/SyncDiffDialog'
import { SyncAllDiffDialog } from '@/components/clients/SyncAllDiffDialog'
import {
  InstallClientDialog,
  type InstallDialogPhase,
  type InstallTimelineEntry,
  type InstallTimelineStatus,
} from '@/components/clients/InstallClientDialog'
import { PathWithActions } from '@/components/common/PathWithActions'
import { isConfigCreationRequiredError } from '@/lib/sync-errors'
import { useClientsStore } from '@/stores/clients.store'
import { clientsService } from '@/services/clients.service'
import { dialogService } from '@/services/dialog.service'
import type { ClientInstallProgressPayload } from '@shared/channels'
import type {
  ClientInstallResult,
  ClientStatus,
  InstallManager,
  SyncClientOptions,
  SyncResult,
  SyncPreviewResult,
  SyncAllPreviewResult,
} from '@shared/types'

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
  readonly installing: boolean
  readonly discovering: boolean
  readonly clearingManualPath: boolean
  readonly validating: boolean
  readonly validationStatus: 'success' | 'failure' | undefined
  readonly onSync: (id: ClientStatus['id']) => void
  readonly onInstall: (id: ClientStatus['id']) => void
  readonly onDiscover: (id: ClientStatus['id']) => void
  readonly onClearManualPath: (id: ClientStatus['id']) => void
  readonly onCreateConfig: (id: ClientStatus['id']) => void
  readonly onValidate: (id: ClientStatus['id']) => void
}

/**
 * A single table row for one client.
 */
const ClientRow = ({
  client,
  syncing,
  installing,
  discovering,
  clearingManualPath,
  validating,
  validationStatus,
  onSync,
  onInstall,
  onDiscover,
  onClearManualPath,
  onCreateConfig,
  onValidate,
}: Readonly<RowProps>) => {
  const { t } = useTranslation()
  const metaBase = SYNC_STATUS_KEYS[client.syncStatus]
  const StatusIcon = metaBase.icon
  const meta = { ...metaBase, label: t(metaBase.labelKey as Parameters<typeof t>[0]) }
  const isFileBasedClient = client.id !== 'jetbrains'
  const hasConfig = client.configPaths.length > 0
  const hasManualConfigPath =
    typeof client.manualConfigPath === 'string' && client.manualConfigPath.length > 0
  const manualPathMissing = hasManualConfigPath && client.configPaths.length === 0
  const missingConfig = client.installed && client.configPaths.length === 0
  const showInstall = !client.installed

  return (
    <TableRow
      className={cn('border-b last:border-b-0 transition-colors')}
      data-testid={`client-row-${client.id}`}
    >
      {/* Name + install badge */}
      <TableCell className="px-2 py-2.5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5">
            <ClientIcon clientId={client.id} size={20} className="text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{client.displayName}</span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-xs',
                  client.installed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                )}
                data-testid={`client-install-${client.id}`}
              >
                {client.installed ? t('clients.installed') : t('clients.notInstalled')}
              </span>
            </div>
          </div>
        </div>
      </TableCell>

      {/* Config paths */}
      <TableCell className="px-2 py-2.5 max-w-[14rem]">
        {manualPathMissing ? (
          <div className="space-y-1" data-testid={`client-manual-path-stale-${client.id}`}>
            <p className="text-xs text-muted-foreground font-mono break-all">
              {client.manualConfigPath}
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <FileX2 size={13} aria-hidden="true" />
              {t('clients.manualPathMissing')}
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onClearManualPath(client.id)}
              disabled={clearingManualPath}
              data-testid={`btn-clear-manual-path-${client.id}`}
            >
              <Trash2 size={12} aria-hidden="true" />
              {t('clients.clearDiscoveredPathButton')}
            </Button>
          </div>
        ) : client.configPaths.length === 0 ? (
          missingConfig ? (
            <div className="space-y-1">
              <span
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                data-testid={`client-missing-config-path-${client.id}`}
              >
                <FileX2 size={13} aria-hidden="true" className="text-amber-500" />
                {t('clients.noConfigPath')}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="pull-right"
                onClick={() => onCreateConfig(client.id)}
                disabled={syncing}
                aria-label={t('clients.createConfigAria', { name: client.displayName })}
                data-testid={`btn-create-config-${client.id}`}
              >
                <FilePlus2 size={12} aria-hidden="true" />
                {t('clients.createConfigButton')}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )
        ) : (
          <ul className="space-y-0.5">
            {hasManualConfigPath && (
              <li className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {t('clients.manualPathActive')}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => onClearManualPath(client.id)}
                  disabled={clearingManualPath}
                  data-testid={`btn-clear-manual-path-${client.id}`}
                >
                  <Trash2 size={12} aria-hidden="true" />
                  {t('clients.clearDiscoveredPathButton')}
                </Button>
              </li>
            )}
            {client.configPaths.map((p, index) => (
              <li key={p} className="text-xs text-muted-foreground font-mono">
                <PathWithActions
                  path={p}
                  className="flex items-center gap-1 min-w-0"
                  textClassName="truncate flex-1"
                  testIdPrefix={`clients-config-path-${client.id}-${index}`}
                />
              </li>
            ))}
          </ul>
        )}
      </TableCell>

      {/* Servers */}
      <TableCell className="px-2 py-2.5 text-center">
        <span className="text-sm" data-testid={`client-server-count-${client.id}`}>
          {client.serverCount}
        </span>
      </TableCell>

      {/* Sync status */}
      <TableCell className="px-2 py-2.5">
        <span
          className={cn('inline-flex items-center gap-1 text-xs font-medium', meta.className)}
          data-testid={`client-sync-status-${client.id}`}
        >
          <StatusIcon size={13} aria-hidden="true" />
          {meta.label}
        </span>
      </TableCell>

      {/* Last synced */}
      <TableCell className="px-2 py-2.5">
        <span className="text-xs text-muted-foreground">
          {client.lastSyncedAt ? new Date(client.lastSyncedAt).toLocaleString() : '—'}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell className="px-2 py-2.5">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-xs"
                onClick={() => onSync(client.id)}
                disabled={!client.installed || syncing || missingConfig}
                aria-label={t('clients.syncTooltip', { name: client.displayName })}
                data-testid={`btn-sync-${client.id}`}
              >
                <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {!client.installed
                ? client.id === 'codex-gui'
                  ? t('clients.notInstalledCodexGuiTooltip', { name: client.displayName })
                  : t('clients.notInstalledTooltip', { name: client.displayName })
                : missingConfig
                  ? t('clients.syncDisabledMissingConfigTooltip', { name: client.displayName })
                  : t('clients.syncTooltip', { name: client.displayName })}
            </TooltipContent>
          </Tooltip>

          {isFileBasedClient ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  onClick={() => onDiscover(client.id)}
                  disabled={discovering}
                  aria-label={t('clients.discoverAria', { name: client.displayName })}
                  data-testid={`btn-discover-${client.id}`}
                >
                  <FolderInput size={11} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('clients.discoverTooltip')}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="inline-flex size-6" aria-hidden="true" />
          )}

          {showInstall ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-xs"
                  onClick={() => onInstall(client.id)}
                  disabled={installing}
                  className="bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400"
                  aria-label={t('clients.installAria', { name: client.displayName })}
                  data-testid={`btn-install-${client.id}`}
                >
                  <Download size={11} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('clients.installTooltip')}</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  onClick={() => onValidate(client.id)}
                  disabled={validating || !hasConfig}
                  aria-label={t('clients.validateClientAria', { name: client.displayName })}
                  data-testid={`btn-validate-${client.id}`}
                >
                  <ShieldCheck size={11} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {hasConfig
                  ? t('clients.validateTooltip')
                  : t('clients.validateDisabledMissingConfigTooltip')}
              </TooltipContent>
            </Tooltip>
          )}

          {validationStatus === 'success' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center text-green-600 dark:text-green-400"
                  data-testid={`validation-status-${client.id}-success`}
                  aria-label={t('clients.validationStatusSuccessAria')}
                >
                  <Check size={12} aria-hidden="true" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('clients.validationStatusSuccessTooltip')}</TooltipContent>
            </Tooltip>
          )}

          {validationStatus === 'failure' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center text-red-600 dark:text-red-400"
                  data-testid={`validation-status-${client.id}-failure`}
                  aria-label={t('clients.validationStatusFailureAria')}
                >
                  <X size={12} aria-hidden="true" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('clients.validationStatusFailureTooltip')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ValidationStatus = 'success' | 'failure'

const MANAGER_LABEL_KEYS = {
  winget: 'clients.installProgress.manager.winget',
  choco: 'clients.installProgress.manager.choco',
  npm: 'clients.installProgress.manager.npm',
  manual: 'clients.installProgress.manager.manual',
} as const satisfies Record<InstallManager, string>

const OFFICIAL_INSTALL_URLS: Readonly<Record<ClientStatus['id'], string>> = {
  cursor: 'https://www.cursor.com/downloads',
  'claude-desktop': 'https://claude.ai/download',
  'claude-code': 'https://docs.anthropic.com/en/docs/claude-code/overview',
  vscode: 'https://code.visualstudio.com/download',
  'vscode-insiders': 'https://code.visualstudio.com/insiders',
  windsurf: 'https://codeium.com/windsurf',
  zed: 'https://zed.dev/download',
  jetbrains: 'https://www.jetbrains.com/toolbox-app/',
  'gemini-cli': 'https://github.com/google-gemini/gemini-cli',
  'codex-cli': 'https://github.com/openai/codex',
  'codex-gui': 'https://apps.microsoft.com/detail/9PLM9XGG6VKS',
  opencode: 'https://opencode.ai/',
  'visual-studio': 'https://visualstudio.microsoft.com/vs/community/',
}

const PROGRESS_PHASE_TO_TIMELINE_STATUS: Partial<
  Record<ClientInstallProgressPayload['phase'], InstallTimelineStatus>
> = {
  manager_check: 'pending',
  manager_running: 'running',
  manager_skipped: 'skipped',
  manager_failed: 'failed',
  manager_succeeded: 'success',
}

const buildTimelineFromProgress = (
  previousTimeline: readonly InstallTimelineEntry[],
  payload: ClientInstallProgressPayload,
): InstallTimelineEntry[] => {
  const nextTimeline = [...previousTimeline]
  const expectedAttempts = Math.max(payload.attemptCount, nextTimeline.length)

  for (let attemptIndex = 1; attemptIndex <= expectedAttempts; attemptIndex += 1) {
    if (!nextTimeline[attemptIndex - 1]) {
      nextTimeline[attemptIndex - 1] = {
        attemptIndex,
        status: 'pending',
      }
    }
  }

  if (payload.attemptIndex > 0 && payload.attemptIndex <= expectedAttempts) {
    const arrayIndex = payload.attemptIndex - 1
    const current = nextTimeline[arrayIndex] ?? {
      attemptIndex: payload.attemptIndex,
      status: 'pending' as const,
    }
    const nextStatus = PROGRESS_PHASE_TO_TIMELINE_STATUS[payload.phase] ?? current.status
    const resolvedManager = payload.manager ?? current.manager
    nextTimeline[arrayIndex] = {
      attemptIndex: payload.attemptIndex,
      status: nextStatus,
      ...(resolvedManager ? { manager: resolvedManager } : {}),
    }
  }

  return nextTimeline
}

/**
 * Client management page. Shows all supported AI tool clients with their
 * status, config paths, server counts, and sync/validate actions.
 */
const ClientsPage = () => {
  const { t } = useTranslation()
  const { clients, loading, detectAll, syncClient } = useClientsStore()
  const [syncingId, setSyncingId] = useState<ClientStatus['id'] | null>(null)
  const [syncPreviewClientId, setSyncPreviewClientId] = useState<ClientStatus['id'] | null>(null)
  const [syncPreviewResult, setSyncPreviewResult] = useState<SyncPreviewResult | null>(null)
  const [syncPreviewOptions, setSyncPreviewOptions] = useState<SyncClientOptions | undefined>(
    undefined,
  )
  const [syncPreviewLoading, setSyncPreviewLoading] = useState(false)
  const [syncAllPreviewResult, setSyncAllPreviewResult] = useState<SyncAllPreviewResult | null>(
    null,
  )
  const [syncAllPreviewLoading, setSyncAllPreviewLoading] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [installingId, setInstallingId] = useState<ClientStatus['id'] | null>(null)
  const [discoveringId, setDiscoveringId] = useState<ClientStatus['id'] | null>(null)
  const [clearingManualPathId, setClearingManualPathId] = useState<ClientStatus['id'] | null>(null)
  const [validatingId, setValidatingId] = useState<ClientStatus['id'] | null>(null)
  const [validationStatusByClientId, setValidationStatusByClientId] = useState<
    Partial<Record<ClientStatus['id'], ValidationStatus>>
  >({})
  const [createConfigClientId, setCreateConfigClientId] = useState<ClientStatus['id'] | null>(null)
  const [installClientId, setInstallClientId] = useState<ClientStatus['id'] | null>(null)
  const [installDialogPhase, setInstallDialogPhase] = useState<InstallDialogPhase>('confirm')
  const [installProgressValue, setInstallProgressValue] = useState(0)
  const [installStepText, setInstallStepText] = useState('')
  const [installTimeline, setInstallTimeline] = useState<InstallTimelineEntry[]>([])
  const [installResult, setInstallResult] = useState<ClientInstallResult | undefined>(undefined)
  const [installErrorMessage, setInstallErrorMessage] = useState<string | undefined>(undefined)

  useEffect(() => {
    void detectAll()
  }, [detectAll])

  const performSync = useCallback(
    async (clientId: ClientStatus['id'], options?: SyncClientOptions): Promise<SyncResult> => {
      setSyncingId(clientId)
      try {
        return await syncClient(clientId, options)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('common.error')
        toast.error(message)
        throw err
      } finally {
        setSyncingId(null)
      }
    },
    [syncClient, t],
  )

  const handleSync = useCallback(
    async (clientId: ClientStatus['id'], options?: SyncClientOptions) => {
      setSyncPreviewClientId(clientId)
      setSyncPreviewOptions(options)
      setSyncPreviewLoading(true)
      try {
        const preview = await clientsService.previewSync(clientId, options)
        setSyncPreviewResult(preview)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('common.error')
        // If config is missing, show the create config dialog (same as before)
        if (isConfigCreationRequiredError(err)) {
          setCreateConfigClientId(clientId)
        } else {
          toast.error(message)
        }
        setSyncPreviewClientId(null)
        setSyncPreviewResult(null)
      } finally {
        setSyncPreviewLoading(false)
      }
    },
    [t],
  )

  const handleConfirmSync = useCallback(async () => {
    if (!syncPreviewClientId) return
    try {
      await performSync(syncPreviewClientId, syncPreviewOptions)
      // Sync succeeded, close the preview dialog
      setSyncPreviewClientId(null)
      setSyncPreviewResult(null)
      setSyncPreviewOptions(undefined)
    } catch {
      // Error toast is already handled in performSync.
      // Keep the preview dialog open so user can retry
    }
  }, [syncPreviewClientId, syncPreviewOptions, performSync])

  const handleSyncAll = useCallback(async () => {
    setSyncAllPreviewLoading(true)
    try {
      const preview = await clientsService.previewSyncAll()
      setSyncAllPreviewResult(preview)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast.error(message)
      setSyncAllPreviewResult(null)
    } finally {
      setSyncAllPreviewLoading(false)
    }
  }, [t])

  const handleConfirmSyncAll = useCallback(async () => {
    setSyncingAll(true)
    try {
      await clientsService.syncAll()
      // Sync succeeded, close the preview dialog
      setSyncAllPreviewResult(null)
      // Refresh client list
      await detectAll()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast.error(message)
      // Keep the preview dialog open so user can retry
    } finally {
      setSyncingAll(false)
    }
  }, [detectAll, t])

  const getClientDisplayName = useCallback(
    (clientId: ClientStatus['id']): string =>
      clients.find((client) => client.id === clientId)?.displayName ?? clientId,
    [clients],
  )

  const resetInstallDialogState = useCallback(() => {
    setInstallDialogPhase('confirm')
    setInstallProgressValue(0)
    setInstallStepText('')
    setInstallTimeline([])
    setInstallResult(undefined)
    setInstallErrorMessage(undefined)
  }, [])

  const managerLabel = useCallback(
    (manager: InstallManager | undefined): string => {
      if (!manager) return t(MANAGER_LABEL_KEYS.manual)
      return t(MANAGER_LABEL_KEYS[manager])
    },
    [t],
  )

  const getInstallStepText = useCallback(
    (payload: ClientInstallProgressPayload): string => {
      const manager = managerLabel(payload.manager)
      const context = {
        manager,
        current: payload.attemptIndex,
        total: payload.attemptCount,
      }

      switch (payload.phase) {
        case 'start':
          return t('clients.installProgress.phase.start')
        case 'manager_check':
          return t('clients.installProgress.phase.managerCheck', context)
        case 'manager_running':
          return t('clients.installProgress.phase.managerRunning', context)
        case 'manager_skipped':
          return t('clients.installProgress.phase.managerSkipped', context)
        case 'manager_failed':
          return t('clients.installProgress.phase.managerFailed', context)
        case 'manager_succeeded':
          return t('clients.installProgress.phase.managerSucceeded', context)
        case 'completed':
          return payload.failureReason
            ? t('clients.installProgress.phase.completedFailure')
            : t('clients.installProgress.phase.completedSuccess')
        default:
          return t('clients.installProgress.phase.start')
      }
    },
    [managerLabel, t],
  )

  useEffect(() => {
    const unsubscribe = clientsService.onInstallProgress((payload) => {
      if (!installClientId || payload.clientId !== installClientId) return

      setInstallDialogPhase((previous) => (previous === 'done' ? previous : 'running'))
      setInstallProgressValue((previous) => Math.max(previous, payload.progress))
      setInstallStepText(getInstallStepText(payload))
      setInstallTimeline((previous) => buildTimelineFromProgress(previous, payload))
    })

    return unsubscribe
  }, [getInstallStepText, installClientId])

  const handleDiscover = useCallback(
    async (clientId: ClientStatus['id']) => {
      if (clientId === 'jetbrains') return

      setDiscoveringId(clientId)
      try {
        const selected = await dialogService.showOpen({
          properties: ['openFile'],
          title: t('clients.discoverDialogTitle', { name: getClientDisplayName(clientId) }),
        })
        const configPath = selected.filePaths[0]
        if (selected.canceled || !configPath) return

        const validation = await clientsService.setManualConfigPath(clientId, configPath)
        if (!validation.valid) {
          toast.warning(t('clients.discoverInvalid', { errors: validation.errors.join(', ') }))
          return
        }

        toast.success(t('clients.discoverSaved', { name: getClientDisplayName(clientId) }))
        await detectAll()
      } catch (err) {
        const message = err instanceof Error ? err.message : t('common.error')
        toast.error(message)
      } finally {
        setDiscoveringId(null)
      }
    },
    [detectAll, getClientDisplayName, t],
  )

  const handleClearManualPath = useCallback(
    async (clientId: ClientStatus['id']) => {
      setClearingManualPathId(clientId)
      try {
        await clientsService.clearManualConfigPath(clientId)
        toast.success(t('clients.discoverCleared', { name: getClientDisplayName(clientId) }))
        await detectAll()
      } catch (err) {
        const message = err instanceof Error ? err.message : t('common.error')
        toast.error(message)
      } finally {
        setClearingManualPathId(null)
      }
    },
    [detectAll, getClientDisplayName, t],
  )

  const handleValidate = useCallback(
    async (clientId: ClientStatus['id']) => {
      setValidatingId(clientId)
      try {
        const result = await clientsService.validateConfig(clientId)
        if (result.valid) {
          setValidationStatusByClientId((prev) => ({ ...prev, [clientId]: 'success' }))
          toast.success(t('clients.configValid', { clientId }))
        } else {
          setValidationStatusByClientId((prev) => ({ ...prev, [clientId]: 'failure' }))
          toast.warning(
            t('clients.configHasIssues', { clientId, errors: result.errors.join(', ') }),
          )
        }
      } catch (err) {
        setValidationStatusByClientId((prev) => ({ ...prev, [clientId]: 'failure' }))
        const message = err instanceof Error ? err.message : t('common.error')
        toast.error(message)
      } finally {
        setValidatingId(null)
      }
    },
    [t],
  )

  const installedCount = clients.filter((c) => c.installed).length
  const createConfigClient = clients.find((client) => client.id === createConfigClientId) ?? null
  const installClient = clients.find((client) => client.id === installClientId) ?? null
  const officialInstallUrl = installClient ? OFFICIAL_INSTALL_URLS[installClient.id] : undefined

  const handleConfirmCreateConfig = useCallback(async () => {
    if (!createConfigClient) return
    try {
      await performSync(createConfigClient.id, { allowCreateConfigIfMissing: true })
    } catch {
      // Error toast is already handled in handleSync.
    } finally {
      setCreateConfigClientId(null)
    }
  }, [createConfigClient, performSync])

  const handleConfirmInstall = useCallback(async () => {
    if (!installClient) return

    setInstallingId(installClient.id)
    setInstallDialogPhase('running')
    setInstallProgressValue(1)
    setInstallStepText(t('clients.installProgress.phase.start'))
    setInstallTimeline([])
    setInstallResult(undefined)
    setInstallErrorMessage(undefined)

    try {
      const result = await clientsService.install(installClient.id)
      setInstallResult(result)
      setInstallDialogPhase('done')
      setInstallStepText(
        result.success
          ? t('clients.installProgress.phase.completedSuccess')
          : t('clients.installProgress.phase.completedFailure'),
      )
      setInstallProgressValue(100)

      if (result.success) {
        toast.success(
          t('clients.installSuccess', {
            name: installClient.displayName,
            manager: result.installedWith ?? 'unknown',
          }),
        )
      } else if (result.docsUrl) {
        toast.warning(
          t('clients.installFailedWithDocs', {
            name: installClient.displayName,
            reason: result.message,
            url: result.docsUrl,
          }),
        )
      } else {
        toast.warning(
          t('clients.installFailed', {
            name: installClient.displayName,
            reason: result.message,
          }),
        )
      }

      await detectAll()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      setInstallDialogPhase('done')
      setInstallProgressValue(100)
      setInstallStepText(t('clients.installProgress.phase.completedFailure'))
      setInstallErrorMessage(message)
      toast.error(message)
    } finally {
      setInstallingId(null)
    }
  }, [detectAll, installClient, t])

  const handleOpenInstallDialog = useCallback(
    (clientId: ClientStatus['id']) => {
      resetInstallDialogState()
      setInstallClientId(clientId)
    },
    [resetInstallDialogState],
  )

  const handleCancelInstallDialog = useCallback(() => {
    if (installDialogPhase === 'running') return
    setInstallClientId(null)
    resetInstallDialogState()
  }, [installDialogPhase, resetInstallDialogState])

  const handleDoneInstallDialog = useCallback(() => {
    setInstallClientId(null)
    resetInstallDialogState()
  }, [resetInstallDialogState])

  const handleOpenOfficialDownload = useCallback(() => {
    if (!installClient) return
    const targetUrl = installResult?.docsUrl ?? OFFICIAL_INSTALL_URLS[installClient.id]
    if (!targetUrl) return

    window.open(targetUrl, '_blank', 'noopener,noreferrer')

    if (installDialogPhase === 'confirm') {
      setInstallClientId(null)
      resetInstallDialogState()
    }
  }, [installClient, installDialogPhase, installResult?.docsUrl, resetInstallDialogState])

  return (
    <main className="flex flex-col gap-6" data-testid="clients-page">
      <CreateConfigConfirmDialog
        open={createConfigClient !== null}
        clientName={createConfigClient?.displayName ?? ''}
        submitting={createConfigClient !== null && syncingId === createConfigClient.id}
        onCancel={() => setCreateConfigClientId(null)}
        onConfirm={() => void handleConfirmCreateConfig()}
      />
      <InstallClientDialog
        open={installClient !== null}
        phase={installDialogPhase}
        clientName={installClient?.displayName ?? ''}
        progress={installProgressValue}
        stepText={installStepText}
        timeline={installTimeline}
        onCancel={handleCancelInstallDialog}
        onOfficialDownload={handleOpenOfficialDownload}
        onConfirm={() => void handleConfirmInstall()}
        onDone={handleDoneInstallDialog}
        {...(officialInstallUrl ? { officialUrl: officialInstallUrl } : {})}
        {...(installResult ? { result: installResult } : {})}
        {...(installErrorMessage ? { errorMessage: installErrorMessage } : {})}
      />
      <SyncDiffDialog
        open={syncPreviewClientId !== null}
        preview={syncPreviewResult}
        loading={syncPreviewLoading}
        syncing={syncingId === syncPreviewClientId}
        onCancel={() => {
          setSyncPreviewClientId(null)
          setSyncPreviewResult(null)
          setSyncPreviewOptions(undefined)
        }}
        onConfirm={() => void handleConfirmSync()}
      />
      <SyncAllDiffDialog
        open={syncAllPreviewResult !== null}
        preview={syncAllPreviewResult}
        loading={syncAllPreviewLoading}
        syncing={syncingAll}
        onCancel={() => {
          setSyncAllPreviewResult(null)
        }}
        onConfirm={() => void handleConfirmSyncAll()}
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
              <TableHead className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                {t('clients.colClient')}
              </TableHead>
              <TableHead className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                {t('clients.colConfigPath')}
              </TableHead>
              <TableHead className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                {t('clients.colServers')}
              </TableHead>
              <TableHead className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                {t('clients.colStatus')}
              </TableHead>
              <TableHead className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                {t('clients.colLastSynced')}
              </TableHead>
              <TableHead className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                {t('clients.colActions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && clients.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="border-b last:border-b-0">
                    <TableCell colSpan={6} className="px-2 py-2.5">
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
                    installing={installingId === client.id}
                    discovering={discoveringId === client.id}
                    clearingManualPath={clearingManualPathId === client.id}
                    validating={validatingId === client.id}
                    validationStatus={validationStatusByClientId[client.id]}
                    onSync={(id) => void handleSync(id)}
                    onInstall={handleOpenInstallDialog}
                    onDiscover={(id) => void handleDiscover(id)}
                    onClearManualPath={(id) => void handleClearManualPath(id)}
                    onCreateConfig={(id) => setCreateConfigClientId(id)}
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
