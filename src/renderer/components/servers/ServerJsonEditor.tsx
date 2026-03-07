/**
 * @file src/renderer/components/servers/ServerJsonEditor.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Monaco-based JSON editor for MCP server definitions. Accepts the
 * current server config as a JSON string and fires `onChange` whenever the user
 * edits the document. A parse-error banner is shown when the JSON is invalid so
 * the user always knows whether their changes can be saved.
 */

import { useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { AlertCircle } from 'lucide-react'
import type { McpServer } from '@shared/types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The subset of server fields that the JSON editor can update.
 * We only expose the "raw MCP config" properties — not metadata like `id`,
 * `enabled`, or `clientOverrides`.
 */
type EditableServerFields = Pick<
  McpServer,
  'name' | 'type' | 'command' | 'args' | 'env' | 'secretEnvKeys' | 'notes' | 'tags'
>

interface ServerJsonEditorProps {
  /** Current server state, displayed as formatted JSON. */
  readonly server: EditableServerFields
  /**
   * Called when the user edits the JSON and the result is valid.
   * The parsed fields replace the current form state.
   *
   * @param parsed - Parsed fields from the updated JSON.
   */
  readonly onChange: (parsed: Partial<EditableServerFields>) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Monaco-based JSON editor tab inside the server editor sheet.
 * Bidirectionally synced with the form: changes here update the form fields
 * on valid parse, and changes in the form re-render this component's value.
 */
const ServerJsonEditor = ({ server, onChange }: ServerJsonEditorProps) => {
  const [parseError, setParseError] = useState<string | null>(null)

  const initialJson = JSON.stringify(
    {
      name: server.name,
      type: server.type,
      command: server.command,
      args: server.args,
      env: server.env,
      secretEnvKeys: server.secretEnvKeys,
      notes: server.notes,
      tags: server.tags,
    },
    null,
    2,
  )

  const handleChange = useCallback(
    (value: string | undefined) => {
      const raw = value ?? ''
      try {
        const parsed = JSON.parse(raw) as Partial<EditableServerFields>
        setParseError(null)
        onChange(parsed)
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Invalid JSON')
      }
    },
    [onChange],
  )

  return (
    <div className="flex flex-col gap-2 h-full" data-testid="server-json-editor">
      {parseError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle size={14} aria-hidden="true" />
          <span>JSON error: {parseError}</span>
        </div>
      )}

      <div className="flex-1 rounded-md border border-input overflow-hidden min-h-[300px]">
        <Editor
          defaultValue={initialJson}
          language="json"
          onChange={handleChange}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            tabSize: 2,
            wordWrap: 'on',
            automaticLayout: true,
          }}
          theme="vs-dark"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Edit the JSON directly. Changes are applied to the form when the JSON is valid.
      </p>
    </div>
  )
}

export { ServerJsonEditor }
