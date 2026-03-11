/**
 * @file src/renderer/pages/SyncCenterPage.tsx
 *
 * @created 10.03.2026
 * @modified 11.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Cross-device sync coordination page. Shows three tabs:
 * "Needs Setup" (pending installations after sync), "Conflicts" (local/remote
 * conflicts), and "Push Review" (changes that will be pushed to the remote).
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { syncService } from '@/services/sync.service'
import { diagnosticsService } from '@/services/diagnostics.service'
import type { PendingSetup, SyncConflict } from '@shared/types'

// ─── Tab Components ────────────────────────────────────────────────────────────

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
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
  }

  if (pending.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
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
            {item.actions.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('syncCenter.actionsLabel')}: {item.actions.join(', ')}
              </p>
            )}
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
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
  }

  if (conflicts.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">{t('syncCenter.conflictsEmpty')}</div>
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
            {conflict.resolved && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                {t('syncCenter.resolved')}
              </span>
            )}
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
          {!conflict.resolved && (
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
          )}
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
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
  }

  if (conflicts.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

const SyncCenterPage = () => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'needs-setup' | 'conflicts' | 'push-review'>(
    'needs-setup',
  )
  const [pending, setPending] = useState<PendingSetup[]>([])
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [pushReview, setPushReview] = useState<SyncConflict[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [loadingConflicts, setLoadingConflicts] = useState(false)
  const [loadingPushReview, setLoadingPushReview] = useState(false)

  useEffect(() => {
    const loadPending = async () => {
      setLoadingPending(true)
      try {
        const data = await syncService.listPending()
        setPending(data)
      } catch (error) {
        console.error('Failed to load pending setups:', error)
      } finally {
        setLoadingPending(false)
      }
    }

    const loadConflicts = async () => {
      setLoadingConflicts(true)
      try {
        const data = await syncService.listConflicts()
        setConflicts(data)
      } catch (error) {
        console.error('Failed to load conflicts:', error)
      } finally {
        setLoadingConflicts(false)
      }
    }

    const loadPushReview = async () => {
      setLoadingPushReview(true)
      try {
        const data = await syncService.pushReview()
        setPushReview(data)
      } catch (error) {
        console.error('Failed to load push review:', error)
      } finally {
        setLoadingPushReview(false)
      }
    }

    void loadPending()
    void loadConflicts()
    void loadPushReview()
  }, [])

  const handleApplyPending = async (serverId: string) => {
    try {
      await syncService.applyPending(serverId)
      // Refresh pending list
      const data = await syncService.listPending()
      setPending(data)
    } catch (error) {
      console.error('Failed to apply pending setup:', error)
    }
  }

  const handleResolveConflict = async (conflictId: string, resolution: 'local' | 'remote') => {
    try {
      await syncService.resolveConflict(conflictId, resolution)
      // Refresh conflicts
      const data = await syncService.listConflicts()
      setConflicts(data)
      // Also refresh push review (since resolving a conflict may affect push review)
      const pushData = await syncService.pushReview()
      setPushReview(pushData)
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
    }
  }

  const handlePushResolve = async (conflictId: string, resolution: 'local' | 'remote') => {
    try {
      await syncService.resolveConflict(conflictId, resolution)
      // Refresh push review
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
      toast.success('Diagnostic report copied to clipboard')
    } catch (error) {
      console.error('Failed to copy diagnostics:', error)
      toast.error('Failed to copy diagnostics')
    }
  }

  return (
    <div className="flex h-full flex-col" data-testid="sync-center-page">
      <header className="border-b p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('syncCenter.title')}</h1>
            <p className="mt-1 text-muted-foreground">{t('syncCenter.subtitle')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void handleCopyDiagnostics()
            }}
            data-testid="copy-diagnostics-button"
          >
            Copy troubleshooting bundle
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-6">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          className="flex h-full flex-col"
        >
          <TabsList className="w-fit">
            <TabsTrigger value="needs-setup" data-testid="tab-needs-setup">
              {t('syncCenter.tabNeedsSetup')}
              {pending.length > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="conflicts" data-testid="tab-conflicts">
              {t('syncCenter.tabConflicts')}
              {conflicts.filter((c) => !c.resolved).length > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground">
                  {conflicts.filter((c) => !c.resolved).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="push-review" data-testid="tab-push-review">
              {t('syncCenter.tabPushReview')}
              {pushReview.length > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground">
                  {pushReview.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="needs-setup" className="flex-1 overflow-auto">
            <NeedsSetupTab
              pending={pending}
              loading={loadingPending}
              onApply={(serverId) => {
                void handleApplyPending(serverId)
              }}
            />
          </TabsContent>

          <TabsContent value="conflicts" className="flex-1 overflow-auto">
            <ConflictsTab
              conflicts={conflicts}
              loading={loadingConflicts}
              onResolve={(conflictId, resolution) => {
                void handleResolveConflict(conflictId, resolution)
              }}
            />
          </TabsContent>

          <TabsContent value="push-review" className="flex-1 overflow-auto">
            <PushReviewTab
              conflicts={pushReview}
              loading={loadingPushReview}
              onResolve={(conflictId, resolution) => {
                void handlePushResolve(conflictId, resolution)
              }}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export { SyncCenterPage }
