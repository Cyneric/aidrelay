/**
 * @file src/renderer/components/servers/EnvVarEditor.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Dynamic list editor for MCP server environment variables.
 * Each row has a key, a value (hidden when marked as secret), and a toggle
 * that moves the key into the `secretEnvKeys` array while keeping the display
 * key visible. The component is uncontrolled from its parent's perspective —
 * call `onChange` is fired whenever the env map or secret keys change.
 */

import { useState, useCallback } from 'react'
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnvEntry {
  key: string
  value: string
  isSecret: boolean
}

interface EnvVarEditorProps {
  /** Current non-secret env vars. */
  readonly env: Readonly<Record<string, string>>
  /** Keys whose values are stored in the credential store, not the JSON. */
  readonly secretEnvKeys: readonly string[]
  /**
   * Called whenever the env map or secret key list changes.
   *
   * @param env - Updated non-secret env vars.
   * @param secretEnvKeys - Updated list of keys to store securely.
   */
  readonly onChange: (env: Record<string, string>, secretEnvKeys: string[]) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const entriesToState = (
  env: Readonly<Record<string, string>>,
  secretEnvKeys: readonly string[],
): EnvEntry[] => {
  const regular = Object.entries(env).map(([key, value]) => ({ key, value, isSecret: false }))
  const secrets = secretEnvKeys.map((key) => ({ key, value: '', isSecret: true }))
  return [...regular, ...secrets]
}

const stateToOutput = (
  entries: EnvEntry[],
): { env: Record<string, string>; secretEnvKeys: string[] } => {
  const env: Record<string, string> = {}
  const secretEnvKeys: string[] = []

  for (const entry of entries) {
    if (!entry.key.trim()) continue
    if (entry.isSecret) {
      secretEnvKeys.push(entry.key)
    } else {
      env[entry.key] = entry.value
    }
  }

  return { env, secretEnvKeys }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Editor for the environment variable section of a server definition.
 * Non-secret vars are stored directly in the server JSON; secret vars are
 * stored in the Windows Credential Manager (their keys are tracked here but
 * values are handled at sync time).
 */
const EnvVarEditor = ({ env, secretEnvKeys, onChange }: EnvVarEditorProps) => {
  const [entries, setEntries] = useState<EnvEntry[]>(() => entriesToState(env, secretEnvKeys))
  const [revealedSecrets, setRevealedSecrets] = useState<Set<number>>(new Set())

  const emit = useCallback(
    (next: EnvEntry[]) => {
      setEntries(next)
      const { env: nextEnv, secretEnvKeys: nextKeys } = stateToOutput(next)
      onChange(nextEnv, nextKeys)
    },
    [onChange],
  )

  const addRow = () => emit([...entries, { key: '', value: '', isSecret: false }])

  const removeRow = (index: number) => emit(entries.filter((_, i) => i !== index))

  const updateRow = (index: number, patch: Partial<EnvEntry>) => {
    emit(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)))
  }

  const toggleSecret = (index: number) => {
    const entry = entries[index]
    if (!entry) return
    // When making secret, clear the plain value; when un-secreting, blank value out
    updateRow(index, { isSecret: !entry.isSecret, value: '' })
    // Remove from revealed set if it was showing
    setRevealedSecrets((prev) => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
  }

  const toggleReveal = (index: number) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <section aria-label="Environment variables" data-testid="env-var-editor">
      <div className="flex flex-col gap-2">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground py-1">No environment variables yet.</p>
        )}

        {entries.map((entry, index) => (
          <div key={index} className="flex items-center gap-2" data-testid={`env-row-${index}`}>
            {/* Key */}
            <Input
              type="text"
              value={entry.key}
              onChange={(e) => updateRow(index, { key: e.target.value })}
              placeholder="KEY"
              aria-label={`Environment variable key ${index + 1}`}
              className="flex-1 font-mono"
              data-testid={`env-key-${index}`}
            />

            {/* Value */}
            {entry.isSecret ? (
              <div className="flex flex-1 items-center gap-1">
                <Input
                  type={revealedSecrets.has(index) ? 'text' : 'password'}
                  value={entry.value}
                  onChange={(e) => updateRow(index, { value: e.target.value })}
                  placeholder="Stored in Credential Manager"
                  aria-label={`Secret value for ${entry.key || `variable ${index + 1}`}`}
                  className="flex-1 font-mono"
                  data-testid={`env-value-${index}`}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleReveal(index)}
                      aria-label={
                        revealedSecrets.has(index) ? 'Hide secret value' : 'Show secret value'
                      }
                    >
                      {revealedSecrets.has(index) ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {revealedSecrets.has(index) ? 'Hide value' : 'Reveal value'}
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <Input
                type="text"
                value={entry.value}
                onChange={(e) => updateRow(index, { value: e.target.value })}
                placeholder="value"
                aria-label={`Value for ${entry.key || `variable ${index + 1}`}`}
                className="flex-1 font-mono"
                data-testid={`env-value-${index}`}
              />
            )}

            {/* Secret toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => toggleSecret(index)}
                  className={cn(
                    'font-medium',
                    entry.isSecret
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50'
                      : 'text-muted-foreground',
                  )}
                  aria-label={entry.isSecret ? 'Unmark as secret' : 'Mark as secret'}
                  data-testid={`env-secret-toggle-${index}`}
                >
                  {entry.isSecret ? 'secret' : 'secret?'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {entry.isSecret
                  ? 'Unmark as secret — value stored in plain JSON'
                  : 'Mark as secret — value stored in Windows Credential Manager'}
              </TooltipContent>
            </Tooltip>

            {/* Delete */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(index)}
                  aria-label={`Remove environment variable ${index + 1}`}
                  data-testid={`env-remove-${index}`}
                >
                  <Trash2 size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove variable</TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addRow}
        className="mt-3 gap-1.5 text-muted-foreground"
        data-testid="env-add-button"
      >
        <Plus size={14} />
        Add variable
      </Button>
    </section>
  )
}

export { EnvVarEditor }
