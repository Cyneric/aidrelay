/**
 * @file src/renderer/components/rules/RuleEditor.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Slide-in drawer for creating and editing AI rules. Has two
 * tabs: "Details" for the metadata form and "Content" for the Markdown
 * split-view editor. Both tabs share state — changes in one are immediately
 * visible in the other. On submit, calls `rulesCreate` or `rulesUpdate` from
 * the rules Zustand store.
 */

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RuleForm } from './RuleForm'
import { RuleMarkdownEditor } from './RuleMarkdownEditor'
import { useRulesStore } from '@/stores/rules.store'
import { useTokenEstimate } from '@/hooks/useTokenEstimate'
import type { AiRule } from '@shared/types'
import type { CreateRuleInput } from '@shared/channels'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'details' | 'content'

interface RuleEditorProps {
  /** The rule to edit, or `undefined` when creating a new one. */
  readonly rule?: AiRule
  /** Called when the drawer should close (after save or cancel). */
  readonly onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-featured rule editor sheet. Renders a semi-transparent backdrop and a
 * wider drawer panel from the right side. The Details tab holds the metadata
 * form; the Content tab holds the live Markdown split-view editor.
 */
const RuleEditor = ({ rule, onClose }: RuleEditorProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('details')
  const [saving, setSaving] = useState(false)
  const [content, setContent] = useState(rule?.content ?? '')

  const { create, update } = useRulesStore()
  const tokenEstimate = useTokenEstimate(content)

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
  }, [])

  const handleDetailsSubmit = useCallback(
    async (data: Omit<CreateRuleInput, 'content'>) => {
      if (!content.trim()) {
        toast.error('Rule content cannot be empty')
        return
      }

      setSaving(true)
      try {
        const input: CreateRuleInput = { ...data, content }

        if (rule) {
          const result = await update(rule.id, input)
          if (result) {
            toast.success(`"${result.name}" updated`)
            onClose()
          }
        } else {
          const result = await create(input)
          if (result) {
            toast.success(`"${result.name}" added`)
            onClose()
          }
        }
      } finally {
        setSaving(false)
      }
    },
    [content, rule, create, update, onClose],
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
        data-testid="rule-editor-backdrop"
      />

      {/* Drawer panel — wider than ServerEditor to accommodate the Markdown editor */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl flex flex-col bg-background border-l border-border shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={rule ? `Edit rule: ${rule.name}` : 'Add rule'}
        data-testid="rule-editor"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-base">{rule ? `Edit: ${rule.name}` : 'Add rule'}</h2>
            {tokenEstimate > 0 && (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs font-mono',
                  tokenEstimate > 2000
                    ? 'bg-destructive/15 text-destructive'
                    : tokenEstimate > 500
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-muted text-muted-foreground',
                )}
                data-testid="editor-token-estimate"
              >
                ~{tokenEstimate.toLocaleString()} tokens
              </span>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close editor"
                data-testid="rule-editor-close"
              >
                <X size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </header>

        {/* Tab bar */}
        <nav className="flex border-b border-border px-6" aria-label="Editor section">
          {(['details', 'content'] as const).map((tab) => (
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
              data-testid={`rule-editor-tab-${tab}`}
            >
              {tab === 'details' ? 'Details' : 'Content'}
            </button>
          ))}
        </nav>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'details' ? (
            <RuleForm
              {...(rule !== undefined && { defaultValues: rule })}
              onSubmit={(data) => {
                void handleDetailsSubmit(data)
              }}
              onCancel={onClose}
              saving={saving}
            />
          ) : (
            <RuleMarkdownEditor value={content} onChange={handleContentChange} />
          )}
        </div>

        {/* Content tab footer actions */}
        {activeTab === 'content' && (
          <footer className="flex justify-end gap-2 px-6 py-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="rule-editor-content-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab('details')}
              data-testid="rule-editor-content-next"
            >
              {rule ? 'Save changes' : 'Continue to details →'}
            </Button>
          </footer>
        )}
      </aside>
    </>
  )
}

export { RuleEditor }
