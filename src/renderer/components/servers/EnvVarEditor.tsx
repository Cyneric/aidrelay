/**
 * @file src/renderer/components/servers/EnvVarEditor.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
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
            <input
              type="text"
              value={entry.key}
              onChange={(e) => updateRow(index, { key: e.target.value })}
              placeholder="KEY"
              aria-label={`Environment variable key ${index + 1}`}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid={`env-key-${index}`}
            />

            {/* Value */}
            {entry.isSecret ? (
              <div className="flex flex-1 items-center gap-1">
                <input
                  type={revealedSecrets.has(index) ? 'text' : 'password'}
                  value={entry.value}
                  onChange={(e) => updateRow(index, { value: e.target.value })}
                  placeholder="Stored in Credential Manager"
                  aria-label={`Secret value for ${entry.key || `variable ${index + 1}`}`}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid={`env-value-${index}`}
                />
                <button
                  type="button"
                  onClick={() => toggleReveal(index)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                  aria-label={
                    revealedSecrets.has(index) ? 'Hide secret value' : 'Show secret value'
                  }
                >
                  {revealedSecrets.has(index) ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={entry.value}
                onChange={(e) => updateRow(index, { value: e.target.value })}
                placeholder="value"
                aria-label={`Value for ${entry.key || `variable ${index + 1}`}`}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid={`env-value-${index}`}
              />
            )}

            {/* Secret toggle */}
            <button
              type="button"
              onClick={() => toggleSecret(index)}
              title={
                entry.isSecret
                  ? 'Unmark as secret'
                  : 'Mark as secret (stores in Credential Manager)'
              }
              className={cn(
                'p-1.5 rounded text-xs font-medium transition-colors',
                entry.isSecret
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={entry.isSecret ? 'Unmark as secret' : 'Mark as secret'}
              data-testid={`env-secret-toggle-${index}`}
            >
              {entry.isSecret ? '🔒 secret' : 'secret?'}
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
              aria-label={`Remove environment variable ${index + 1}`}
              data-testid={`env-remove-${index}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        data-testid="env-add-button"
      >
        <Plus size={14} />
        Add variable
      </button>
    </section>
  )
}

export { EnvVarEditor }
