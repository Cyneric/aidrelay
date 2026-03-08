/**
 * @file src/renderer/pages/ServersPage.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
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
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  const { t } = useTranslation()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [editingServer, setEditingServer] = useState<McpServer | undefined>(undefined)
  const [showEditor, setShowEditor] = useState(false)
  const [matrixExpanded, setMatrixExpanded] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [importingFromClients, setImportingFromClients] = useState(false)
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

  const handleImportFromClients = useCallback(async () => {
    setImportingFromClients(true)
    try {
      const result = await window.api.serversImportFromClients()
      await load()
      if (result.errors.length > 0) {
        toast.info(
          t('servers.importSuccessErrors', {
            imported: result.imported,
            skipped: result.skipped,
            count: result.errors.length,
          }),
          { description: result.errors.slice(0, 3).join(' ') },
        )
      } else {
        toast.success(
          t('servers.importSuccess', {
            imported: result.imported,
            skipped: result.skipped,
          }),
        )
      }
    } catch {
      toast.error(t('common.error'))
    } finally {
      setImportingFromClients(false)
    }
  }, [load, t])

  // ─── Table columns ──────────────────────────────────────────────────────────

  const columns = [
    columnHelper.accessor('enabled', {
      header: '',
      size: 48,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Checkbox
            checked={row.original.enabled}
            onCheckedChange={() => void toggleEnabled(row.original.id)}
            aria-label={`${row.original.enabled ? 'Disable' : 'Enable'} ${row.original.name}`}
            data-testid={`server-enabled-${row.original.id}`}
          />
        </div>
      ),
    }),
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => column.toggleSorting()}
          className="gap-1 -ml-1 text-muted-foreground hover:text-foreground"
        >
          Name <ArrowUpDown size={12} />
        </Button>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void handleTest(row.original)}
                disabled={!serverTestingEnabled || testingServerId === row.original.id}
                aria-label={`Test ${row.original.name}`}
                data-testid={`server-test-${row.original.id}`}
              >
                <FlaskConical
                  size={14}
                  className={testingServerId === row.original.id ? 'animate-pulse' : ''}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {serverTestingEnabled
                ? `Test ${row.original.name}`
                : 'Upgrade to Pro to test servers'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit(row.original)}
                aria-label={`Edit ${row.original.name}`}
                data-testid={`server-edit-${row.original.id}`}
              >
                <Pencil size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit server</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void handleDelete(row.original)}
                aria-label={`Delete ${row.original.name}`}
                data-testid={`server-delete-${row.original.id}`}
              >
                <Trash2 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete server</TooltipContent>
          </Tooltip>
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
              {t('servers.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {servers.length} server{servers.length !== 1 ? 's' : ''} in the registry
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleImportFromClients()}
                  disabled={importingFromClients || installedClientCount === 0}
                  className="gap-1.5"
                  data-testid="import-from-clients-button"
                >
                  <Download
                    size={14}
                    className={importingFromClients ? 'animate-pulse' : ''}
                    aria-hidden="true"
                  />
                  {importingFromClients ? t('common.loading') : t('servers.importFromClients')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import server configs from installed AI clients</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSyncAll()}
                  disabled={syncingAll || installedClientCount === 0}
                  className="gap-1.5"
                  data-testid="sync-all-button"
                >
                  <RefreshCw
                    size={14}
                    className={syncingAll ? 'animate-spin' : ''}
                    aria-hidden="true"
                  />
                  {syncingAll ? t('common.loading') : t('servers.syncAll')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Write active profile to all installed clients</TooltipContent>
            </Tooltip>
            <Button
              type="button"
              onClick={openCreate}
              className="gap-1.5"
              data-testid="add-server-button"
            >
              <Plus size={14} aria-hidden="true" />
              {t('servers.add')}
            </Button>
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
          <Input
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={t('servers.search')}
            className="max-w-sm"
            aria-label={t('servers.search')}
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
              className="flex flex-col items-center justify-center py-16 gap-3"
              data-testid="servers-empty"
            >
              <p className="text-sm text-muted-foreground">No servers yet.</p>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => void handleImportFromClients()}
                  disabled={importingFromClients || installedClientCount === 0}
                  className="h-auto p-0 text-sm"
                >
                  {t('servers.importFromClients')}
                </Button>
                <span className="text-muted-foreground">or</span>
                <Button
                  type="button"
                  variant="link"
                  onClick={openCreate}
                  className="h-auto p-0 text-sm"
                >
                  Add your first server
                </Button>
              </div>
            </div>
          ) : (
            <Table className="w-full text-sm" data-testid="servers-table">
              <TableHeader className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        scope="col"
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                        className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider first:rounded-tl-md last:rounded-tr-md"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/30 transition-colors"
                    data-testid={`server-row-${row.original.id}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Per-client toggle matrix */}
        <div className="rounded-md border border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMatrixExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium rounded-none rounded-t-md"
            aria-expanded={matrixExpanded}
            data-testid="toggle-matrix-expand"
          >
            <span>Per-client enable / disable</span>
            {matrixExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </Button>
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
