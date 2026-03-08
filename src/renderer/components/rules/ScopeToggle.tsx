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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
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
  const handleBrowse = async () => {
    const result = await window.api.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select project root directory',
    })
    if (!result.canceled && result.filePaths[0]) {
      onProjectPathChange(result.filePaths[0])
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="scope-toggle">
      {/* Scope radio group */}
      <div
        role="radiogroup"
        aria-label="Rule scope"
        className="inline-flex rounded-md border border-input overflow-hidden text-sm"
      >
        <Button
          type="button"
          role="radio"
          aria-checked={scope === 'global'}
          onClick={() => onScopeChange('global')}
          variant={scope === 'global' ? 'default' : 'ghost'}
          size="sm"
          className={cn('rounded-none', scope !== 'global' && 'text-muted-foreground')}
          data-testid="scope-global"
        >
          Global rules
        </Button>
        <Button
          type="button"
          role="radio"
          aria-checked={scope === 'project'}
          onClick={() => onScopeChange('project')}
          variant={scope === 'project' ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'rounded-none border-l border-input',
            scope !== 'project' && 'text-muted-foreground',
          )}
          data-testid="scope-project"
        >
          Project rules
        </Button>
      </div>

      {/* Project path picker — only visible in project scope */}
      {scope === 'project' && (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={projectPath}
            onChange={(e) => onProjectPathChange(e.target.value)}
            placeholder="C:\dev\my-project"
            className="flex-1 max-w-sm font-mono text-xs"
            aria-label="Project directory path"
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
                aria-label="Browse for project directory"
                data-testid="scope-project-browse"
              >
                <FolderOpen size={12} aria-hidden="true" />
                Browse
              </Button>
            </TooltipTrigger>
            <TooltipContent>Browse for project directory</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  )
}

export { ScopeToggle }
