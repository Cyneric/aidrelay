/**
 * @file src/renderer/pages/HistoryPage.tsx
 *
 * @created 07.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Backup history page with filter-first UX. Supports search,
 * type/date/sort controls, density toggle, and per-client paged timelines.
 */

import { useMemo, useEffect, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
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
import { BackupTimeline } from '@/components/history/BackupTimeline'
import { clientsService } from '@/services/clients.service'
import type { BackupEntry } from '@shared/channels'
import type { ClientStatus } from '@shared/types'

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

const HistoryPage = () => {
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
    <main className="flex flex-col gap-5" data-testid="history-page">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('history.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('history.subtitle')}</p>
      </header>

      <section className="sticky top-0 z-20 rounded-xl border bg-background/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
    </main>
  )
}

export { HistoryPage }
