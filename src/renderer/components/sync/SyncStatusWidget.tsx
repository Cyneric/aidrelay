/**
 * @file src/renderer/components/sync/SyncStatusWidget.tsx
 *
 * @created 17.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Compact sync status widget for the Dashboard page. Loads pending
 * setups and conflicts counts, shows a summary indicator, and opens the full
 * SyncCenterDialog on demand.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SyncCenterDialog } from '@/components/sync/SyncCenterDialog'
import { syncService } from '@/services/sync.service'
import { cn } from '@/lib/utils'

/**
 * Displays a compact sync status card with counts for pending setups, conflicts,
 * and push review items. Opens the full SyncCenterDialog when the user clicks
 * "View Details".
 */
const SyncStatusWidget = () => {
  const { t } = useTranslation()
  const [pendingCount, setPendingCount] = useState(0)
  const [conflictCount, setConflictCount] = useState(0)
  const [pushReviewCount, setPushReviewCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadCounts = useCallback(async () => {
    setLoading(true)
    try {
      const [pending, conflicts, pushReview] = await Promise.all([
        syncService.listPending().catch(() => []),
        syncService.listConflicts().catch(() => []),
        syncService.pushReview().catch(() => []),
      ])
      setPendingCount(pending.length)
      setConflictCount(conflicts.filter((c) => !c.resolved).length)
      setPushReviewCount(pushReview.length)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  const totalIssues = pendingCount + conflictCount + pushReviewCount
  const hasIssues = totalIssues > 0
  const isAllSynced = !loading && !hasIssues

  return (
    <>
      <Card
        className={cn(
          'gap-0 border-border/70 bg-surface-2 py-3 shadow-none',
          hasIssues && 'border-l-2 border-l-status-warn',
          isAllSynced && 'border-l-2 border-l-status-ok',
        )}
        data-testid="sync-status-widget"
      >
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {loading && (
              <RefreshCw
                size={16}
                className="shrink-0 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            )}
            {!loading && isAllSynced && (
              <CheckCircle2 size={16} className="shrink-0 text-status-success" aria-hidden="true" />
            )}
            {!loading && hasIssues && (
              <AlertTriangle size={16} className="shrink-0 text-status-warn" aria-hidden="true" />
            )}
            <div>
              <p className="text-sm font-medium text-text-primary" data-testid="sync-status-label">
                {loading
                  ? t('common.loading')
                  : isAllSynced
                    ? t('syncCenter.widgetAllSynced')
                    : t('syncCenter.widgetIssuesFound', { count: totalIssues })}
              </p>
              {!loading && hasIssues && (
                <p className="text-xs text-text-secondary" data-testid="sync-status-detail">
                  {t('syncCenter.widgetDetail', {
                    pending: pendingCount,
                    conflicts: conflictCount,
                    pushReview: pushReviewCount,
                  })}
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={loading}
            data-testid="sync-status-view-details"
          >
            {t('syncCenter.widgetViewDetails')}
          </Button>
        </div>
      </Card>

      <SyncCenterDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

export { SyncStatusWidget }
