/**
 * @file src/renderer/components/history/BackupTimeline.tsx
 *
 * @created 07.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Filter-aware, paged backup timeline for one client. Includes
 * metadata summary, load-more pagination, and a restore preview dialog.
 */

import { useState, useEffect, useCallback, useMemo, type ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, RotateCcw, Shield, RefreshCw, Clock } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PathWithActions } from '@/components/common/PathWithActions'
import { backupsService } from '@/services/backups.service'
import type { BackupEntry, BackupQueryFilters, RestorePreviewResult } from '@shared/channels'
import type { ClientId } from '@shared/types'

const PAGE_SIZE = 25

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const relativeTime = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const BACKUP_TYPE_META: Record<
  BackupEntry['backupType'],
  { labelKey: string; icon: ElementType; className: string; descriptionKey: string }
> = {
  pristine: {
    labelKey: 'history.backupTypePristine',
    icon: Shield,
    className: 'text-blue-600 dark:text-blue-400',
    descriptionKey: 'history.backupDescPristine',
  },
  sync: {
    labelKey: 'history.backupTypeSync',
    icon: RefreshCw,
    className: 'text-muted-foreground',
    descriptionKey: 'history.backupDescSync',
  },
  manual: {
    labelKey: 'history.backupTypeManual',
    icon: Clock,
    className: 'text-amber-600 dark:text-amber-400',
    descriptionKey: 'history.backupDescManual',
  },
}

type DensityMode = 'comfortable' | 'compact'

interface TimelineFilters {
  readonly search?: string
  readonly types: readonly BackupEntry['backupType'][]
  readonly from?: string
  readonly to?: string
  readonly sort: 'newest' | 'oldest'
}

interface Props {
  readonly clientId: ClientId
  readonly clientName: string
  readonly open: boolean
  readonly onToggle: () => void
  readonly density: DensityMode
  readonly filters: TimelineFilters
  readonly clientMatchedSearch: boolean
}

