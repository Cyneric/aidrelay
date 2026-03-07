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
import { ActivityLogTable } from '@/components/log/ActivityLogTable'
import type { ActivityLogEntry } from '@shared/channels'
import type { ClientId } from '@shared/types'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays the full activity log with optional filters for action type,
 * client, and date range. Refreshes on mount and via a manual button.
 */
const ActivityLogPage = () => {
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
  ]

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
            Activity Log
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} matching current filters
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchEntries()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 transition-colors"
          data-testid="log-refresh-button"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {/* Filters */}
      <div
        className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-4"
        role="search"
        aria-label="Activity log filters"
      >
        {/* Action type */}
        <div className="flex flex-col gap-1">
          <label htmlFor="log-action-filter" className="text-xs font-medium text-muted-foreground">
            Action
          </label>
          <input
            id="log-action-filter"
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="e.g. server.created"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="log-action-filter"
          />
        </div>

        {/* Client */}
        <div className="flex flex-col gap-1">
          <label htmlFor="log-client-filter" className="text-xs font-medium text-muted-foreground">
            Client
          </label>
          <select
            id="log-client-filter"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value as ClientId | '')}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="log-client-filter"
          >
            <option value="">All clients</option>
            {CLIENT_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        {/* Since date */}
        <div className="flex flex-col gap-1">
          <label htmlFor="log-since-filter" className="text-xs font-medium text-muted-foreground">
            Since
          </label>
          <input
            id="log-since-filter"
            type="date"
            value={sinceFilter}
            onChange={(e) => setSinceFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="log-since-filter"
          />
        </div>

        {/* Clear filters */}
        {(actionFilter || clientFilter || sinceFilter) && (
          <button
            type="button"
            onClick={() => {
              setActionFilter('')
              setClientFilter('')
              setSinceFilter('')
            }}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            data-testid="log-clear-filters"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <ActivityLogTable entries={entries} loading={loading} />
    </section>
  )
}

export { ActivityLogPage }
