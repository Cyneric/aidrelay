/**
 * @file src/renderer/components/rules/ScopeToggle.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
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
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'global'}
          onClick={() => onScopeChange('global')}
          className={`px-3 py-1.5 transition-colors ${
            scope === 'global'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted'
          }`}
          data-testid="scope-global"
        >
          Global rules
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'project'}
          onClick={() => onScopeChange('project')}
          className={`px-3 py-1.5 border-l border-input transition-colors ${
            scope === 'project'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted'
          }`}
          data-testid="scope-project"
        >
          Project rules
        </button>
      </div>

      {/* Project path picker — only visible in project scope */}
      {scope === 'project' && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={projectPath}
            onChange={(e) => onProjectPathChange(e.target.value)}
            placeholder="C:\dev\my-project"
            className="flex-1 max-w-sm rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Project directory path"
            data-testid="scope-project-path"
          />
          <button
            type="button"
            onClick={() => void handleBrowse()}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs hover:bg-accent transition-colors"
            aria-label="Browse for project directory"
            data-testid="scope-project-browse"
          >
            <FolderOpen size={12} aria-hidden="true" />
            Browse
          </button>
        </div>
      )}
    </div>
  )
}

export { ScopeToggle }
