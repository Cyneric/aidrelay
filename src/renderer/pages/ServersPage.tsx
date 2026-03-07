/**
 * @file src/renderer/pages/ServersPage.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description MCP server registry page. Displays all servers in a TanStack
 * Table with per-row enable/disable toggles, edit and delete actions, and a
 * header-level "Sync All" button. The per-client toggle matrix is shown in a
 * collapsible section below the table.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  FlaskConical,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ServerEditor } from '@/components/servers/ServerEditor'
import { ToggleMatrix } from '@/components/servers/ToggleMatrix'
import { useServersStore } from '@/stores/servers.store'
import { useClientsStore } from '@/stores/clients.store'
import { useFeatureGate } from '@/lib/useFeatureGate'
import type { McpServer } from '@shared/types'

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<McpServer>()

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full server management page. Shows a searchable, sortable TanStack Table of
 * all registered MCP servers, plus a collapsible per-client toggle matrix.
 */
const ServersPage = () => {
  const { servers, loading, error, load, delete: deleteServer, toggleEnabled } = useServersStore()
  const { clients, detectAll } = useClientsStore()
  const serverTestingEnabled = useFeatureGate('serverTesting')
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [editingServer, setEditingServer] = useState<McpServer | undefined>(undefined)
  const [showEditor, setShowEditor] = useState(false)
  const [matrixExpanded, setMatrixExpanded] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [testingServerId, setTestingServerId] = useState<string | null>(null)

  useEffect(() => {
    void load()
    void detectAll()
  }, [load, detectAll])

  const openCreate = useCallback(() => {
    setEditingServer(undefined)
    setShowEditor(true)
  }, [])

  const openEdit = useCallback((server: McpServer) => {
    setEditingServer(server)
    setShowEditor(true)
  }, [])

  const closeEditor = useCallback(() => {
    setShowEditor(false)
    setEditingServer(undefined)
    void load()
  }, [load])

  const handleDelete = useCallback(
    async (server: McpServer) => {
      if (!window.confirm(`Delete "${server.name}"? This cannot be undone.`)) return
      await deleteServer(server.id)
      toast.success(`"${server.name}" deleted`)
    },
    [deleteServer],
  )

  const handleTest = useCallback(async (server: McpServer) => {
    setTestingServerId(server.id)
    try {
      const result = await window.api.serversTest(server.id)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error(`Failed to test "${server.name}"`)
    } finally {
      setTestingServerId(null)
    }
  }, [])

  const handleSyncAll = useCallback(async () => {
    setSyncingAll(true)
    try {
      const results = await window.api.clientsSyncAll()
      const succeeded = results.filter((r) => r.success).length
      toast.success(`Synced to ${succeeded} of ${results.length} client(s)`)
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncingAll(false)
    }
  }, [])

  // ─── Table columns ──────────────────────────────────────────────────────────

  const columns = [
    columnHelper.accessor('enabled', {
      header: '',
      size: 48,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={row.original.enabled}
            onChange={() => void toggleEnabled(row.original.id)}
            aria-label={`${row.original.enabled ? 'Disable' : 'Enable'} ${row.original.name}`}
            className="h-4 w-4 cursor-pointer accent-primary"
            data-testid={`server-enabled-${row.original.id}`}
          />
        </div>
      ),
    }),
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <button
          type="button"
          onClick={() => column.toggleSorting()}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          Name <ArrowUpDown size={12} />
        </button>
      ),
      cell: ({ getValue, row }) => (
        <span
          className={cn(
            'font-mono text-sm',
            !row.original.enabled && 'text-muted-foreground line-through',
          )}
        >
          {getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('type', {
      header: 'Type',
      size: 80,
      cell: ({ getValue }) => (
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{getValue()}</span>
      ),
    }),
    columnHelper.accessor('command', {
      header: 'Command',
      cell: ({ getValue, row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {getValue()} {row.original.args.join(' ')}
        </span>
      ),
    }),
    columnHelper.accessor('tags', {
      header: 'Tags',
      enableSorting: false,
      cell: ({ getValue }) => {
        const tags = getValue()
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-accent text-accent-foreground px-1.5 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      size: 112,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => void handleTest(row.original)}
            disabled={!serverTestingEnabled || testingServerId === row.original.id}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`Test ${row.original.name}`}
            title={
              serverTestingEnabled ? `Test ${row.original.name}` : 'Upgrade to Pro to test servers'
            }
            data-testid={`server-test-${row.original.id}`}
          >
            <FlaskConical
              size={14}
              className={testingServerId === row.original.id ? 'animate-pulse' : ''}
            />
          </button>
          <button
            type="button"
            onClick={() => openEdit(row.original)}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
            aria-label={`Edit ${row.original.name}`}
            data-testid={`server-edit-${row.original.id}`}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => void handleDelete(row.original)}
            className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
            aria-label={`Delete ${row.original.name}`}
            data-testid={`server-delete-${row.original.id}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data: servers,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // ─── Render ──────────────────────────────────────────────────────────────────

  const installedClientCount = clients.filter((c) => c.installed).length

  return (
    <>
      <section
        aria-labelledby="servers-heading"
        className="flex flex-col gap-6"
        data-testid="servers-page"
      >
        {/* Page header */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 id="servers-heading" className="text-2xl font-bold tracking-tight">
              Servers
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {servers.length} server{servers.length !== 1 ? 's' : ''} in the registry
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSyncAll()}
              disabled={syncingAll || installedClientCount === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="sync-all-button"
            >
              <RefreshCw
                size={14}
                className={syncingAll ? 'animate-spin' : ''}
                aria-hidden="true"
              />
              {syncingAll ? 'Syncing…' : 'Sync all'}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="add-server-button"
            >
              <Plus size={14} aria-hidden="true" />
              Add server
            </button>
          </div>
        </header>

        {/* Error state */}
        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {/* Search */}
        <div>
          <input
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search servers…"
            className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Search servers"
            data-testid="servers-search"
          />
        </div>

        {/* Table */}
        <div className="rounded-md border border-border overflow-hidden">
          {loading ? (
            <div
              className="flex items-center justify-center py-16 text-sm text-muted-foreground"
              data-testid="servers-loading"
            >
              Loading servers…
            </div>
          ) : servers.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 gap-2"
              data-testid="servers-empty"
            >
              <p className="text-sm text-muted-foreground">No servers yet.</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-sm text-primary hover:underline"
              >
                Add your first server
              </button>
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="servers-table">
              <thead className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                        className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider first:rounded-tl-md last:rounded-tr-md"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/30 transition-colors"
                    data-testid={`server-row-${row.original.id}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Per-client toggle matrix */}
        <div className="rounded-md border border-border">
          <button
            type="button"
            onClick={() => setMatrixExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
            aria-expanded={matrixExpanded}
            data-testid="toggle-matrix-expand"
          >
            <span>Per-client enable / disable</span>
            {matrixExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {matrixExpanded && (
            <div className="border-t border-border px-4 py-4">
              <ToggleMatrix />
            </div>
          )}
        </div>
      </section>

      {/* Server editor drawer */}
      {showEditor && (
        <ServerEditor
          {...(editingServer !== undefined && { server: editingServer })}
          onClose={closeEditor}
        />
      )}
    </>
  )
}

export { ServersPage }
