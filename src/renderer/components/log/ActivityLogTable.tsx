/**
 * @file src/renderer/components/log/ActivityLogTable.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description TanStack Table component for the activity log. Displays entries
 * sorted by timestamp descending, with columns for time, action, client, server,
 * and a collapsible details cell. Empty and loading states are handled inline.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  const { t } = useTranslation()
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
      header: () => t('activityLog.time'),
      size: 160,
      cell: ({ getValue }) => (
        <time dateTime={getValue()} className="text-xs text-muted-foreground whitespace-nowrap">
          {formatTimestamp(getValue())}
        </time>
      ),
    }),
    columnHelper.accessor('action', {
      header: () => t('activityLog.action'),
      cell: ({ getValue }) => (
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{getValue()}</span>
      ),
    }),
    columnHelper.accessor('clientId', {
      header: () => t('activityLog.client'),
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
      header: () => t('activityLog.server'),
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
      header: () => t('activityLog.details'),
      cell: ({ row }) => {
        const id = row.original.id
        const expanded = expandedRows.has(id)
        const details = row.original.details
        const hasDetails = Object.keys(details).length > 0

        if (!hasDetails) return <span className="text-xs text-muted-foreground/40">—</span>

        return (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => toggleRow(id)}
              className="gap-1 text-muted-foreground hover:text-foreground"
              aria-expanded={expanded}
              aria-label={
                expanded ? t('activityLog.collapseDetails') : t('activityLog.expandDetails')
              }
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {expanded ? t('activityLog.hideDetails') : t('activityLog.showDetails')}
            </Button>
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
        {t('activityLog.loading')}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-16 text-sm text-muted-foreground"
        data-testid="log-empty"
      >
        {t('activityLog.noFilteredResults')}
      </div>
    )
  }

  return (
    <div
      className="rounded-md border border-border overflow-hidden"
      data-testid="activity-log-table"
    >
      <Table className="w-full text-sm">
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  scope="col"
                  style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="divide-y divide-border">
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="hover:bg-muted/20 transition-colors"
              data-testid={`log-row-${row.original.id}`}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="px-4 py-3 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export { ActivityLogTable }
