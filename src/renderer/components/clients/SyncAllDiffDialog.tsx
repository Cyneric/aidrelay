/**
 * @file src/renderer/components/clients/SyncAllDiffDialog.tsx
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Dialog that shows a side‑by‑side diff of what will change when
 * syncing all clients. Uses tabs for each client, each tab shows the same
 * diff layout as SyncDiffDialog.
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ClientId, SyncAllPreviewResult } from '@shared/types'

interface SyncAllDiffDialogProps {
  readonly open: boolean
  readonly preview: SyncAllPreviewResult | null
  readonly loading: boolean
  readonly syncing: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

const prettyJson = (value: unknown): string => JSON.stringify(value ?? null, null, 2)

const SyncAllDiffDialog = ({
  open,
  preview,
  loading,
  syncing,
  onCancel,
  onConfirm,
}: SyncAllDiffDialogProps) => {
  const { t } = useTranslation()

  const clientPreviews = useMemo(() => {
    if (!preview?.previews) return []
    return Object.entries(preview.previews)
      .filter(
        (entry): entry is [ClientId, NonNullable<(typeof entry)[1]>] => entry[1] !== undefined,
      )
      .map(([clientId, clientPreview]) => ({
        clientId,
        preview: clientPreview,
      }))
  }, [preview])

  const totalSummary = useMemo(() => {
    const summary = {
      create: 0,
      overwrite: 0,
      removed: 0,
      noOp: 0,
      preserved: 0,
    }
    clientPreviews.forEach(({ preview: clientPreview }) => {
      clientPreview.items.forEach((item) => {
        switch (item.action) {
          case 'create':
            summary.create += 1
            break
          case 'overwrite':
            summary.overwrite += 1
            break
          case 'removed':
            summary.removed += 1
            break
          case 'no-op':
            summary.noOp += 1
            break
          case 'preserved_unmanaged':
            summary.preserved += 1
            break
        }
      })
    })
    return summary
  }, [clientPreviews])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        className="max-w-5xl max-h-[85vh] flex flex-col"
        data-testid="sync-all-diff-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('dashboard.syncPreviewAllDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('dashboard.syncPreviewAllDialogDescription', {
              clientCount: clientPreviews.length,
              totalItems: clientPreviews.reduce((acc, { preview: p }) => acc + p.items.length, 0),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" data-testid="sync-all-preview-summary-create">
            {t('dashboard.syncPreviewSummaryCreate', { count: totalSummary.create })}
          </Badge>
          <Badge variant="secondary" data-testid="sync-all-preview-summary-overwrite">
            {t('dashboard.syncPreviewSummaryOverwrite', { count: totalSummary.overwrite })}
          </Badge>
          <Badge variant="secondary" data-testid="sync-all-preview-summary-removed">
            {t('dashboard.syncPreviewSummaryRemoved', { count: totalSummary.removed })}
          </Badge>
          <Badge variant="secondary" data-testid="sync-all-preview-summary-preserved">
            {t('dashboard.syncPreviewSummaryPreserved', { count: totalSummary.preserved })}
          </Badge>
          <Badge variant="outline" data-testid="sync-all-preview-summary-noop">
            {t('dashboard.syncPreviewSummaryNoOp', { count: totalSummary.noOp })}
          </Badge>
        </div>

        <Tabs defaultValue={clientPreviews[0]?.clientId ?? ''} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start">
            {clientPreviews.map(({ clientId, preview: clientPreview }) => (
              <TabsTrigger key={clientId} value={clientId}>
                {clientId}
                <Badge variant="outline" className="ml-1.5 text-xs">
                  {clientPreview.items.length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          {clientPreviews.map(({ clientId, preview: clientPreview }) => (
            <TabsContent key={clientId} value={clientId} className="flex-1 overflow-hidden">
              <ScrollArea className="flex-1 border rounded-md p-3 bg-muted/20">
                <div className="space-y-4">
                  {clientPreview.items.map((item) => (
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
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={syncing}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={syncing || !preview || loading}>
            {syncing ? t('common.loading') : t('clients.syncAll')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { SyncAllDiffDialog }
