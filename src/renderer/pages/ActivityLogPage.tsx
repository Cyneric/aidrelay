/**
 * @file src/renderer/pages/ActivityLogPage.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Activity log page showing a filterable history of all actions
 * performed by aidrelay. Filters include action type, date range, and client.
 * Results are fetched via the `log:query` IPC channel and rendered in the
 * `ActivityLogTable` component.
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
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
import { ActivityLogTable } from '@/components/log/ActivityLogTable'
import type { ActivityLogEntry } from '@shared/channels'
import type { ClientId } from '@shared/types'

const ALL_CLIENTS_VALUE = '__all__' as const

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays the full activity log with optional filters for action type,
 * client, and date range. Refreshes on mount and via a manual button.
 */
const ActivityLogPage = () => {
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
      const results = await window.api.logQuery(filters)
      setEntries(results)
    } catch (err) {
      console.error('Failed to load activity log:', err)
    } finally {
      setLoading(false)
    }
  }, [actionFilter, clientFilter, sinceFilter])

  useEffect(() => {
    void fetchEntries()
  }, [fetchEntries])

  const CLIENT_IDS: ClientId[] = [
    'claude-desktop',
    'claude-code',
    'cursor',
    'vscode',
    'windsurf',
    'zed',
    'jetbrains',
    'codex-cli',
    'codex-gui',
  ]

  const hasFilters = Boolean(actionFilter || clientFilter || sinceFilter)

  return (
    <section
      aria-labelledby="log-heading"
      className="flex flex-col gap-6"
      data-testid="activity-log-page"
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 id="log-heading" className="text-2xl font-bold tracking-tight">
            {t('activityLog.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('activityLog.entriesCount', { count: entries.length })}
          </p>
        </div>
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
      </header>

      {/* Filters */}
      <div
        className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-4"
        role="search"
        aria-label="Activity log filters"
      >
        {/* Action type */}
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

        {/* Client */}
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

        {/* Since date */}
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

        {/* Clear filters */}
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
    </section>
  )
}

export { ActivityLogPage }
