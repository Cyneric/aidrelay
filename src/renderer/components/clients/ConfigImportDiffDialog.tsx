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
import type { ConfigImportPreviewResult } from '@shared/types'

interface ConfigImportDiffDialogProps {
  readonly open: boolean
  readonly preview: ConfigImportPreviewResult | null
  readonly loading: boolean
  readonly importing: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

const prettyJson = (value: unknown): string => JSON.stringify(value ?? null, null, 2)

const ConfigImportDiffDialog = ({
  open,
  preview,
  loading,
  importing,
  onCancel,
  onConfirm,
}: ConfigImportDiffDialogProps) => {
  const { t } = useTranslation()

  const summary = useMemo(() => {
    const items = preview?.items ?? []
    return {
      create: items.filter((item) => item.action === 'create').length,
      overwrite: items.filter((item) => item.action === 'overwrite').length,
      removed: items.filter((item) => item.action === 'removed_external').length,
      noOp: items.filter((item) => item.action === 'no-op').length,
    }
  }, [preview?.items])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        className="max-w-5xl max-h-[85vh] flex flex-col"
        data-testid="config-import-diff-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('dashboard.configImportDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('dashboard.configImportDialogDescription', {
              count: preview?.items.length ?? 0,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" data-testid="config-import-summary-create">
            {t('dashboard.configImportSummaryCreate', { count: summary.create })}
          </Badge>
          <Badge variant="secondary" data-testid="config-import-summary-overwrite">
            {t('dashboard.configImportSummaryOverwrite', { count: summary.overwrite })}
          </Badge>
          <Badge variant="secondary" data-testid="config-import-summary-removed">
            {t('dashboard.configImportSummaryRemoved', { count: summary.removed })}
          </Badge>
          <Badge variant="outline" data-testid="config-import-summary-noop">
            {t('dashboard.configImportSummaryNoOp', { count: summary.noOp })}
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
                    <Badge variant={item.action === 'overwrite' ? 'destructive' : 'secondary'}>
                      {t(`dashboard.configImportAction.${item.action}`)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <section>
                      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('dashboard.configImportBefore')}
                      </h4>
                      <pre className="max-h-56 overflow-auto rounded border bg-muted/30 p-2 text-xs">
                        {prettyJson(item.before)}
                      </pre>
                    </section>
                    <section>
                      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('dashboard.configImportAfter')}
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
          <Button type="button" variant="outline" onClick={onCancel} disabled={importing}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={importing || !preview || loading}>
            {importing ? t('common.loading') : t('dashboard.importChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfigImportDiffDialog }
