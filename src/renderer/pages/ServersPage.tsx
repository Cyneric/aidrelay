/**
 * @file src/renderer/pages/ServersPage.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
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
  Download,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { ConfirmActionDialog } from '@/components/common/ConfirmActionDialog'
import { useServersStore } from '@/stores/servers.store'
import { useClientsStore } from '@/stores/clients.store'
import { useFeatureGate } from '@/lib/useFeatureGate'
import { useServersActions } from '@/hooks/useServersActions'
import type { McpServer } from '@shared/types'

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<McpServer>()
const COMMAND_PREVIEW_MAX_CHARS = 72

const formatCommandPreview = (
  command: string,
  args: string[],
  maxChars = COMMAND_PREVIEW_MAX_CHARS,
) => {
  const parts = [command, ...args].map((part) => part.trim()).filter((part) => part.length > 0)
  if (parts.length === 0) return ''

  const ellipsis = '...'
  const budget = Math.max(ellipsis.length + 1, maxChars)
  const reservedBudget = budget - ellipsis.length

  const firstPart = parts[0] ?? ''
  if (firstPart.length > reservedBudget) {
    return `${firstPart.slice(0, reservedBudget)}${ellipsis}`
  }

  const previewParts = [firstPart]
  let currentLength = firstPart.length
  let didTruncate = false

  for (const part of parts.slice(1)) {
    const nextLength = currentLength + 1 + part.length
    if (nextLength > reservedBudget) {
      didTruncate = true
      break
    }
    previewParts.push(part)
    currentLength = nextLength
  }

  const preview = previewParts.join(' ')
  return didTruncate ? `${preview}${ellipsis}` : preview
}

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
  const [pendingDeleteServer, setPendingDeleteServer] = useState<McpServer | null>(null)
  const [deletingServer, setDeletingServer] = useState(false)
  const {
    syncingAll,
    importingFromClients,
    getTestingPhase,
    isTestingServer,
    getTestStatus,
    handleTest,
    handleSyncAll,
    handleImportFromClients,
  } = useServersActions({ onImported: load, t })

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

  const handleDelete = useCallback((server: McpServer) => {
    setPendingDeleteServer(server)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteServer) return
    setDeletingServer(true)
    try {
      await deleteServer(pendingDeleteServer.id)
      toast.success(t('servers.deleted'))
      setPendingDeleteServer(null)
    } finally {
      setDeletingServer(false)
    }
  }, [deleteServer, pendingDeleteServer, t])

  const handleCopyCommand = useCallback(
    async (fullCommand: string) => {
      try {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
          throw new Error('Clipboard unavailable')
        }
        await navigator.clipboard.writeText(fullCommand)
        toast.success(t('servers.copyCommandSuccess'))
      } catch {
        toast.error(t('servers.copyCommandFailed'))
      }
    },
    [t],
  )

  // ─── Table columns ──────────────────────────────────────────────────────────

  const columns = [
    columnHelper.accessor('enabled', {
      header: '',
      size: 44,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Checkbox
            checked={row.original.enabled}
            onCheckedChange={() => void toggleEnabled(row.original.id)}
            aria-label={t('servers.enableDisable', {
              action: row.original.enabled ? t('servers.disable') : t('servers.enable'),
              name: row.original.name,
            })}
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
          {t('servers.name')} <ArrowUpDown size={12} />
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
      header: () => t('servers.type'),
      size: 64,
      cell: ({ getValue }) => (
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{getValue()}</span>
      ),
    }),
    columnHelper.display({
      id: 'status',
      header: () => t('servers.status'),
      size: 108,
      cell: ({ row }) => {
        const status = getTestStatus(row.original.id)
        if (status === 'success') {
          return (
            <Badge
              variant="secondary"
              className="border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              data-testid={`server-test-status-${row.original.id}`}
            >
              {t('servers.testStatus.passed')}
            </Badge>
          )
        }
        if (status === 'failure') {
          return (
            <Badge variant="destructive" data-testid={`server-test-status-${row.original.id}`}>
              {t('servers.testStatus.failed')}
            </Badge>
          )
        }
        return (
          <Badge variant="outline" data-testid={`server-test-status-${row.original.id}`}>
            {t('servers.testStatus.not_tested')}
          </Badge>
        )
      },
    }),
    columnHelper.accessor('command', {
      header: () => t('servers.command'),
      size: 320,
      cell: ({ getValue, row }) => {
        const fullCommand = `${getValue()} ${row.original.args.join(' ')}`.trim()
        const previewCommand = formatCommandPreview(getValue(), row.original.args)
        const testingPhase = getTestingPhase(row.original.id)
        const isTestingRow = testingPhase !== null
        return (
          <div className="group relative w-full max-w-[24rem] min-w-0 pr-8">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="block min-w-0 cursor-default truncate font-mono text-xs text-muted-foreground"
                  data-testid={`server-command-text-${row.original.id}`}
                  title={fullCommand}
                >
                  {previewCommand}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[50rem] break-all font-mono text-[11px] leading-relaxed">
                {fullCommand}
              </TooltipContent>
            </Tooltip>
            {isTestingRow && testingPhase && (
              <span
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                data-testid={`server-test-phase-${row.original.id}`}
              >
                <RefreshCw size={11} className="animate-spin" />
                {t(`servers.testPhases.${testingPhase}`)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleCopyCommand(fullCommand)}
                  className="absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                  aria-label={t('servers.copyCommand', { name: row.original.name })}
                  data-testid={`server-command-copy-${row.original.id}`}
                >
                  <Copy size={12} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('servers.copyCommandTooltip')}</TooltipContent>
            </Tooltip>
          </div>
        )
      },
    }),
    columnHelper.accessor('tags', {
      header: () => t('servers.tags'),
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
      size: 94,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void handleTest(row.original)}
                disabled={!serverTestingEnabled || isTestingServer(row.original.id)}
                aria-label={t('servers.testAria', { name: row.original.name })}
                data-testid={`server-test-${row.original.id}`}
              >
                {isTestingServer(row.original.id) ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <FlaskConical size={14} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {serverTestingEnabled
                ? t('servers.testTooltip', { name: row.original.name })
                : t('servers.testUpgradeTooltip')}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit(row.original)}
                aria-label={t('servers.editAria', { name: row.original.name })}
                data-testid={`server-edit-${row.original.id}`}
              >
                <Pencil size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('servers.editTooltip')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void handleDelete(row.original)}
                aria-label={t('servers.deleteAria', { name: row.original.name })}
                data-testid={`server-delete-${row.original.id}`}
              >
                <Trash2 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('servers.deleteTooltip')}</TooltipContent>
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
              {t('servers.countInRegistry', { count: servers.length })}
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
              <TooltipContent>{t('servers.importFromClientsTooltip')}</TooltipContent>
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
              <TooltipContent>{t('servers.syncAllTooltip')}</TooltipContent>
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
              {t('servers.loading')}
            </div>
          ) : servers.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 gap-3"
              data-testid="servers-empty"
            >
              <p className="text-sm text-muted-foreground">{t('servers.noServersYet')}</p>
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
                <span className="text-muted-foreground">{t('servers.or')}</span>
                <Button
                  type="button"
                  variant="link"
                  onClick={openCreate}
                  className="h-auto p-0 text-sm"
                >
                  {t('servers.addFirst')}
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
                        className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider first:rounded-tl-md last:rounded-tr-md"
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
                      <TableCell key={cell.id} className="px-3 py-2.5">
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
            <span>{t('servers.perClientEnableDisable')}</span>
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

      <ConfirmActionDialog
        open={pendingDeleteServer !== null}
        title={t('servers.deleteDialogTitle')}
        description={
          pendingDeleteServer
            ? t('servers.deleteDialogDescription', { name: pendingDeleteServer.name })
            : ''
        }
        confirmLabel={t('servers.delete')}
        pending={deletingServer}
        variant="destructive"
        onCancel={() => {
          if (!deletingServer) setPendingDeleteServer(null)
        }}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </>
  )
}

export { ServersPage }
