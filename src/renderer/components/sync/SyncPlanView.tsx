import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PathWithActions } from '@/components/common/PathWithActions'
import type { SyncPlanDetail, SyncPlanProfileOverrideItem, SyncPlanResult } from '@shared/types'

interface SyncPlanViewProps {
  readonly plan: SyncPlanResult | null
  readonly loading: boolean
}

const prettyJson = (value: unknown): string => JSON.stringify(value ?? null, null, 2)

const actionVariant = (action: string): 'secondary' | 'destructive' | 'outline' => {
  if (action === 'create') return 'secondary'
  if (action === 'remove') return 'destructive'
  return 'outline'
}

const renderProfileItem = (
  item: SyncPlanProfileOverrideItem,
  enabledLabel: string,
  disabledLabel: string,
) => (
  <li
    key={item.id}
    className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
  >
    <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
    <div className="flex items-center gap-2 text-xs">
      <Badge variant="outline">{item.currentEnabled ? enabledLabel : disabledLabel}</Badge>
      <span className="text-muted-foreground">-&gt;</span>
      <Badge variant={item.nextEnabled ? 'secondary' : 'outline'}>
        {item.nextEnabled ? enabledLabel : disabledLabel}
      </Badge>
    </div>
  </li>
)

const SyncPlanView = ({ plan, loading }: SyncPlanViewProps) => {
  const { t } = useTranslation()

  const summary = useMemo(
    () => ({
      create: plan?.createCount ?? 0,
      modify: plan?.modifyCount ?? 0,
      remove: plan?.removeCount ?? 0,
      total: plan?.totalFiles ?? 0,
    }),
    [plan],
  )

  const copyPath = async (path: string) => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable')
      }
      await navigator.clipboard.writeText(path)
      toast.success(t('syncCenter.syncPlanCopyPathSuccess'))
    } catch {
      toast.error(t('syncCenter.syncPlanCopyPathFailed'))
    }
  }

  const renderDetail = (detail: SyncPlanDetail) => {
    if (detail.kind === 'rules') {
      return (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('syncCenter.syncPlanBefore')}
            </h4>
            <pre className="max-h-56 overflow-auto rounded border bg-muted/30 p-2 text-xs">
              {detail.before ?? t('syncCenter.syncPlanNoExistingContent')}
            </pre>
          </section>
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('syncCenter.syncPlanAfter')}
            </h4>
            <pre className="max-h-56 overflow-auto rounded border bg-muted/30 p-2 text-xs">
              {detail.after}
            </pre>
          </section>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {detail.items.map((item) => (
          <article key={item.name} className="rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="font-mono text-sm">{item.name}</div>
              <Badge variant={actionVariant(item.action)}>
                {t(`dashboard.syncPreviewAction.${item.action}`)}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('syncCenter.syncPlanBefore')}
                </h4>
                <pre className="max-h-40 overflow-auto rounded border bg-background p-2 text-xs">
                  {prettyJson(item.before)}
                </pre>
              </section>
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('syncCenter.syncPlanAfter')}
                </h4>
                <pre className="max-h-40 overflow-auto rounded border bg-background p-2 text-xs">
                  {prettyJson(item.after)}
                </pre>
              </section>
            </div>
          </article>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground" data-testid="sync-plan-loading">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="sync-plan-view">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary" data-testid="sync-plan-summary-total">
          {t('syncCenter.syncPlanSummaryTotal', { count: summary.total })}
        </Badge>
        <Badge variant="secondary" data-testid="sync-plan-summary-create">
          {t('syncCenter.syncPlanSummaryCreate', { count: summary.create })}
        </Badge>
        <Badge variant="outline" data-testid="sync-plan-summary-modify">
          {t('syncCenter.syncPlanSummaryModify', { count: summary.modify })}
        </Badge>
        <Badge variant="destructive" data-testid="sync-plan-summary-remove">
          {t('syncCenter.syncPlanSummaryRemove', { count: summary.remove })}
        </Badge>
      </div>

      {plan?.blockers.length ? (
        <section className="space-y-3" data-testid="sync-plan-blockers">
          <h3 className="text-sm font-semibold text-text-primary">
            {t('syncCenter.syncPlanBlockers')}
          </h3>
          {plan.blockers.map((blocker, index) => (
            <article
              key={blocker.id}
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3"
              data-testid={`sync-plan-blocker-${index}`}
            >
              <p className="text-sm font-medium text-destructive">{blocker.title}</p>
              <p className="mt-1 text-sm text-text-secondary">{blocker.description}</p>
              {blocker.path ? (
                <div className="mt-2 flex items-center gap-2">
                  <PathWithActions
                    path={blocker.path}
                    className="flex min-w-0 items-center gap-1"
                    textClassName="flex-1 break-all text-xs text-text-primary"
                    allowEdit={false}
                    testIdPrefix={`sync-plan-blocker-path-${index}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    onClick={() => void copyPath(blocker.path!)}
                    aria-label={t('dashboard.copyConfigPath')}
                    data-testid={`sync-plan-blocker-copy-${index}`}
                  >
                    <Copy size={12} aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {plan?.profileSummary ? (
        <section className="space-y-3" data-testid="sync-plan-profile-summary">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {t('syncCenter.syncPlanProfileSummaryTitle', {
                name: plan.profileSummary.profileName,
              })}
            </h3>
            <p className="text-sm text-text-secondary">
              {t('syncCenter.syncPlanProfileSummaryDescription')}
            </p>
          </div>
          {plan.profileSummary.serverOverrides.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('syncCenter.syncPlanServerOverrides')}
              </p>
              <ul className="space-y-2">
                {plan.profileSummary.serverOverrides.map((item) =>
                  renderProfileItem(item, t('common.enabled'), t('common.disabled')),
                )}
              </ul>
            </div>
          ) : null}
          {plan.profileSummary.ruleOverrides.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('syncCenter.syncPlanRuleOverrides')}
              </p>
              <ul className="space-y-2">
                {plan.profileSummary.ruleOverrides.map((item) =>
                  renderProfileItem(item, t('common.enabled'), t('common.disabled')),
                )}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {plan && plan.entries.length === 0 ? (
        <div
          className="rounded-md border border-border/70 bg-surface-2 p-4"
          data-testid="sync-plan-empty"
        >
          {t('syncCenter.syncPlanEmpty')}
        </div>
      ) : null}

      <ScrollArea className="max-h-[48vh] rounded-md border bg-muted/10 p-3">
        <div className="space-y-4">
          {(plan?.entries ?? []).map((entry, index) => (
            <article
              key={entry.id}
              className="rounded-md border bg-background p-4"
              data-testid={`sync-plan-file-${index}`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {entry.clientName
                      ? t('syncCenter.syncPlanEntryTitle', {
                          client: entry.clientName,
                          feature:
                            entry.feature === 'mcp-config'
                              ? t('syncCenter.syncPlanFeatureMcp')
                              : t('syncCenter.syncPlanFeatureRules'),
                        })
                      : t('syncCenter.syncPlanFeatureRules')}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {t(`syncCenter.syncPlanOrigin.${entry.origin}`)}
                  </p>
                </div>
                <Badge variant={actionVariant(entry.action)}>
                  {t(`syncCenter.syncPlanAction.${entry.action}`)}
                </Badge>
              </div>

              <div className="mb-3 rounded-md border border-border/70 bg-surface-2 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  {t('dashboard.syncPreviewTargetFile')}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <PathWithActions
                    path={entry.path}
                    className="flex min-w-0 items-center gap-1"
                    textClassName="flex-1 break-all text-xs text-text-primary"
                    allowEdit={false}
                    testIdPrefix={`sync-plan-file-path-${index}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    onClick={() => void copyPath(entry.path)}
                    aria-label={t('dashboard.copyConfigPath')}
                    data-testid={`sync-plan-file-copy-${index}`}
                  >
                    <Copy size={12} aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {renderDetail(entry.detail)}
            </article>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export { SyncPlanView }
