/**
 * @file src/renderer/components/sync/SyncCenterDialog.tsx
 *
 * @created 17.03.2026
 * @modified 29.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Reusable Sync Center dialog. In inspection mode it exposes the
 * classic sync-center tabs plus the new Outgoing Writes Sync Plan tab. In
 * confirmation mode it focuses on the Sync Plan for one requested action and
 * optionally shows confirm/cancel actions.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { syncService } from '@/services/sync.service'
import { diagnosticsService } from '@/services/diagnostics.service'
import { SyncPlanView } from '@/components/sync/SyncPlanView'
import type { PendingSetup, SyncConflict, SyncPlanResult, SyncPlanScope } from '@shared/types'

interface SyncCenterDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly mode?: 'inspection' | 'confirmation'
  readonly scope?: SyncPlanScope
  readonly confirming?: boolean
  readonly onConfirm?: () => void
  readonly title?: string
  readonly description?: string
}

const NeedsSetupTab = ({
  pending,
  loading,
  onApply,
}: {
  readonly pending: PendingSetup[]
  readonly loading: boolean
  readonly onApply: (serverId: string) => void
}) => {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground" data-testid="needs-setup-loading">
        {t('common.loading')}
      </div>
    )
  }

  if (pending.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground" data-testid="needs-setup-empty">
        {t('syncCenter.needsSetupEmpty')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {pending.map((item) => (
        <div
          key={item.serverId}
          className="flex items-center justify-between rounded-lg border p-4"
          data-testid={`pending-setup-${item.serverId}`}
        >
          <div>
            <h3 className="font-medium">{item.serverName}</h3>
            <p className="text-sm text-muted-foreground">{t(`syncCenter.reason.${item.reason}`)}</p>
            {item.actions.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('syncCenter.actionsLabel')}: {item.actions.join(', ')}
              </p>
            ) : null}
          </div>
          <button
            onClick={() => onApply(item.serverId)}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            data-testid={`apply-pending-${item.serverId}`}
          >
            {t('syncCenter.apply')}
          </button>
        </div>
      ))}
    </div>
  )
}

const ConflictsTab = ({
  conflicts,
  loading,
  onResolve,
}: {
  readonly conflicts: SyncConflict[]
  readonly loading: boolean
  readonly onResolve: (conflictId: string, resolution: 'local' | 'remote') => void
}) => {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground" data-testid="conflicts-loading">
        {t('common.loading')}
      </div>
    )
  }

  if (conflicts.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground" data-testid="conflicts-empty">
        {t('syncCenter.conflictsEmpty')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {conflicts.map((conflict) => (
        <div
          key={conflict.id}
          className="rounded-lg border p-4"
          data-testid={`conflict-${conflict.id}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-medium">{conflict.serverName}</h3>
              <p className="text-sm text-muted-foreground">{conflict.field}</p>
            </div>
            {conflict.resolved ? (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                {t('syncCenter.resolved')}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('syncCenter.localValue')}
              </h4>
              <pre className="max-h-32 overflow-auto rounded border bg-muted/30 p-2 text-xs">
                {JSON.stringify(conflict.localValue, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('syncCenter.remoteValue')}
              </h4>
              <pre className="max-h-32 overflow-auto rounded border bg-muted/30 p-2 text-xs">
                {JSON.stringify(conflict.remoteValue, null, 2)}
              </pre>
            </div>
          </div>
          {!conflict.resolved ? (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onResolve(conflict.id, 'local')}
                className="rounded bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
                data-testid={`resolve-local-${conflict.id}`}
              >
                {t('syncCenter.keepLocal')}
              </button>
              <button
                onClick={() => onResolve(conflict.id, 'remote')}
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                data-testid={`resolve-remote-${conflict.id}`}
              >
                {t('syncCenter.useRemote')}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

const PushReviewTab = ({
  conflicts,
  loading,
  onResolve,
}: {
  readonly conflicts: SyncConflict[]
  readonly loading: boolean
  readonly onResolve: (conflictId: string, resolution: 'local' | 'remote') => void
}) => {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground" data-testid="push-review-loading">
        {t('common.loading')}
      </div>
    )
  }

  if (conflicts.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground" data-testid="push-review-empty">
        {t('syncCenter.pushReviewEmpty')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {conflicts.map((conflict) => (
        <div
          key={conflict.id}
          className="rounded-lg border p-4"
          data-testid={`push-review-${conflict.id}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-medium">{conflict.serverName}</h3>
              <p className="text-sm text-muted-foreground">{conflict.field}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('syncCenter.currentValue')}
              </h4>
              <pre className="max-h-32 overflow-auto rounded border bg-muted/30 p-2 text-xs">
                {JSON.stringify(conflict.localValue, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('syncCenter.pendingChange')}
              </h4>
              <pre className="max-h-32 overflow-auto rounded border bg-muted/30 p-2 text-xs">
                {JSON.stringify(conflict.remoteValue, null, 2)}
              </pre>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onResolve(conflict.id, 'local')}
              className="rounded bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              data-testid={`push-keep-local-${conflict.id}`}
            >
              {t('syncCenter.excludeFromPush')}
            </button>
            <button
              onClick={() => onResolve(conflict.id, 'remote')}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              data-testid={`push-confirm-${conflict.id}`}
            >
              {t('syncCenter.confirmPush')}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

const defaultScope: SyncPlanScope = { kind: 'app' }

const SyncCenterDialog = ({
  open,
  onOpenChange,
  mode = 'inspection',
  scope = defaultScope,
  confirming = false,
  onConfirm,
  title,
  description,
}: SyncCenterDialogProps) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<
    'needs-setup' | 'conflicts' | 'push-review' | 'outgoing-writes'
  >(mode === 'confirmation' ? 'outgoing-writes' : 'needs-setup')
  const [pending, setPending] = useState<PendingSetup[]>([])
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [pushReview, setPushReview] = useState<SyncConflict[]>([])
  const [syncPlan, setSyncPlan] = useState<SyncPlanResult | null>(null)
  const [loadingPending, setLoadingPending] = useState(false)
  const [loadingConflicts, setLoadingConflicts] = useState(false)
  const [loadingPushReview, setLoadingPushReview] = useState(false)
  const [loadingSyncPlan, setLoadingSyncPlan] = useState(false)

  const loadOverviewData = useCallback(async () => {
    if (mode !== 'inspection') return

    setLoadingPending(true)
    setLoadingConflicts(true)
    setLoadingPushReview(true)

    try {
      const [pendingData, conflictsData, pushData] = await Promise.all([
        syncService.listPending().catch(() => [] as PendingSetup[]),
        syncService.listConflicts().catch(() => [] as SyncConflict[]),
        syncService.pushReview().catch(() => [] as SyncConflict[]),
      ])
      setPending(pendingData)
      setConflicts(conflictsData)
      setPushReview(pushData)
    } finally {
      setLoadingPending(false)
      setLoadingConflicts(false)
      setLoadingPushReview(false)
    }
  }, [mode])

  const loadSyncPlan = useCallback(async () => {
    setLoadingSyncPlan(true)
    try {
      const result = await syncService.previewOutgoing(scope)
      setSyncPlan(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.error')
      toast.error(message)
      setSyncPlan(null)
    } finally {
      setLoadingSyncPlan(false)
    }
  }, [scope, t])

  useEffect(() => {
    if (!open) return
    setActiveTab(mode === 'confirmation' ? 'outgoing-writes' : 'needs-setup')
    void loadOverviewData()
    void loadSyncPlan()
  }, [loadOverviewData, loadSyncPlan, mode, open])

  const handleApplyPending = async (serverId: string) => {
    try {
      await syncService.applyPending(serverId)
      const data = await syncService.listPending()
      setPending(data)
    } catch (error) {
      console.error('Failed to apply pending setup:', error)
    }
  }

  const handleResolveConflict = async (conflictId: string, resolution: 'local' | 'remote') => {
    try {
      await syncService.resolveConflict(conflictId, resolution)
      const data = await syncService.listConflicts()
      setConflicts(data)
      const pushData = await syncService.pushReview()
      setPushReview(pushData)
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
    }
  }

  const handlePushResolve = async (conflictId: string, resolution: 'local' | 'remote') => {
    try {
      await syncService.resolveConflict(conflictId, resolution)
      const data = await syncService.pushReview()
      setPushReview(data)
    } catch (error) {
      console.error('Failed to resolve push review:', error)
    }
  }

  const handleCopyDiagnostics = async () => {
    try {
      const report = await diagnosticsService.generateReport()
      const json = JSON.stringify(report, null, 2)
      await navigator.clipboard.writeText(json)
      toast.success(t('syncCenter.copyDiagnosticsSuccess'))
    } catch (error) {
      console.error('Failed to copy diagnostics:', error)
      toast.error(t('syncCenter.copyDiagnosticsFailed'))
    }
  }

  const unresolvedConflictCount = conflicts.filter((c) => !c.resolved).length
  const dialogTitle =
    title ?? (mode === 'confirmation' ? t('syncCenter.syncPlanDialogTitle') : t('syncCenter.title'))
  const dialogDescription =
    description ??
    (mode === 'confirmation' ? t('syncCenter.syncPlanDialogDescription') : t('syncCenter.subtitle'))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-5xl max-h-[85vh] flex flex-col"
        data-testid="sync-center-dialog"
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </div>
            {mode === 'inspection' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleCopyDiagnostics()
                }}
                data-testid="copy-diagnostics-button"
              >
                {t('syncCenter.copyDiagnostics')}
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        {mode === 'inspection' ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as typeof activeTab)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="w-fit">
              <TabsTrigger value="needs-setup" data-testid="dialog-tab-needs-setup">
                {t('syncCenter.tabNeedsSetup')}
                {pending.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground">
                    {pending.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="conflicts" data-testid="dialog-tab-conflicts">
                {t('syncCenter.tabConflicts')}
                {unresolvedConflictCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground">
                    {unresolvedConflictCount}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="push-review" data-testid="dialog-tab-push-review">
                {t('syncCenter.tabPushReview')}
                {pushReview.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground">
                    {pushReview.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="outgoing-writes" data-testid="dialog-tab-outgoing-writes">
                {t('syncCenter.tabOutgoingWrites')}
                {syncPlan && syncPlan.totalFiles > 0 ? (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                    {syncPlan.totalFiles}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 flex-1 overflow-hidden">
              <TabsContent value="needs-setup" className="h-full overflow-auto">
                <NeedsSetupTab
                  pending={pending}
                  loading={loadingPending}
                  onApply={(serverId) => {
                    void handleApplyPending(serverId)
                  }}
                />
              </TabsContent>

              <TabsContent value="conflicts" className="h-full overflow-auto">
                <ConflictsTab
                  conflicts={conflicts}
                  loading={loadingConflicts}
                  onResolve={(conflictId, resolution) => {
                    void handleResolveConflict(conflictId, resolution)
                  }}
                />
              </TabsContent>

              <TabsContent value="push-review" className="h-full overflow-auto">
                <PushReviewTab
                  conflicts={pushReview}
                  loading={loadingPushReview}
                  onResolve={(conflictId, resolution) => {
                    void handlePushResolve(conflictId, resolution)
                  }}
                />
              </TabsContent>

              <TabsContent value="outgoing-writes" className="h-full overflow-auto">
                <SyncPlanView plan={syncPlan} loading={loadingSyncPlan} />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <div className="flex-1 overflow-hidden">
            <SyncPlanView plan={syncPlan} loading={loadingSyncPlan} />
          </div>
        )}

        {mode === 'confirmation' ? (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={confirming}
              data-testid="sync-plan-cancel"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={confirming || !syncPlan?.confirmable}
              data-testid="sync-plan-confirm"
            >
              {confirming ? t('common.loading') : t('syncCenter.syncPlanConfirm')}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export { SyncCenterDialog }
export type { SyncCenterDialogProps }