const RestorePreviewDialog = ({
  open,
  backup,
  preview,
  previewLoading,
  previewError,
  restoring,
  onCancel,
  onConfirm,
}: Readonly<{
  open: boolean
  backup: BackupEntry | null
  preview: RestorePreviewResult | null
  previewLoading: boolean
  previewError: string | null
  restoring: boolean
  onCancel: () => void
  onConfirm: () => void
}>) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !restoring && onCancel()}>
      <DialogContent
        className="max-w-3xl max-h-[86vh] flex flex-col"
        data-testid="history-restore-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('history.restoreDialogTitle')}</DialogTitle>
          <DialogDescription>
            {backup
              ? t('history.restoreDialogDescription', {
                  clientId: backup.clientId,
                  time: new Date(backup.createdAt).toLocaleString(),
                })
              : ''}
          </DialogDescription>
        </DialogHeader>

        {previewLoading && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {t('history.previewLoading')}
          </div>
        )}

        {previewError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {previewError}
          </div>
        )}

        {preview && (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Badge variant="secondary">
                {t('history.previewAdded', { count: preview.added })}
              </Badge>
              <Badge variant="secondary">
                {t('history.previewRemoved', { count: preview.removed })}
              </Badge>
              <Badge variant="secondary">
                {t('history.previewChanged', { count: preview.changed })}
              </Badge>
              <Badge variant="outline">{t('history.previewMode', { mode: preview.mode })}</Badge>
            </div>

            <ScrollArea className="flex-1 rounded-md border bg-muted/20 p-3">
              <div className="space-y-2">
                {preview.blocks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('history.previewNoChanges')}</p>
                ) : (
                  preview.blocks.map((block) => (
                    <article
                      key={`${block.path}-${block.kind}`}
                      className="rounded-md border bg-background p-2"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {block.path}
                        </span>
                        <Badge variant={block.kind === 'changed' ? 'secondary' : 'outline'}>
                          {t(`history.previewKind.${block.kind}`)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded border bg-muted/20 p-2">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {t('history.previewBefore')}
                          </p>
                          <pre className="whitespace-pre-wrap break-all text-xs">
                            {block.before ?? t('history.previewEmpty')}
                          </pre>
                        </div>
                        <div className="rounded border bg-muted/20 p-2">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {t('history.previewAfter')}
                          </p>
                          <pre className="whitespace-pre-wrap break-all text-xs">
                            {block.after ?? t('history.previewEmpty')}
                          </pre>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </ScrollArea>

            {preview.truncated && (
              <p className="text-xs text-muted-foreground">{t('history.previewTruncated')}</p>
            )}
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={restoring}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={restoring || previewLoading || preview === null}
          >
            {restoring ? t('history.restoringButton') : t('history.restoreButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const BackupTimeline = ({
  clientId,
  clientName,
  open,
  onToggle,
  density,
  filters,
  clientMatchedSearch,
}: Readonly<Props>) => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<BackupEntry[]>([])
  const [total, setTotal] = useState(0)
  const [latestEntry, setLatestEntry] = useState<BackupEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [pendingRestore, setPendingRestore] = useState<BackupEntry | null>(null)
  const [preview, setPreview] = useState<RestorePreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const baseQueryFilters = useMemo<BackupQueryFilters>(
    () => ({
      clientId,
      ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
      ...(filters.types.length > 0 ? { types: filters.types } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      sort: filters.sort,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    [clientId, filters.from, filters.search, filters.sort, filters.to, filters.types],
  )

  const loadInitial = useCallback(async () => {
    setLoading(true)
    try {
      const [page, latest] = await Promise.all([
        backupsService.query(baseQueryFilters),
        backupsService.query({
          clientId,
          ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
          sort: 'newest',
          limit: 1,
          offset: 0,
        }),
      ])
      setEntries([...page.items])
      setTotal(page.total)
      setLatestEntry(latest.items[0] ?? null)
    } catch {
      toast.error(t('history.loadFailed', { clientId }))
      setEntries([])
      setTotal(0)
      setLatestEntry(null)
    } finally {
      setLoading(false)
    }
  }, [baseQueryFilters, clientId, filters.from, filters.search, filters.to, t])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const next = await backupsService.query({
        ...baseQueryFilters,
        offset: entries.length,
      })
      setEntries((prev) => [...prev, ...next.items])
      setTotal(next.total)
    } catch {
      toast.error(t('history.loadFailed', { clientId }))
    } finally {
      setLoadingMore(false)
    }
  }, [baseQueryFilters, clientId, entries.length, loadingMore, t])

  const openRestorePreview = useCallback(
    async (backup: BackupEntry) => {
      setPendingRestore(backup)
      setPreview(null)
      setPreviewError(null)
      setPreviewLoading(true)
      try {
        const result = await backupsService.previewRestore(backup.backupPath, clientId)
        setPreview(result)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('history.previewFailed')
        setPreviewError(message)
      } finally {
        setPreviewLoading(false)
      }
    },
    [clientId, t],
  )

  const confirmRestore = useCallback(async () => {
    if (!pendingRestore) return
    setRestoringId(pendingRestore.id)
    try {
      await backupsService.restore(pendingRestore.backupPath, clientId)
      toast.success(
        t('history.restoreSuccess', { clientId, time: relativeTime(pendingRestore.createdAt) }),
      )
      setPendingRestore(null)
      setPreview(null)
      setPreviewError(null)
      await loadInitial()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('history.restoreFailed')
      toast.error(message)
    } finally {
      setRestoringId(null)
    }
  }, [clientId, loadInitial, pendingRestore, t])

  const typeCounts = useMemo(() => {
    const counts: Record<BackupEntry['backupType'], number> = {
      pristine: 0,
      sync: 0,
      manual: 0,
    }
    entries.forEach((entry) => {
      counts[entry.backupType] += 1
    })
    return counts
  }, [entries])

  const hasMore = entries.length < total
  const showCard = !filters.search || clientMatchedSearch || total > 0
  if (!showCard) return null

  return (
    <>
      <section className="rounded-xl border bg-card/60" data-testid={`client-history-${clientId}`}>
        <Button
          type="button"
          variant="ghost"
          className="flex h-auto w-full items-start justify-between rounded-xl px-4 py-3 text-left"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`history-panel-${clientId}`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{clientName}</span>
              <Badge variant="outline">{t('history.resultsCount', { count: total })}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {latestEntry
                ? t('history.latestBackup', {
                    time: new Date(latestEntry.createdAt).toLocaleString(),
                  })
                : t('history.latestBackupNone')}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {(['pristine', 'sync', 'manual'] as const).map((type) => (
                <Badge key={type} variant="secondary" className="text-[11px]">
                  {t(BACKUP_TYPE_META[type].labelKey as Parameters<typeof t>[0])}:{' '}
                  {typeCounts[type]}
                </Badge>
              ))}
            </div>
          </div>
          {open ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
        </Button>

        {open && (
          <div id={`history-panel-${clientId}`} className="border-t px-4 py-3">
            {loading ? (
              <p className="py-3 text-sm text-muted-foreground">{t('history.loading')}</p>
            ) : entries.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">{t('history.noBackups')}</p>
            ) : (
              <ol className="space-y-2" data-testid={`backup-timeline-${clientId}`}>
                {entries.map((backup) => {
                  const meta = BACKUP_TYPE_META[backup.backupType]
                  const TypeIcon = meta.icon
                  const label = t(meta.labelKey as Parameters<typeof t>[0])
                  const description = t(meta.descriptionKey as Parameters<typeof t>[0])
                  const isRestoring = restoringId === backup.id

                  return (
                    <li
                      key={backup.id}
                      className={[
                        'flex items-center justify-between gap-3 rounded-md border bg-background text-sm',
                        density === 'compact' ? 'px-3 py-2' : 'px-4 py-3',
                      ].join(' ')}
                      data-testid={`backup-entry-${backup.id}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <TypeIcon size={15} className={meta.className} aria-label={label} />
                          </TooltipTrigger>
                          <TooltipContent>{description}</TooltipContent>
                        </Tooltip>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{label}</span>
                            <time
                              dateTime={backup.createdAt}
                              title={new Date(backup.createdAt).toLocaleString()}
                              className="text-xs text-muted-foreground"
                            >
                              {relativeTime(backup.createdAt)}
                            </time>
                            <span className="font-mono text-xs text-muted-foreground">
                              {formatFileSize(backup.fileSize)}
                            </span>
                          </div>
                          <div className="mt-1 max-w-[30rem]">
                            <PathWithActions
                              path={backup.backupPath}
                              className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
                              textClassName="font-mono truncate flex-1"
                              allowEdit={false}
                              testIdPrefix={`backup-path-${backup.id}`}
                            />
                          </div>
                        </div>
                      </div>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => void openRestorePreview(backup)}
                            disabled={isRestoring}
                            aria-label={t('history.restoreAriaLabel', {
                              time: new Date(backup.createdAt).toLocaleString(),
                            })}
                            data-testid={`btn-restore-${backup.id}`}
                          >
                            <RotateCcw size={11} aria-hidden="true" />
                            {t('history.restoreButton')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('history.restoreTooltip')}</TooltipContent>
                      </Tooltip>
                    </li>
                  )
                })}
              </ol>
            )}

            {hasMore && (
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  data-testid={`history-load-more-${clientId}`}
                >
                  {loadingMore ? t('common.loading') : t('history.loadMore')}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      <RestorePreviewDialog
        open={pendingRestore !== null}
        backup={pendingRestore}
        preview={preview}
        previewLoading={previewLoading}
        previewError={previewError}
        restoring={pendingRestore !== null && restoringId === pendingRestore.id}
        onCancel={() => {
          if (restoringId === null) {
            setPendingRestore(null)
            setPreview(null)
            setPreviewError(null)
          }
        }}
        onConfirm={() => void confirmRestore()}
      />
    </>
  )
}

export { BackupTimeline }
export type { TimelineFilters, DensityMode }
