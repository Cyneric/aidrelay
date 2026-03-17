/**
 * @file src/renderer/pages/HistoryPage.tsx
 *
 * @created 07.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description History page with a tabbed interface combining backup history
 * and activity log. The "Backups" tab shows per-client backup timelines with
 * filter controls. The "Activity Log" tab embeds the full activity log with
 * its own filters.
 */

import { useMemo, useEffect, useState, useCallback } from 'react'
import { RotateCcw, Search, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/common/PageHeader'
import { BackupTimeline } from '@/components/history/BackupTimeline'
import { ActivityLogTable } from '@/components/log/ActivityLogTable'
import { clientsService } from '@/services/clients.service'
import { logService } from '@/services/log.service'
import type { BackupEntry, ActivityLogEntry } from '@shared/channels'
import type { ClientStatus, ClientId } from '@shared/types'

// ─── Backup tab types & helpers ─────────────────────────────────────────────

type DatePreset = 'all' | '24h' | '7d' | '30d' | 'custom'

const TYPE_OPTIONS: readonly BackupEntry['backupType'][] = ['pristine', 'sync', 'manual']

const buildDateRange = (
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): { from?: string; to?: string } => {
  if (preset === 'all') return {}
  if (preset === 'custom') {
    const from = customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : undefined
    const to = customTo ? new Date(`${customTo}T23:59:59.999`).toISOString() : undefined
    return { ...(from ? { from } : {}), ...(to ? { to } : {}) }
  }

  const now = Date.now()
  const ms =
    preset === '24h'
      ? 24 * 60 * 60 * 1000
      : preset === '7d'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000

  return { from: new Date(now - ms).toISOString(), to: new Date(now).toISOString() }
}

// ─── Activity log constants ─────────────────────────────────────────────────

const ALL_CLIENTS_VALUE = '__all__' as const

const CLIENT_IDS: ClientId[] = [
  'claude-desktop',
  'claude-code',
  'cline',
  'roo-code',
  'cursor',
  'vscode',
  'vscode-insiders',
  'windsurf',
  'zed',
  'jetbrains',
  'gemini-cli',
  'kilo-cli',
  'codex-cli',
  'codex-gui',
  'opencode',
  'visual-studio',
]

// ─── Backups Tab Content ────────────────────────────────────────────────────

const BackupsTabContent = () => {
  const { t } = useTranslation()
  const [clients, setClients] = useState<ClientStatus[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<BackupEntry['backupType'][]>([])
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [openByClientId, setOpenByClientId] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void clientsService.detectAll().then((all) => {
      const installed = all.filter((client) => client.installed)
      setClients(installed)
      setOpenByClientId((previous) => {
        const next = { ...previous }
        installed.forEach((client) => {
          if (next[client.id] === undefined) next[client.id] = true
        })
        return next
      })
      setLoadingClients(false)
    })
  }, [])

  const searchTerm = search.trim().toLowerCase()
  const clientsMatchingName = useMemo(
    () =>
      clients.filter((client) => {
        if (!searchTerm) return true
        const haystack = `${client.displayName} ${client.id}`.toLowerCase()
        return haystack.includes(searchTerm)
      }),
    [clients, searchTerm],
  )

  const activeClients = searchTerm
    ? clientsMatchingName.length > 0
      ? clientsMatchingName
      : clients
    : clients

  const dateRange = useMemo(
    () => buildDateRange(datePreset, customFrom, customTo),
    [customFrom, customTo, datePreset],
  )

  const clearFilters = () => {
    setSearch('')
    setSelectedTypes([])
    setSort('newest')
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
  }

  const hasFilters =
    search.length > 0 || selectedTypes.length > 0 || sort !== 'newest' || datePreset !== 'all'

  return (
    <div className="flex flex-col gap-5" data-testid="backups-tab-content">
      <section className="sticky -top-6 z-20 -mx-6 rounded-none border-b border-border/70 bg-background/95 px-6 pb-4 pt-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="space-y-1">
            <Label htmlFor="history-search" className="text-xs text-muted-foreground">
              {t('history.searchLabel')}
            </Label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute top-2.5 left-2.5 text-muted-foreground"
              />
              <Input
                id="history-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-8"
                placeholder={t('history.searchPlaceholder')}
                data-testid="history-search"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="history-sort" className="text-xs text-muted-foreground">
              {t('history.sortLabel')}
            </Label>
            <Select value={sort} onValueChange={(value) => setSort(value as 'newest' | 'oldest')}>
              <SelectTrigger id="history-sort" className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('history.sortNewest')}</SelectItem>
                <SelectItem value="oldest">{t('history.sortOldest')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="history-date-range" className="text-xs text-muted-foreground">
              {t('history.dateRangeLabel')}
            </Label>
            <Select
              value={datePreset}
              onValueChange={(value) => setDatePreset(value as DatePreset)}
            >
              <SelectTrigger id="history-date-range" className="w-full sm:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('history.dateRangeAll')}</SelectItem>
                <SelectItem value="24h">{t('history.dateRange24h')}</SelectItem>
                <SelectItem value="7d">{t('history.dateRange7d')}</SelectItem>
                <SelectItem value="30d">{t('history.dateRange30d')}</SelectItem>
                <SelectItem value="custom">{t('history.dateRangeCustom')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('history.typeLabel')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map((type) => {
                const selected = selectedTypes.includes(type)
                return (
                  <Button
                    key={type}
                    type="button"
                    size="xs"
                    variant={selected ? 'default' : 'outline'}
                    onClick={() =>
                      setSelectedTypes((previous) =>
                        previous.includes(type)
                          ? previous.filter((entryType) => entryType !== type)
                          : [...previous, type],
                      )
                    }
                    data-testid={`history-type-${type}`}
                  >
                    {t(
                      `history.backupType${type.charAt(0).toUpperCase()}${type.slice(1)}` as Parameters<
                        typeof t
                      >[0],
                    )}
                  </Button>
                )
              })}
            </div>
          </div>

          {datePreset === 'custom' && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="history-custom-from" className="text-xs text-muted-foreground">
                  {t('history.customFromLabel')}
                </Label>
                <Input
                  id="history-custom-from"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="history-custom-to" className="text-xs text-muted-foreground">
                  {t('history.customToLabel')}
                </Label>
                <Input
                  id="history-custom-to"
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              </div>
            </div>
          )}

          {hasFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="ml-auto gap-1.5"
            >
              <RotateCcw size={13} aria-hidden="true" />
              {t('history.clearFilters')}
            </Button>
          )}
        </div>
      </section>

      {loadingClients && <p className="text-sm text-muted-foreground">{t('history.detecting')}</p>}

      {!loadingClients && clients.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="no-clients">
          {t('history.noClients')}
        </p>
      )}

      {!loadingClients && clients.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {t('history.clientCardsCount', { count: activeClients.length })}
          </p>
          <div className="flex flex-col gap-3">
            {activeClients.map((client) => {
              const clientMatchedSearch =
                !searchTerm ||
                `${client.displayName} ${client.id}`.toLowerCase().includes(searchTerm)
              const searchForTimeline = searchTerm && !clientMatchedSearch ? searchTerm : ''

              return (
                <BackupTimeline
                  key={client.id}
                  clientId={client.id}
                  clientName={client.displayName}
                  open={openByClientId[client.id] ?? true}
                  onToggle={() =>
                    setOpenByClientId((previous) => ({
                      ...previous,
                      [client.id]: !(previous[client.id] ?? true),
                    }))
                  }
                  density="compact"
                  filters={{
                    search: searchForTimeline,
                    types: selectedTypes,
                    ...(dateRange.from ? { from: dateRange.from } : {}),
                    ...(dateRange.to ? { to: dateRange.to } : {}),
                    sort,
                  }}
                  clientMatchedSearch={clientMatchedSearch}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Activity Log Tab Content ───────────────────────────────────────────────

const ActivityLogTabContent = () => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [actionFilter, setActionFilter] = useState('')
  const [clientFilter, setClientFilter] = useState<ClientId | ''>('')
  const [sinceFilter, setSinceFilter] = useState('')

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const filters = {
        ...(actionFilter.trim() ? { action: actionFilter.trim() } : {}),
        ...(clientFilter ? { clientId: clientFilter } : {}),
        ...(sinceFilter ? { since: new Date(sinceFilter).toISOString() } : {}),
        limit: 500,
      }
      const results = await logService.query(filters)
      setEntries(results)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast.error(t('activityLog.loadFailed'), { description: message })
    } finally {
      setLoading(false)
    }
  }, [actionFilter, clientFilter, sinceFilter, t])

  useEffect(() => {
    void fetchEntries()
  }, [fetchEntries])

  const hasFilters = Boolean(actionFilter || clientFilter || sinceFilter)

  return (
    <div className="flex flex-col gap-6" data-testid="activity-log-tab-content">
      {/* Header row with entry count and refresh */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t('activityLog.entriesCount', { count: entries.length })}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void fetchEntries()}
          disabled={loading}
          className="gap-1.5"
          data-testid="log-refresh-button"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {t('activityLog.refresh')}
        </Button>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-4"
        role="search"
        aria-label="Activity log filters"
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="log-action-filter" className="text-xs text-muted-foreground">
            {t('activityLog.action')}
          </Label>
          <Input
            id="log-action-filter"
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder={t('activityLog.actionPlaceholder')}
            className="h-8 text-sm"
            data-testid="log-action-filter"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="log-client-filter" className="text-xs text-muted-foreground">
            {t('activityLog.client')}
          </Label>
          <Select
            value={clientFilter || ALL_CLIENTS_VALUE}
            onValueChange={(v) => setClientFilter(v === ALL_CLIENTS_VALUE ? '' : (v as ClientId))}
          >
            <SelectTrigger
              id="log-client-filter"
              className="h-8 text-sm w-40"
              data-testid="log-client-filter"
            >
              <SelectValue placeholder={t('activityLog.allClients')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CLIENTS_VALUE}>{t('activityLog.allClients')}</SelectItem>
              {CLIENT_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="log-since-filter" className="text-xs text-muted-foreground">
            {t('activityLog.since')}
          </Label>
          <Input
            id="log-since-filter"
            type="date"
            value={sinceFilter}
            onChange={(e) => setSinceFilter(e.target.value)}
            className="h-8 text-sm"
            data-testid="log-since-filter"
          />
        </div>

        {hasFilters && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setActionFilter('')
              setClientFilter('')
              setSinceFilter('')
            }}
            data-testid="log-clear-filters"
          >
            {t('activityLog.clearFilters')}
          </Button>
        )}
      </div>

      {/* Table */}
      <ActivityLogTable entries={entries} loading={loading} />
    </div>
  )
}

// ─── Main Page Component ────────────────────────────────────────────────────

/**
 * History page combining backup history and activity log in a tabbed layout.
 * The "Backups" tab shows per-client backup timelines with search, type,
 * date range, and sort filters. The "Activity Log" tab renders the full
 * activity log with action, client, and date filters.
 */
const HistoryPage = () => {
  const { t } = useTranslation()

  return (
    <section
      aria-labelledby="history-heading"
      className="flex flex-col gap-5"
      data-testid="history-page"
    >
      <PageHeader
        id="history-heading"
        title={t('history.title')}
        subtitle={t('history.subtitle')}
      />

      <div className="px-6">
        <Tabs defaultValue="backups">
          <TabsList data-testid="history-tabs-list">
            <TabsTrigger value="backups" data-testid="history-tab-backups">
              {t('history.tabBackups')}
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="history-tab-activity">
              {t('history.tabActivityLog')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="backups">
            <BackupsTabContent />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityLogTabContent />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}

export { HistoryPage }
