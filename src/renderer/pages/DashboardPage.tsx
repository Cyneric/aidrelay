/**
 * @file src/renderer/pages/DashboardPage.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Dashboard page — action-first operations view for detected
 * clients. Surfaces KPIs, provides search/filter/sort controls, and groups
 * clients by attention level for faster decision-making.
 */

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CardGrid } from '@/components/ui/card-grid'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClientCard } from '@/components/clients/ClientCard'
import { CreateConfigConfirmDialog } from '@/components/clients/CreateConfigConfirmDialog'
import { useClientsStore } from '@/stores/clients.store'
import { clientsService } from '@/services/clients.service'
import { cn } from '@/lib/utils'
import type { ClientStatus, ConfigChangedPayload, SyncClientOptions } from '@shared/types'

type DashboardFilter = 'all' | 'needs-attention' | 'synced' | 'not-installed'
type DashboardSort = 'priority' | 'name' | 'servers'

interface ClientViewModel {
  readonly client: ClientStatus
  readonly missingConfig: boolean
  readonly needsAttention: boolean
  readonly isHealthy: boolean
  readonly searchIndex: string
  readonly priority: number
}

const FILTERS: readonly DashboardFilter[] = ['all', 'needs-attention', 'synced', 'not-installed']

const getPriorityScore = (client: ClientStatus, missingConfig: boolean): number => {
  if (!client.installed) return 5
  if (client.syncStatus === 'error') return 0
  if (missingConfig || client.syncStatus === 'out-of-sync') return 1
  if (client.syncStatus === 'never-synced') return 2
  return 3
}

const positiveServerCount = (serverCount: number): number =>
  Number.isFinite(serverCount) && serverCount > 0 ? Math.trunc(serverCount) : 0

