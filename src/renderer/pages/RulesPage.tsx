/**
 * @file src/renderer/pages/RulesPage.tsx
 *
 * @created 07.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description AI rules and skills management page. Uses top-level tabs to
 * switch between the rules table (with scope toggle, category filter, and
 * token budget panel) and the embedded Skills view. The rules-specific header
 * actions (Add Rule, Sync, Import) are shown only when the Rules tab is active.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { flexRender } from '@tanstack/react-table'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/common/PageHeader'
import { CategoryFilter } from '@/components/rules/CategoryFilter'
import { ScopeToggle } from '@/components/rules/ScopeToggle'
import { RuleEditor } from '@/components/rules/RuleEditor'
import { TokenBudgetPanel } from '@/components/rules/TokenBudgetPanel'
import { ImportRulesDialog } from '@/components/rules/ImportRulesDialog'
import { tokenTextClass } from '@/components/rules/tokenBadgeSeverity'
import { ConfirmActionDialog } from '@/components/common/ConfirmActionDialog'
import { SyncCenterDialog } from '@/components/sync/SyncCenterDialog'
import { SkillsPage } from '@/pages/SkillsPage'
import { useRulesStore } from '@/stores/rules.store'
import { rulesService } from '@/services/rules.service'
import { rulesColumnHelper, useRulesTable } from '@/hooks/useRulesTable'
import type { AiRule, RuleScope, SyncPlanScope } from '@shared/types'

// ─── Types ───────────────────────────────────────────────────────────────────

type RulesTab = 'rules' | 'skills'

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Full AI rules and skills management page. Top-level tabs switch between
 * the rules table and the embedded SkillsPage. Rules-specific header actions
 * are conditionally rendered based on the active tab.
 */
