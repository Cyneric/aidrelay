/**
 * @file src/renderer/components/clients/SyncAllDiffDialog.tsx
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Dialog that shows a side‑by‑side diff of what will change when
 * syncing all clients. Uses tabs for each client, each tab shows the same
 * diff layout as SyncDiffDialog.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
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
import { PathWithActions } from '@/components/common/PathWithActions'
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
  const copyConfigPath = async (path: string) => {
    if (!path) return
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable')
      }
      await navigator.clipboard.writeText(path)
      toast.success(t('dashboard.copyConfigPathSuccess'))
    } catch {
      toast.error(t('dashboard.copyConfigPathFailed'))
    }
  }

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
          <Badge variant="outline" data-testid="sync-all-preview-summary-files">
            {t('dashboard.syncPreviewFilesToChange', { count: clientPreviews.length })}
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
                  <section className="rounded-md border border-border/70 bg-surface-2 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      {t('dashboard.syncPreviewTargetFile')}
                    </p>
                    {clientPreview.configPath ? (
                      <div className="mt-1 flex items-center gap-2">
                        <PathWithActions
                          path={clientPreview.configPath}
                          className="flex min-w-0 items-center gap-1"
                          textClassName="flex-1 break-all text-xs text-text-primary"
                          allowEdit={false}
                          testIdPrefix={`sync-all-preview-config-path-${clientId}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          onClick={() => void copyConfigPath(clientPreview.configPath)}
                          aria-label={t('dashboard.copyConfigPath')}
                          data-testid={`sync-all-preview-config-path-copy-${clientId}`}
                        >
                          <Copy size={12} aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-text-secondary">
                        {t('dashboard.syncPreviewNoPath')}
                      </p>
                    )}
                  </section>
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
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={syncing}
            data-testid="sync-all-preview-cancel"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={syncing || !preview || loading}
            data-testid="sync-all-preview-confirm"
          >
            {syncing ? t('common.loading') : t('clients.syncAll')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { SyncAllDiffDialog }