const DashboardPage = () => {
  const { clients, loading, error, detectAll, syncClient } = useClientsStore()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>('all')
  const [sortBy, setSortBy] = useState<DashboardSort>('priority')
  const [collapsedNotInstalled, setCollapsedNotInstalled] = useState(false)
  const [syncingIds, setSyncingIds] = useState<Set<ClientStatus['id']>>(new Set())
  const [bulkSyncRunning, setBulkSyncRunning] = useState(false)
  const [createConfigClientId, setCreateConfigClientId] = useState<ClientStatus['id'] | null>(null)

  useEffect(() => {
    void detectAll()
  }, [detectAll])

  useEffect(() => {
    const unsubscribe = clientsService.onConfigChanged((payload: ConfigChangedPayload) => {
      toast.info(t('dashboard.configChangedTitle'), {
        description: t('dashboard.configChangedDescription', { clientId: payload.clientId }),
        action: {
          label: t('dashboard.importChanges'),
          onClick: () => void syncClient(payload.clientId),
        },
        duration: 8000,
      })
    })
    return unsubscribe
  }, [syncClient, t])

  const setClientSyncing = (clientId: ClientStatus['id'], syncing: boolean) => {
    setSyncingIds((prev) => {
      const next = new Set(prev)
      if (syncing) next.add(clientId)
      else next.delete(clientId)
      return next
    })
  }

  const clientView = useMemo<ClientViewModel[]>(
    () =>
      clients.map((client) => {
        const missingConfig = client.installed && client.configPaths.length === 0
        const needsAttention =
          client.installed &&
          (missingConfig || client.syncStatus === 'out-of-sync' || client.syncStatus === 'error')

        return {
          client,
          missingConfig,
          needsAttention,
          isHealthy: client.installed && !needsAttention,
          searchIndex: `${client.displayName} ${client.id}`.toLowerCase(),
          priority: getPriorityScore(client, missingConfig),
        }
      }),
    [clients],
  )

  const kpis = useMemo(() => {
    const installedTools = clientView.filter((item) => item.client.installed).length
    const outOfSyncTools = clientView.filter((item) => item.needsAttention).length
    const missingConfigTools = clientView.filter((item) => item.missingConfig).length
    const totalServers = clientView.reduce(
      (acc, item) => acc + positiveServerCount(item.client.serverCount),
      0,
    )

    return { installedTools, outOfSyncTools, missingConfigTools, totalServers }
  }, [clientView])

  const filterCounts = useMemo(
    () => ({
      all: clientView.length,
      'needs-attention': clientView.filter((item) => item.needsAttention).length,
      synced: clientView.filter(
        (item) =>
          item.client.installed && item.client.syncStatus === 'synced' && !item.missingConfig,
      ).length,
      'not-installed': clientView.filter((item) => !item.client.installed).length,
    }),
    [clientView],
  )

  const actionableTargets = useMemo(
    () =>
      clientView
        .filter(
          (item) =>
            item.client.installed &&
            !item.missingConfig &&
            (item.client.syncStatus === 'out-of-sync' || item.client.syncStatus === 'error'),
        )
        .map((item) => item.client),
    [clientView],
  )

  const sortedFilteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const filtered = clientView.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 || item.searchIndex.includes(normalizedQuery)
      if (!matchesQuery) return false

      if (activeFilter === 'needs-attention') return item.needsAttention
      if (activeFilter === 'synced')
        return item.client.installed && item.client.syncStatus === 'synced' && !item.missingConfig
      if (activeFilter === 'not-installed') return !item.client.installed
      return true
    })

    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.client.displayName.localeCompare(b.client.displayName)
      if (sortBy === 'servers') {
        const byServers =
          positiveServerCount(b.client.serverCount) - positiveServerCount(a.client.serverCount)
        return byServers !== 0
          ? byServers
          : a.client.displayName.localeCompare(b.client.displayName)
      }

      const byPriority = a.priority - b.priority
      if (byPriority !== 0) return byPriority
      return a.client.displayName.localeCompare(b.client.displayName)
    })
  }, [activeFilter, clientView, query, sortBy])

  const sections = useMemo(() => {
    const needsAttention = sortedFilteredClients
      .filter((item) => item.needsAttention)
      .map((item) => item.client)
    const healthy = sortedFilteredClients
      .filter((item) => item.isHealthy)
      .map((item) => item.client)
    const notInstalled = sortedFilteredClients
      .filter((item) => !item.client.installed)
      .map((item) => item.client)

    return { needsAttention, healthy, notInstalled }
  }, [sortedFilteredClients])

  const handleSync = async (clientId: ClientStatus['id'], options?: SyncClientOptions) => {
    setClientSyncing(clientId, true)
    try {
      await syncClient(clientId, options)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast.error(message)
    } finally {
      setClientSyncing(clientId, false)
    }
  }

  const handleSyncAllActionable = async () => {
    if (actionableTargets.length === 0 || bulkSyncRunning) return

    setBulkSyncRunning(true)
    setSyncingIds((prev) => {
      const next = new Set(prev)
      for (const client of actionableTargets) next.add(client.id)
      return next
    })

    let succeeded = 0
    let failed = 0

    try {
      for (const client of actionableTargets) {
        const result = await clientsService.sync(client.id)
        if (result.success) succeeded += 1
        else failed += 1
      }

      await detectAll()
    } catch {
      failed = actionableTargets.length - succeeded
    } finally {
      setBulkSyncRunning(false)
      setSyncingIds((prev) => {
        const next = new Set(prev)
        for (const client of actionableTargets) next.delete(client.id)
        return next
      })
    }

    if (failed === 0) {
      toast.success(t('dashboard.syncAllSuccess', { count: succeeded }))
      return
    }

    toast.error(
      t('dashboard.syncAllSummary', {
        succeeded,
        total: actionableTargets.length,
        failed,
      }),
    )
  }

  const createConfigClient = clients.find((client) => client.id === createConfigClientId) ?? null

  return (
    <section aria-labelledby="dashboard-heading" data-testid="dashboard-page">
      <CreateConfigConfirmDialog
        open={createConfigClient !== null}
        clientName={createConfigClient?.displayName ?? ''}
        submitting={createConfigClient !== null && syncingIds.has(createConfigClient.id)}
        onCancel={() => setCreateConfigClientId(null)}
        onConfirm={() => {
          if (!createConfigClient) return
          setCreateConfigClientId(null)
          void handleSync(createConfigClient.id, { allowCreateConfigIfMissing: true })
        }}
      />

      <div className="sticky top-0 z-20 -mx-6 mb-6 border-b border-border/70 bg-background/95 px-6 pb-4 pt-2 backdrop-blur">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1
              id="dashboard-heading"
              className="text-2xl font-semibold tracking-tight text-text-primary"
            >
              {t('dashboard.title')}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">{t('dashboard.subtitle')}</p>
          </div>
        </header>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="gap-1 border-border/70 bg-surface-2 py-3 shadow-none">
            <p className="px-6 text-xs uppercase tracking-wide text-text-secondary">
              {t('dashboard.kpiInstalled')}
            </p>
            <p
              className="px-6 text-2xl font-semibold text-text-primary"
              data-testid="dashboard-kpi-installed"
            >
              {kpis.installedTools}
            </p>
          </Card>
          <Card className="gap-1 border-border/70 bg-surface-2 py-3 shadow-none">
            <p className="px-6 text-xs uppercase tracking-wide text-text-secondary">
              {t('dashboard.kpiOutOfSync')}
            </p>
            <p
              className="px-6 text-2xl font-semibold text-status-warn"
              data-testid="dashboard-kpi-out-of-sync"
            >
              {kpis.outOfSyncTools}
            </p>
          </Card>
          <Card className="gap-1 border-border/70 bg-surface-2 py-3 shadow-none">
            <p className="px-6 text-xs uppercase tracking-wide text-text-secondary">
              {t('dashboard.kpiMissingConfig')}
            </p>
            <p
              className="px-6 text-2xl font-semibold text-status-warn"
              data-testid="dashboard-kpi-missing-config"
            >
              {kpis.missingConfigTools}
            </p>
          </Card>
          <Card className="gap-1 border-border/70 bg-surface-2 py-3 shadow-none">
            <p className="px-6 text-xs uppercase tracking-wide text-text-secondary">
              {t('dashboard.kpiTotalServers')}
            </p>
            <p
              className="px-6 text-2xl font-semibold text-text-primary"
              data-testid="dashboard-kpi-total-servers"
            >
              {kpis.totalServers}
            </p>
          </Card>
        </div>

        <div
          role="toolbar"
          aria-label={t('dashboard.filterLabel')}
          className="space-y-3"
          data-testid="dashboard-toolbar"
        >
          <div
            role="group"
            aria-label={t('dashboard.sortLabel')}
            className="flex flex-col gap-3 xl:flex-row xl:items-center"
            data-testid="dashboard-toolbar-row1"
          >
            <div
              className="relative min-w-[280px] flex-1 xl:max-w-[460px]"
              data-testid="dashboard-search-container"
            >
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('dashboard.searchPlaceholder')}
                className="pl-9"
                aria-label={t('dashboard.searchPlaceholder')}
              />
            </div>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as DashboardSort)}>
              <SelectTrigger className="w-48 shrink-0" aria-label={t('dashboard.sortLabel')}>
                <SelectValue placeholder={t('dashboard.sortLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">{t('dashboard.sort.priority')}</SelectItem>
                <SelectItem value="name">{t('dashboard.sort.name')}</SelectItem>
                <SelectItem value="servers">{t('dashboard.sort.servers')}</SelectItem>
              </SelectContent>
            </Select>

            <div
              role="group"
              aria-label={t('dashboard.refresh')}
              className="flex shrink-0 items-center gap-2 xl:ml-auto"
              data-testid="dashboard-toolbar-actions"
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => void detectAll()}
                disabled={loading}
                className="gap-1.5"
                aria-label={t('dashboard.refresh')}
                data-testid="detect-all-button"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                {loading ? t('common.loading') : t('dashboard.refresh')}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSyncAllActionable()}
                disabled={bulkSyncRunning || actionableTargets.length === 0}
                className="gap-1.5"
                data-testid="sync-all-actionable-button"
              >
                <RefreshCw
                  size={14}
                  className={bulkSyncRunning ? 'animate-spin' : ''}
                  aria-hidden="true"
                />
                {bulkSyncRunning ? t('clients.syncingButton') : t('dashboard.syncAllActionable')}
              </Button>
            </div>
          </div>

          <div
            role="group"
            aria-label={t('dashboard.filterLabel')}
            className="overflow-x-auto"
            data-testid="dashboard-toolbar-row2"
          >
            <div className="flex min-w-max flex-nowrap items-center gap-2 pb-1">
              {FILTERS.map((filter) => {
                const selected = activeFilter === filter
                return (
                  <Button
                    key={filter}
                    type="button"
                    size="sm"
                    variant={selected ? 'default' : 'outline'}
                    className={cn('shrink-0 gap-1.5', !selected && 'text-text-secondary')}
                    onClick={() => setActiveFilter(filter)}
                    aria-pressed={selected}
                    data-testid={`dashboard-filter-${filter}`}
                  >
                    {t(`dashboard.filters.${filter}`)}
                    <span className="text-[11px] text-current/75">{filterCounts[filter]}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          data-testid="detection-error"
        >
          {t('dashboard.detectionFailed', { error })}
        </div>
      )}

      {loading && clients.length === 0 && (
        <CardGrid aria-busy="true" aria-label="Loading clients" data-testid="clients-skeleton">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card
              key={i}
              className="h-40 animate-pulse border-border/70 bg-surface-2 shadow-none"
              aria-hidden="true"
            />
          ))}
        </CardGrid>
      )}

      {!loading || clients.length > 0 ? (
        <div className="space-y-6">
          <section
            aria-labelledby="needs-attention-heading"
            data-testid="dashboard-section-needs-attention"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="needs-attention-heading" className="text-sm font-semibold text-text-primary">
                {t('dashboard.sectionNeedsAttention')}
              </h2>
              <span className="text-xs text-text-secondary">{sections.needsAttention.length}</span>
            </div>
            {sections.needsAttention.length > 0 ? (
              <CardGrid data-testid="clients-grid-needs-attention">
                {sections.needsAttention.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onSync={(id) => void handleSync(id)}
                    onCreateConfig={(id) => setCreateConfigClientId(id)}
                    syncing={syncingIds.has(client.id)}
                  />
                ))}
              </CardGrid>
            ) : (
              <Card className="gap-0 border-border/70 bg-surface-2 py-4 shadow-none">
                <p className="px-6 text-sm text-text-secondary">
                  {t('dashboard.noNeedsAttention')}
                </p>
              </Card>
            )}
          </section>

          <section aria-labelledby="healthy-heading" data-testid="dashboard-section-healthy">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="healthy-heading" className="text-sm font-semibold text-text-primary">
                {t('dashboard.sectionHealthy')}
              </h2>
              <span className="text-xs text-text-secondary">{sections.healthy.length}</span>
            </div>
            {sections.healthy.length > 0 ? (
              <CardGrid data-testid="clients-grid-healthy">
                {sections.healthy.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onSync={(id) => void handleSync(id)}
                    onCreateConfig={(id) => setCreateConfigClientId(id)}
                    syncing={syncingIds.has(client.id)}
                  />
                ))}
              </CardGrid>
            ) : (
              <Card className="gap-0 border-border/70 bg-surface-2 py-4 shadow-none">
                <p className="px-6 text-sm text-text-secondary">{t('dashboard.noHealthy')}</p>
              </Card>
            )}
          </section>

          {sections.notInstalled.length > 0 && (
            <section
              aria-labelledby="not-installed-heading"
              data-testid="dashboard-section-not-installed"
            >
              <button
                type="button"
                onClick={() => setCollapsedNotInstalled((value) => !value)}
                className="mb-3 inline-flex items-center gap-2 rounded-md border border-border/60 bg-surface-2 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={!collapsedNotInstalled}
                aria-controls="dashboard-not-installed-grid"
              >
                <ChevronDown
                  size={14}
                  className={cn('transition-transform', !collapsedNotInstalled && 'rotate-180')}
                  aria-hidden="true"
                />
                <span id="not-installed-heading">{t('dashboard.sectionNotInstalled')}</span>
                <span className="text-xs text-text-secondary">{sections.notInstalled.length}</span>
              </button>

              {!collapsedNotInstalled ? (
                <CardGrid
                  id="dashboard-not-installed-grid"
                  data-testid="clients-grid-not-installed"
                >
                  {sections.notInstalled.map((client) => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      onSync={(id) => void handleSync(id)}
                      onCreateConfig={(id) => setCreateConfigClientId(id)}
                      syncing={syncingIds.has(client.id)}
                    />
                  ))}
                </CardGrid>
              ) : null}
            </section>
          )}
        </div>
      ) : null}
    </section>
  )
}

export { DashboardPage }