const RulesPage = () => {
  const { rules, loading, error, load, delete: deleteRule, toggleEnabled } = useRulesStore()
  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState<RulesTab>('rules')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [scope, setScope] = useState<RuleScope>('global')
  const [projectPath, setProjectPath] = useState('')
  const [syncingAll, setSyncingAll] = useState(false)
  const [budgetExpanded, setBudgetExpanded] = useState(true)
  const [editingRule, setEditingRule] = useState<AiRule | undefined>(undefined)
  const [showEditor, setShowEditor] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [pendingDeleteRule, setPendingDeleteRule] = useState<AiRule | null>(null)
  const [deletingRule, setDeletingRule] = useState(false)
  const [syncPlanScope, setSyncPlanScope] = useState<SyncPlanScope | null>(null)

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

  const scopeFilteredRules = useMemo(
    () =>
      rules.filter((r) => {
        if (r.scope !== scope) return false
        if (scope === 'project' && projectPath && r.projectPath !== projectPath) return false
        return true
      }),
    [rules, scope, projectPath],
  )

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

  const handleDelete = useCallback((rule: AiRule) => {
    setPendingDeleteRule(rule)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteRule) return
    setDeletingRule(true)
    try {
      await deleteRule(pendingDeleteRule.id)
      toast.success(t('rules.deleted'))
      setPendingDeleteRule(null)
    } finally {
      setDeletingRule(false)
    }
  }, [deleteRule, pendingDeleteRule, t])

  const handleConfirmRulesSync = useCallback(async () => {
    setSyncingAll(true)
    try {
      const results = await rulesService.syncAll()
      const succeeded = results.filter((r) => r.success).length
      if (results.length === 0) {
        toast.info(t('rules.noClientsToSync'))
      } else {
        toast.success(
          t('rules.syncSummary', { succeeded, total: results.length, count: results.length }),
        )
      }
    } catch {
      toast.error(t('rules.syncFailed'))
    } finally {
      setSyncingAll(false)
    }
  }, [t])

  const handleConfirmRulesSyncPlan = useCallback(() => {
    void (async () => {
      await handleConfirmRulesSync()
      setSyncPlanScope(null)
    })()
  }, [handleConfirmRulesSync])

  // ─── Rules-specific header actions ─────────────────────────────────────────

  const rulesActions = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setShowImport(true)}
        className="gap-1.5"
        data-testid="import-rules-button"
      >
        <Upload size={14} aria-hidden="true" />
        {t('rules.importFromProject')}
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSyncPlanScope({ kind: 'rules-all' })}
            disabled={syncingAll}
            className="gap-1.5"
            data-testid="sync-rules-button"
          >
            <RefreshCw size={14} className={syncingAll ? 'animate-spin' : ''} aria-hidden="true" />
            {syncingAll ? t('common.loading') : t('rules.syncAll')}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('rules.syncAllTooltip')}</TooltipContent>
      </Tooltip>
      <Button type="button" onClick={openCreate} className="gap-1.5" data-testid="add-rule-button">
        <Plus size={14} aria-hidden="true" />
        {t('rules.add')}
      </Button>
    </>
  )

  // ─── Table columns ────────────────────────────────────────────────────────

  const columns = [
    rulesColumnHelper.accessor('enabled', {
      header: '',
      size: 44,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Checkbox
            checked={row.original.enabled}
            onCheckedChange={() => void toggleEnabled(row.original.id)}
            aria-label={t('rules.enableDisable', {
              action: row.original.enabled ? t('rules.disable') : t('rules.enable'),
              name: row.original.name,
            })}
            data-testid={`rule-enabled-${row.original.id}`}
          />
        </div>
      ),
    }),
    rulesColumnHelper.accessor('name', {
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => column.toggleSorting()}
          className="gap-1 -ml-1 text-muted-foreground hover:text-foreground"
        >
          {t('rules.name')} <ArrowUpDown size={12} />
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
    rulesColumnHelper.accessor('category', {
      header: () => t('rules.category'),
      size: 108,
      cell: ({ getValue }) => (
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{getValue()}</span>
      ),
    }),
    rulesColumnHelper.accessor('scope', {
      header: () => t('rules.scope'),
      size: 72,
      cell: ({ getValue }) => {
        const s = getValue()
        return (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-xs font-medium',
              s === 'global'
                ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400'
                : 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
            )}
          >
            {s}
          </span>
        )
      },
    }),
    rulesColumnHelper.accessor('priority', {
      header: () => t('rules.priority'),
      size: 82,
      cell: ({ getValue }) => {
        const p = getValue()
        return (
          <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', priorityColor(p))}>
            {p}
          </span>
        )
      },
    }),
    rulesColumnHelper.accessor('tokenEstimate', {
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => column.toggleSorting()}
          className="gap-1 ml-auto -mr-1 text-muted-foreground hover:text-foreground"
        >
          {t('rules.tokens')} <ArrowUpDown size={12} />
        </Button>
      ),
      size: 82,
      cell: ({ getValue }) => {
        const count = getValue()
        return (
          <span className={cn('text-xs tabular-nums text-right block', tokenTextClass(count))}>
            ~{count.toLocaleString()}
          </span>
        )
      },
    }),
    rulesColumnHelper.display({
      id: 'actions',
      header: '',
      size: 72,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit(row.original)}
                aria-label={t('rules.editAria', { name: row.original.name })}
                data-testid={`rule-edit-${row.original.id}`}
              >
                <Pencil size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('rules.editTooltip')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void handleDelete(row.original)}
                aria-label={t('rules.deleteAria', { name: row.original.name })}
                data-testid={`rule-delete-${row.original.id}`}
              >
                <Trash2 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('rules.deleteTooltip')}</TooltipContent>
          </Tooltip>
        </div>
      ),
    }),
  ]

  const { table, globalFilter, setGlobalFilter } = useRulesTable(
    displayedRules,
    columns as Parameters<typeof useRulesTable>[1],
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <section aria-labelledby="rules-heading" className="flex flex-col" data-testid="rules-page">
        <PageHeader
          id="rules-heading"
          title={t('rules.title')}
          subtitle={t('rules.subtitle')}
          actions={activeTab === 'rules' ? rulesActions : undefined}
          testId="rules-page-header"
        />

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as RulesTab)}
          className="px-6 pb-6"
          data-testid="rules-tabs"
        >
          <TabsList data-testid="rules-tabs-list">
            <TabsTrigger value="rules" data-testid="rules-tab-rules">
              {t('rules.tabRules')}
            </TabsTrigger>
            <TabsTrigger value="skills" data-testid="rules-tab-skills">
              {t('rules.tabSkills')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="flex flex-col gap-6 pt-4">
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
              <Input
                type="search"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={t('rules.search')}
                className="max-w-sm"
                aria-label={t('rules.search')}
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
                  {t('rules.loading')}
                </div>
              ) : displayedRules.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-16 gap-2"
                  data-testid="rules-empty"
                >
                  <p className="text-sm text-muted-foreground">
                    {rules.length === 0
                      ? t('rules.noRulesYet')
                      : selectedCategory
                        ? t('rules.noScopeRulesInCategory', {
                            scope,
                            category: selectedCategory,
                          })
                        : t('rules.noScopeRules', { scope })}
                  </p>
                </div>
              ) : (
                <>
                  <Table className="w-full text-sm" data-testid="rules-table">
                    <TableHeader className="bg-muted/50">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead
                              key={header.id}
                              scope="col"
                              style={{
                                width: header.getSize() !== 150 ? header.getSize() : undefined,
                              }}
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
                          data-testid={`rule-row-${row.original.id}`}
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

                  {/* Token summary footer */}
                  <div className="border-t border-border px-3 py-2 flex items-center justify-end gap-2 text-xs text-muted-foreground bg-muted/20">
                    <span>{t('rules.shownCount', { count: table.getRowModel().rows.length })}</span>
                    {totalVisibleTokens > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className={tokenTextClass(totalVisibleTokens)}>
                          {t('rules.tokensEnabled', { count: totalVisibleTokens })}
                        </span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Per-client token budget panel */}
            <div className="rounded-md border border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBudgetExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium rounded-none rounded-t-md"
                aria-expanded={budgetExpanded}
                data-testid="budget-panel-expand"
              >
                <span>{t('rules.tokenBudgetPerClient')}</span>
                {budgetExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </Button>
              {budgetExpanded && (
                <div
                  className="border-t border-border px-4 py-4"
                  data-testid="budget-panel-content"
                >
                  <TokenBudgetPanel />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="skills" className="pt-4" data-testid="rules-skills-tab-content">
            <SkillsPage />
          </TabsContent>
        </Tabs>
      </section>

      {/* Rule editor drawer */}
      <SyncCenterDialog
        open={syncPlanScope !== null}
        onOpenChange={(next) => {
          if (!next) setSyncPlanScope(null)
        }}
        mode="confirmation"
        scope={syncPlanScope ?? { kind: 'app' }}
        confirming={syncingAll}
        onConfirm={handleConfirmRulesSyncPlan}
      />

      {/* Rule editor drawer */}
      {showEditor && (
        <RuleEditor
          {...(editingRule !== undefined && { rule: editingRule })}
          onClose={closeEditor}
        />
      )}

      {/* Import rules dialog */}
      {showImport && <ImportRulesDialog onClose={() => setShowImport(false)} />}

      <ConfirmActionDialog
        open={pendingDeleteRule !== null}
        title={t('rules.deleteDialogTitle')}
        description={
          pendingDeleteRule
            ? t('rules.deleteDialogDescription', { name: pendingDeleteRule.name })
            : ''
        }
        confirmLabel={t('rules.delete')}
        pending={deletingRule}
        variant="destructive"
        onCancel={() => {
          if (!deletingRule) setPendingDeleteRule(null)
        }}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </>
  )
}

export { RulesPage }
