/**
 * @file src/renderer/components/log/ActivityLogTable.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description TanStack Table component for the activity log. Displays entries
 * sorted by timestamp descending, with columns for time, action, client, server,
 * and a collapsible details cell. Empty and loading states are handled inline.
 */

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ActivityLogEntry } from '@shared/channels'

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<ActivityLogEntry>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats an ISO timestamp into a human-readable date + time string.
 *
 * @param iso - ISO 8601 timestamp string.
 * @returns Locale-formatted date and time.
 */
const formatTimestamp = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ActivityLogTableProps {
  readonly entries: ActivityLogEntry[]
  readonly loading?: boolean
}

/**
 * Sortable table of activity log entries. Each row has a toggle to expand the
 * `details` JSON object for deeper inspection.
 */
const ActivityLogTable = ({ entries, loading = false }: ActivityLogTableProps) => {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const toggleRow = (id: number) =>
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  const columns = [
    columnHelper.accessor('timestamp', {
      header: 'Time',
      size: 160,
      cell: ({ getValue }) => (
        <time dateTime={getValue()} className="text-xs text-muted-foreground whitespace-nowrap">
          {formatTimestamp(getValue())}
        </time>
      ),
    }),
    columnHelper.accessor('action', {
      header: 'Action',
      cell: ({ getValue }) => (
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{getValue()}</span>
      ),
    }),
    columnHelper.accessor('clientId', {
      header: 'Client',
      size: 120,
      cell: ({ getValue }) => {
        const val = getValue()
        return val ? (
          <span className="text-xs text-muted-foreground">{val}</span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )
      },
    }),
    columnHelper.accessor('serverId', {
      header: 'Server',
      cell: ({ getValue }) => {
        const val = getValue()
        return val ? (
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[120px] block">
            {val}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )
      },
    }),
    columnHelper.display({
      id: 'details',
      header: 'Details',
      cell: ({ row }) => {
        const id = row.original.id
        const expanded = expandedRows.has(id)
        const details = row.original.details
        const hasDetails = Object.keys(details).length > 0

        if (!hasDetails) return <span className="text-xs text-muted-foreground/40">—</span>

        return (
          <div>
            <button
              type="button"
              onClick={() => toggleRow(id)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {expanded ? 'Hide' : 'Show'}
            </button>
            {expanded && (
              <pre className="mt-2 rounded bg-muted p-2 text-xs overflow-x-auto max-w-[300px]">
                {JSON.stringify(details, null, 2)}
              </pre>
            )}
          </div>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-16 text-sm text-muted-foreground"
        data-testid="log-loading"
      >
        Loading activity log…
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-16 text-sm text-muted-foreground"
        data-testid="log-empty"
      >
        No log entries match the current filters.
      </div>
    )
  }

  return (
    <div
      className="rounded-md border border-border overflow-hidden"
      data-testid="activity-log-table"
    >
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-border">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-muted/20 transition-colors"
              data-testid={`log-row-${row.original.id}`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { ActivityLogTable }
