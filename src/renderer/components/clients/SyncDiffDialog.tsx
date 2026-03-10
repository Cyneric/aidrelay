/**
 * @file src/renderer/components/clients/SyncDiffDialog.tsx
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Dialog that shows a side‑by‑side diff of what will change when
 * syncing a client config. Reuses the layout of ConfigImportDiffDialog with
 * sync‑specific translation keys and the extended action set.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SyncPreviewResult } from '@shared/types'

interface SyncDiffDialogProps {
  readonly open: boolean
  readonly preview: SyncPreviewResult | null
  readonly loading: boolean
  readonly syncing: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

const prettyJson = (value: unknown): string => JSON.stringify(value ?? null, null, 2)

const SyncDiffDialog = ({
  open,
  preview,
  loading,
  syncing,
  onCancel,
  onConfirm,
}: SyncDiffDialogProps) => {
  const { t } = useTranslation()

  const summary = useMemo(() => {
    const items = preview?.items ?? []
    return {
      create: items.filter((item) => item.action === 'create').length,
      overwrite: items.filter((item) => item.action === 'overwrite').length,
      removed: items.filter((item) => item.action === 'removed').length,
      noOp: items.filter((item) => item.action === 'no-op').length,
      preserved: items.filter((item) => item.action === 'preserved_unmanaged').length,
    }
  }, [preview?.items])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        className="max-w-5xl max-h-[85vh] flex flex-col"
        data-testid="sync-diff-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('dashboard.syncPreviewDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('dashboard.syncPreviewDialogDescription', {
              count: preview?.items.length ?? 0,
              client: preview?.clientId ?? '',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" data-testid="sync-preview-summary-create">
            {t('dashboard.syncPreviewSummaryCreate', { count: summary.create })}
          </Badge>
          <Badge variant="secondary" data-testid="sync-preview-summary-overwrite">
            {t('dashboard.syncPreviewSummaryOverwrite', { count: summary.overwrite })}
          </Badge>
          <Badge variant="secondary" data-testid="sync-preview-summary-removed">
            {t('dashboard.syncPreviewSummaryRemoved', { count: summary.removed })}
          </Badge>
          <Badge variant="secondary" data-testid="sync-preview-summary-preserved">
            {t('dashboard.syncPreviewSummaryPreserved', { count: summary.preserved })}
          </Badge>
          <Badge variant="outline" data-testid="sync-preview-summary-noop">
            {t('dashboard.syncPreviewSummaryNoOp', { count: summary.noOp })}
          </Badge>
        </div>

        <ScrollArea className="flex-1 border rounded-md p-3 bg-muted/20">
          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : (
              (preview?.items ?? []).map((item) => (
                <article key={item.name} className="rounded-md border p-3 bg-background">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="font-mono text-sm">{item.name}</div>
                    <Badge
                      variant={
                        item.action === 'overwrite'
                          ? 'destructive'
                          : item.action === 'removed'
                            ? 'destructive'
                            : item.action === 'preserved_unmanaged'
                              ? 'outline'
                              : 'secondary'
                      }
                    >
                      {t(`dashboard.syncPreviewAction.${item.action}`)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <section>
                      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('dashboard.syncPreviewBefore')}
                      </h4>
                      <pre className="max-h-56 overflow-auto rounded border bg-muted/30 p-2 text-xs">
                        {prettyJson(item.before)}
                      </pre>
                    </section>
                    <section>
                      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('dashboard.syncPreviewAfter')}
                      </h4>
                      <pre className="max-h-56 overflow-auto rounded border bg-muted/30 p-2 text-xs">
                        {prettyJson(item.after)}
                      </pre>
                    </section>
                  </div>
                </article>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={syncing}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={syncing || !preview || loading}>
            {syncing ? t('common.loading') : t('clients.sync')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { SyncDiffDialog }
