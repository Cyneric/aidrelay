/**
 * @file src/renderer/components/servers/ServerEditor.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Slide-in drawer that contains both the structured form editor
 * and the Monaco JSON editor for an MCP server. Tabs switch between the two
 * views; changes in either are reflected in both. On submit, calls
 * `serversCreate` or `serversUpdate` from the servers Zustand store.
 */

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ServerForm } from './ServerForm'
import { ServerJsonEditor } from './ServerJsonEditor'
import { useServersStore } from '@/stores/servers.store'
import type { McpServer } from '@shared/types'
import type { CreateServerInput } from '@shared/channels'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'form' | 'json'

interface ServerEditorProps {
  /** The server to edit, or `undefined` when creating a new one. */
  readonly server?: McpServer
  /** Called when the drawer should close (after save or cancel). */
  readonly onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-featured server editor sheet. Renders a semi-transparent backdrop and
 * a drawer panel from the right side. The Form tab is shown by default; the
 * JSON tab provides raw Monaco editing for power users.
 */
const ServerEditor = ({ server, onClose }: ServerEditorProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('form')
  const [saving, setSaving] = useState(false)
  const [formState, setFormState] = useState<McpServer | undefined>(server)

  const { create, update } = useServersStore()

  const handleFormSubmit = useCallback(
    async (data: CreateServerInput & { secretEnvKeys: string[] }) => {
      setSaving(true)
      try {
        if (server) {
          const result = await update(server.id, data)
          if (result) {
            toast.success(`"${result.name}" updated`)
            onClose()
          }
        } else {
          const result = await create(data)
          if (result) {
            toast.success(`"${result.name}" added`)
            onClose()
          }
        }
      } finally {
        setSaving(false)
      }
    },
    [server, create, update, onClose],
  )

  const handleJsonChange = useCallback((parsed: Partial<McpServer>) => {
    setFormState((prev) =>
      prev
        ? { ...prev, ...parsed }
        : ({
            id: '',
            enabled: true,
            clientOverrides: {},
            createdAt: '',
            updatedAt: '',
            ...parsed,
          } as McpServer),
    )
  }, [])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
        data-testid="server-editor-backdrop"
      />

      {/* Drawer panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl flex flex-col bg-background border-l border-border shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={server ? `Edit server: ${server.name}` : 'Add server'}
        data-testid="server-editor"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-base">
            {server ? `Edit: ${server.name}` : 'Add server'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
            aria-label="Close editor"
            data-testid="server-editor-close"
          >
            <X size={18} />
          </button>
        </header>

        {/* Tab bar */}
        <nav className="flex border-b border-border px-6" aria-label="Editor mode">
          {(['form', 'json'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              data-testid={`server-editor-tab-${tab}`}
            >
              {tab === 'form' ? 'Form' : 'JSON'}
            </button>
          ))}
        </nav>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'form' ? (
            <ServerForm
              {...(formState !== undefined && { defaultValues: formState })}
              onSubmit={(data) => {
                void handleFormSubmit(data)
              }}
              onCancel={onClose}
              saving={saving}
            />
          ) : (
            <ServerJsonEditor
              server={
                formState ?? {
                  name: '',
                  type: 'stdio',
                  command: '',
                  args: [],
                  env: {},
                  secretEnvKeys: [],
                  notes: '',
                  tags: [],
                }
              }
              onChange={handleJsonChange}
            />
          )}
        </div>

        {/* JSON tab footer actions */}
        {activeTab === 'json' && (
          <footer className="flex justify-end gap-2 px-6 py-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm border border-input hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (formState) {
                  void handleFormSubmit({
                    name: formState.name,
                    type: formState.type,
                    command: formState.command,
                    args: [...formState.args],
                    env: { ...formState.env },
                    secretEnvKeys: [...formState.secretEnvKeys],
                    notes: formState.notes,
                    tags: [...formState.tags],
                  })
                }
              }}
              disabled={saving || !formState?.name || !formState?.command}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="server-editor-json-save"
            >
              {saving ? 'Saving…' : server ? 'Save changes' : 'Add server'}
            </button>
          </footer>
        )}
      </aside>
    </>
  )
}

export { ServerEditor }
