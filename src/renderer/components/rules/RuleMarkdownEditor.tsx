/**
 * @file src/renderer/components/rules/RuleMarkdownEditor.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Markdown split-view editor for rule content. Wraps
 * `@uiw/react-md-editor` and handles CSS import, dark/light mode detection,
 * and forwarding content changes to the parent. A token count badge is
 * integrated into the editor toolbar and updated via the `useTokenEstimate`
 * hook added in Step 24.
 */

import { useEffect, useState } from 'react'
import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'
import { useTokenEstimate } from '@/hooks/useTokenEstimate'

// ─── Props ────────────────────────────────────────────────────────────────────

interface RuleMarkdownEditorProps {
  /** Current Markdown content. */
  readonly value: string
  /** Called whenever the content changes. */
  readonly onChange: (content: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the CSS class for the token count badge based on the count value. */
const tokenBadgeClass = (count: number): string => {
  if (count > 2000) return 'bg-destructive/15 text-destructive'
  if (count > 500) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-muted text-muted-foreground'
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Split-view Markdown editor for rule content. Detects the system color
 * scheme on mount and sets `data-color-mode` on the wrapper accordingly.
 * The token count badge in the toolbar is updated live via the debounced
 * `useTokenEstimate` hook.
 */
const RuleMarkdownEditor = ({ value, onChange }: RuleMarkdownEditorProps) => {
  const tokenEstimate = useTokenEstimate(value)
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setColorMode(mq.matches ? 'dark' : 'light')

    const handleChange = (e: MediaQueryListEvent) => {
      setColorMode(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  return (
    <div className="flex flex-col gap-2" data-testid="rule-markdown-editor">
      {/* Token count badge above the editor */}
      {tokenEstimate > 0 && (
        <div className="flex items-center justify-end">
          <span
            className={`rounded px-2 py-0.5 text-xs font-mono ${tokenBadgeClass(tokenEstimate)}`}
            aria-label={`Estimated token count: ${tokenEstimate}`}
            data-testid="token-estimate-badge"
          >
            ~{tokenEstimate.toLocaleString()} tokens
          </span>
        </div>
      )}

      {/* MDEditor with split preview */}
      <div data-color-mode={colorMode} className="rounded-md overflow-hidden border border-input">
        <MDEditor
          value={value}
          onChange={(val) => onChange(val ?? '')}
          preview="live"
          height={400}
          data-testid="md-editor-input"
        />
      </div>
    </div>
  )
}

export { RuleMarkdownEditor }
