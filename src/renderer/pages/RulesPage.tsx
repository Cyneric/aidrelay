/**
 * @file src/renderer/pages/RulesPage.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description AI rules management page. Displays all rules in a TanStack Displays all rules in a TanStack
 * Table with per-row enable/disable toggles, category filtering, scope
 * switching, and a collapsible token budget panel. Header actions: Add Rule,
 * Sync Rules, Import.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
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
  Upload,
  Pencil,
  Trash2,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CategoryFilter } from '@/components/rules/CategoryFilter'
import { ScopeToggle } from '@/components/rules/ScopeToggle'
import { RuleEditor } from '@/components/rules/RuleEditor'
import { TokenBudgetPanel } from '@/components/rules/TokenBudgetPanel'
import { ImportRulesDialog } from '@/components/rules/ImportRulesDialog'
import { useRulesStore } from '@/stores/rules.store'
import type { AiRule, RuleScope } from '@shared/types'

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<AiRule>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a Tailwind color class for a token count value.
 * Green for low counts, amber for moderate, red for high.
 */
const tokenColor = (count: number): string => {
  if (count > 2000) return 'text-destructive font-medium'
  if (count > 500) return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground'
}

/**
 * Returns a Tailwind color class for a priority badge.
 */
const priorityColor = (priority: AiRule['priority']): string => {
  switch (priority) {
    case 'critical':
      return 'bg-destructive/15 text-destructive'
    case 'high':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'normal':
      return 'bg-muted text-muted-foreground'
    case 'low':
      return 'bg-muted/50 text-muted-foreground/60'
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full AI rules management page. Shows a searchable, sortable TanStack Table
 * of all registered rules with category filter pills, scope switching, and a
 * collapsible per-client token budget panel.
 */
const RulesPage = () => {
  const { rules, loading, error, load, delete: deleteRule, toggleEnabled } = useRulesStore()

  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [scope, setScope] = useState<RuleScope>('global')
  const [projectPath, setProjectPath] = useState('')
  const [syncingAll, setSyncingAll] = useState(false)
  const [budgetExpanded, setBudgetExpanded] = useState(false)
  const [editingRule, setEditingRule] = useState<AiRule | undefined>(undefined)
  const [showEditor, setShowEditor] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const openCreate = useCallback(() => {
    setEditingRule(undefined)
    setShowEditor(true)
  }, [])

  const openEdit = useCallback((rule: AiRule) => {
    setEditingRule(rule)
    setShowEditor(true)
  }, [])

  const closeEditor = useCallback(() => {
    setShowEditor(false)
    setEditingRule(undefined)
    void load()
  }, [load])

  useEffect(() => {
    void load()
  }, [load])

  // Filter rules by the active scope (and project path when in project scope)
  const scopeFilteredRules = useMemo(
    () =>
      rules.filter((r) => {
        if (r.scope !== scope) return false
        if (scope === 'project' && projectPath && r.projectPath !== projectPath) return false
        return true
      }),
    [rules, scope, projectPath],
  )

  // Further filter by selected category
  const displayedRules = useMemo(
    () =>
      selectedCategory === null
        ? scopeFilteredRules
        : scopeFilteredRules.filter((r) => r.category === selectedCategory),
    [scopeFilteredRules, selectedCategory],
  )

  const totalVisibleTokens = useMemo(
    () => displayedRules.filter((r) => r.enabled).reduce((sum, r) => sum + r.tokenEstimate, 0),
    [displayedRules],
  )

  const handleDelete = useCallback(
    async (rule: AiRule) => {
      if (!window.confirm(`Delete "${rule.name}"? This cannot be undone.`)) return
      await deleteRule(rule.id)
      toast.success(`"${rule.name}" deleted`)
    },
    [deleteRule],
  )

  const handleSyncAll = useCallback(async () => {
    setSyncingAll(true)
    try {
      const results = await window.api.rulesSyncAll()
      const succeeded = results.filter((r) => r.success).length
      if (results.length === 0) {
        toast.info('No installed clients to sync rules to')
      } else {
        toast.success(`Synced rules to ${succeeded} of ${results.length} client(s)`)
      }
    } catch {
      toast.error('Rules sync failed')
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
            data-testid={`rule-enabled-${row.original.id}`}
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
    columnHelper.accessor('category', {
      header: 'Category',
      size: 120,
      cell: ({ getValue }) => (
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{getValue()}</span>
      ),
    }),
    columnHelper.accessor('scope', {
      header: 'Scope',
      size: 80,
      cell: ({ getValue }) => {
        const s = getValue()
        return (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-xs font-medium',
              s === 'global'
                ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400'
                : 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
            )}
          >
            {s}
          </span>
        )
      },
    }),
    columnHelper.accessor('priority', {
      header: 'Priority',
      size: 90,
      cell: ({ getValue }) => {
        const p = getValue()
        return (
          <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', priorityColor(p))}>
            {p}
          </span>
        )
      },
    }),
    columnHelper.accessor('tokenEstimate', {
      header: ({ column }) => (
        <button
          type="button"
          onClick={() => column.toggleSorting()}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
        >
          Tokens <ArrowUpDown size={12} />
        </button>
      ),
      size: 90,
      cell: ({ getValue }) => {
        const count = getValue()
        return (
          <span className={cn('text-xs tabular-nums text-right block', tokenColor(count))}>
            ~{count.toLocaleString()}
          </span>
        )
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      size: 80,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => openEdit(row.original)}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
            aria-label={`Edit ${row.original.name}`}
            data-testid={`rule-edit-${row.original.id}`}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => void handleDelete(row.original)}
            className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
            aria-label={`Delete ${row.original.name}`}
            data-testid={`rule-delete-${row.original.id}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data: displayedRules,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <section
        aria-labelledby="rules-heading"
        className="flex flex-col gap-6"
        data-testid="rules-page"
      >
        {/* Page header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 id="rules-heading" className="text-2xl font-bold tracking-tight">
              Rules
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {rules.length} rule{rules.length !== 1 ? 's' : ''} in the registry
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
              data-testid="import-rules-button"
            >
              <Upload size={14} aria-hidden="true" />
              Import
            </button>
            <button
              type="button"
              onClick={() => void handleSyncAll()}
              disabled={syncingAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="sync-rules-button"
            >
              <RefreshCw
                size={14}
                className={syncingAll ? 'animate-spin' : ''}
                aria-hidden="true"
              />
              {syncingAll ? 'Syncing…' : 'Sync rules'}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="add-rule-button"
            >
              <Plus size={14} aria-hidden="true" />
              Add rule
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

        {/* Scope toggle */}
        <ScopeToggle
          scope={scope}
          onScopeChange={setScope}
          projectPath={projectPath}
          onProjectPathChange={setProjectPath}
        />

        {/* Search + Category filter */}
        <div className="flex flex-col gap-3">
          <input
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search rules…"
            className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Search rules"
            data-testid="rules-search"
          />
          <CategoryFilter
            rules={scopeFilteredRules}
            selected={selectedCategory}
            onChange={setSelectedCategory}
          />
        </div>

        {/* Table */}
        <div className="rounded-md border border-border overflow-hidden">
          {loading ? (
            <div
              className="flex items-center justify-center py-16 text-sm text-muted-foreground"
              data-testid="rules-loading"
            >
              Loading rules…
            </div>
          ) : displayedRules.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 gap-2"
              data-testid="rules-empty"
            >
              <p className="text-sm text-muted-foreground">
                {rules.length === 0
                  ? 'No rules yet.'
                  : `No ${scope} rules${selectedCategory ? ` in "${selectedCategory}"` : ''}.`}
              </p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm" data-testid="rules-table">
                <thead className="bg-muted/50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          scope="col"
                          style={{
                            width: header.getSize() !== 150 ? header.getSize() : undefined,
                          }}
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
                      data-testid={`rule-row-${row.original.id}`}
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

              {/* Token summary footer */}
              <div className="border-t border-border px-4 py-2 flex items-center justify-end gap-2 text-xs text-muted-foreground bg-muted/20">
                <span>
                  {table.getRowModel().rows.length} rule
                  {table.getRowModel().rows.length !== 1 ? 's' : ''} shown
                </span>
                {totalVisibleTokens > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className={tokenColor(totalVisibleTokens)}>
                      ~{totalVisibleTokens.toLocaleString()} tokens (enabled)
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Per-client token budget panel — added in Step 25 */}
        <div className="rounded-md border border-border">
          <button
            type="button"
            onClick={() => setBudgetExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
            aria-expanded={budgetExpanded}
            data-testid="budget-panel-expand"
          >
            <span>Token budget per client</span>
            {budgetExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {budgetExpanded && (
            <div className="border-t border-border px-4 py-4" data-testid="budget-panel-content">
              <TokenBudgetPanel />
            </div>
          )}
        </div>
      </section>

      {/* Rule editor drawer */}
      {showEditor && (
        <RuleEditor
          {...(editingRule !== undefined && { rule: editingRule })}
          onClose={closeEditor}
        />
      )}

      {/* Import rules dialog */}
      {showImport && <ImportRulesDialog onClose={() => setShowImport(false)} />}
    </>
  )
}

export { RulesPage }
