/**
 * @file src/renderer/components/rules/ScopeToggle.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Scope toggle control for the Rules page. Lets users switch
 * between viewing/syncing global rules (user-level, apply everywhere) and
 * project rules (scoped to a specific workspace directory). When project scope
 * is active, a directory path input appears so the user can specify the target
 * project root.
 */

import { FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { RuleScope } from '@shared/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScopeToggleProps {
  /** Currently active scope. */
  readonly scope: RuleScope
  /** Called when the user switches scope. */
  readonly onScopeChange: (scope: RuleScope) => void
  /** The project directory path for project scope, or empty string if none. */
  readonly projectPath: string
  /** Called when the user types or browses to a new project path. */
  readonly onProjectPathChange: (path: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Toggle between global and project-scoped rule views. When project scope is
 * active a text input appears for the project directory path, along with a
 * Browse button that invokes the native folder picker.
 */
const ScopeToggle = ({
  scope,
  onScopeChange,
  projectPath,
  onProjectPathChange,
}: ScopeToggleProps) => {
  const { t } = useTranslation()

  const handleScopeChange = (value: string) => {
    if (value === 'global' || value === 'project') {
      onScopeChange(value)
    }
  }

  const handleBrowse = async () => {
    const result = await window.api.showOpenDialog({
      properties: ['openDirectory'],
      title: t('rules.scopeProjectBrowseTitle'),
    })
    if (!result.canceled && result.filePaths[0]) {
      onProjectPathChange(result.filePaths[0])
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="scope-toggle">
      <Tabs
        value={scope}
        onValueChange={handleScopeChange}
        className="w-full"
        aria-label={t('rules.scopeToggleAriaLabel')}
      >
        <TabsList
          className="h-auto w-full max-w-md justify-start gap-1 rounded-xl border border-border/80 bg-muted/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          aria-label={t('rules.scopeToggleAriaLabel')}
        >
          <TabsTrigger
            value="global"
            className="h-9 min-w-[8.75rem] rounded-lg border border-transparent px-3 text-sm font-semibold text-muted-foreground/90 data-[state=active]:border-border/80 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground"
            data-testid="scope-global"
          >
            {t('rules.scopeGlobal')}
          </TabsTrigger>
          <TabsTrigger
            value="project"
            className="h-9 min-w-[8.75rem] rounded-lg border border-transparent px-3 text-sm font-semibold text-muted-foreground/90 data-[state=active]:border-border/80 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground"
            data-testid="scope-project"
          >
            {t('rules.scopeProject')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Project path picker — only visible in project scope */}
      {scope === 'project' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            value={projectPath}
            onChange={(e) => onProjectPathChange(e.target.value)}
            placeholder={t('rules.scopeProjectPathPlaceholder')}
            className="flex-1 max-w-sm font-mono text-xs"
            aria-label={t('rules.scopeProjectPathAriaLabel')}
            data-testid="scope-project-path"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleBrowse()}
                className="gap-1.5"
                aria-label={t('rules.scopeProjectBrowse')}
                data-testid="scope-project-browse"
              >
                <FolderOpen size={12} aria-hidden="true" />
                {t('rules.scopeProjectBrowse')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('rules.scopeProjectBrowse')}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  )
}

export { ScopeToggle }
