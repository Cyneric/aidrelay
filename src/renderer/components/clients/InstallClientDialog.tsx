import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock3, ExternalLink, Loader2, MinusCircle, XCircle } from 'lucide-react'
import type { ClientInstallResult, InstallManager } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type InstallDialogPhase = 'confirm' | 'running' | 'done'
export type InstallTimelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export interface InstallTimelineEntry {
  readonly attemptIndex: number
  readonly manager?: InstallManager
  readonly status: InstallTimelineStatus
}

interface InstallClientDialogProps {
  readonly open: boolean
  readonly phase: InstallDialogPhase
  readonly clientName: string
  readonly officialUrl?: string
  readonly progress: number
  readonly stepText: string
  readonly timeline: readonly InstallTimelineEntry[]
  readonly result?: ClientInstallResult
  readonly errorMessage?: string
  readonly onCancel: () => void
  readonly onOfficialDownload: () => void
  readonly onConfirm: () => void
  readonly onDone: () => void
}

const statusIcon = (status: InstallTimelineStatus) => {
  switch (status) {
    case 'running':
      return <Loader2 size={13} className="animate-spin text-primary" aria-hidden="true" />
    case 'success':
      return (
        <CheckCircle2 size={13} className="text-green-600 dark:text-green-400" aria-hidden="true" />
      )
    case 'failed':
      return <XCircle size={13} className="text-destructive" aria-hidden="true" />
    case 'skipped':
      return (
        <MinusCircle size={13} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
      )
    default:
      return <Clock3 size={13} className="text-muted-foreground" aria-hidden="true" />
  }
}

const InstallClientDialog = ({
  open,
  phase,
  clientName,
  officialUrl,
  progress,
  stepText,
  timeline,
  result,
  errorMessage,
  onCancel,
  onOfficialDownload,
  onConfirm,
  onDone,
}: InstallClientDialogProps) => {
  const { t } = useTranslation()

  const title =
    phase === 'confirm'
      ? t('clients.installConfirmTitle')
      : phase === 'running'
        ? t('clients.installProgress.runningTitle', { name: clientName })
        : result?.success
          ? t('clients.installProgress.doneTitleSuccess', { name: clientName })
          : t('clients.installProgress.doneTitleFailure', { name: clientName })

  const managerLabel = (manager: InstallManager | undefined, attemptIndex: number): string => {
    if (!manager) return t('clients.installProgress.manager.attempt', { index: attemptIndex })
    if (manager === 'winget') return t('clients.installProgress.manager.winget')
    if (manager === 'choco') return t('clients.installProgress.manager.choco')
    if (manager === 'npm') return t('clients.installProgress.manager.npm')
    return t('clients.installProgress.manager.manual')
  }

  const finalMessage = errorMessage ?? result?.message ?? ''
  const resolvedOfficialUrl = result?.docsUrl ?? officialUrl

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && phase === 'confirm') onCancel()
      }}
    >
      <DialogContent
        showCloseButton={phase === 'confirm'}
        className="max-w-lg"
        data-testid="install-client-dialog"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {phase === 'confirm'
              ? t('clients.installConfirmDescription', { name: clientName })
              : stepText}
          </DialogDescription>
        </DialogHeader>

        {phase !== 'confirm' && (
          <div className="space-y-3" data-testid="install-progress-panel">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-200 ease-out',
                  phase === 'done' && !result?.success ? 'bg-destructive' : 'bg-primary',
                )}
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                data-testid="install-progress-bar"
              />
            </div>

            <div className="space-y-1" data-testid="install-progress-timeline">
              {timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('clients.installProgress.timeline.noAttemptsYet')}
                </p>
              ) : (
                timeline.map((entry) => (
                  <div
                    key={entry.attemptIndex}
                    className="flex items-center justify-between gap-2 text-xs"
                    data-testid={`install-progress-attempt-${entry.attemptIndex}`}
                  >
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      {statusIcon(entry.status)}
                      {managerLabel(entry.manager, entry.attemptIndex)}
                    </span>
                    <span className="text-muted-foreground">
                      {t(`clients.installProgress.timeline.${entry.status}`)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {phase === 'done' && finalMessage.length > 0 && (
              <p
                className={cn(
                  'text-xs',
                  result?.success ? 'text-green-600 dark:text-green-400' : 'text-destructive',
                )}
                data-testid="install-result-message"
              >
                {finalMessage}
              </p>
            )}

            {phase === 'done' && resolvedOfficialUrl && (
              <div
                className="rounded-md border border-border/70 bg-muted/30 px-3 py-2"
                data-testid="install-official-link-panel"
              >
                {!result?.success && result?.failureReason === 'no_available_manager' && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t('clients.installProgress.noPackageManagerHint')}
                  </p>
                )}
                <p
                  className="text-xs text-muted-foreground break-all"
                  data-testid="install-official-url"
                >
                  {resolvedOfficialUrl}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="mt-2"
                  onClick={onOfficialDownload}
                  data-testid="install-open-official-link"
                >
                  <ExternalLink size={12} aria-hidden="true" />
                  {t('clients.installOpenOfficial')}
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === 'confirm' ? (
            <>
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onOfficialDownload}
                data-testid="install-dialog-official"
              >
                <ExternalLink size={13} aria-hidden="true" />
                {t('clients.installOfficial')}
              </Button>
              <Button type="button" onClick={onConfirm} data-testid="install-dialog-confirm">
                {t('clients.installConfirm')}
              </Button>
            </>
          ) : phase === 'running' ? (
            <>
              <Button type="button" variant="outline" disabled>
                {t('common.cancel')}
              </Button>
              <Button type="button" disabled data-testid="install-dialog-running">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                {t('common.loading')}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={onDone} data-testid="install-dialog-done">
              {t('clients.installProgress.doneButton')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { InstallClientDialog }
