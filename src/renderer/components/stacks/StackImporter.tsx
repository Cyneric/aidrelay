/**
 * @file src/renderer/components/stacks/StackImporter.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Stack import UI. Accepts a .json file via a file picker or a
 * pasted JSON string in a textarea, then calls the stacks:import IPC handler
 * and shows a summary of imported vs. skipped items. Import is free (no Pro
 * gate required).
 */

import { useState, useCallback, useRef, type ChangeEvent } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useServersStore } from '@/stores/servers.store'
import { useRulesStore } from '@/stores/rules.store'
import type { ImportResult } from '@shared/channels'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Import form that accepts a McpStack JSON bundle from a file or pasted text.
 */
const StackImporter = () => {
  const { load: loadServers } = useServersStore()
  const { load: loadRules } = useRulesStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pastedJson, setPastedJson] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const runImport = useCallback(
    async (json: string) => {
      setImporting(true)
      setResult(null)
      try {
        const importResult = await window.api.stacksImport(json)
        setResult(importResult)
        if (importResult.errors.length > 0) {
          toast.warning(
            `Import completed with ${importResult.errors.length} error(s). See summary below.`,
          )
        } else {
          toast.success(
            `Imported ${importResult.imported} item(s), skipped ${importResult.skipped} duplicate(s)`,
          )
        }
        await loadServers()
        await loadRules()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed'
        toast.error(message)
      } finally {
        setImporting(false)
      }
    },
    [loadServers, loadRules],
  )

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const text = await file.text()
      await runImport(text)
      // Reset so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [runImport],
  )

  const handlePasteImport = useCallback(async () => {
    if (!pastedJson.trim()) {
      toast.error('Paste JSON content before importing')
      return
    }
    await runImport(pastedJson)
  }, [pastedJson, runImport])

  return (
    <div className="flex flex-col gap-5" data-testid="stack-importer">
      <h2 className="text-base font-semibold">Import Stack</h2>

      {/* File picker */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">From file</span>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            id="stack-file"
            type="file"
            accept=".json"
            onChange={(e) => void handleFileChange(e)}
            disabled={importing}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:cursor-pointer hover:file:bg-accent disabled:opacity-50"
            aria-label="Choose stack JSON file"
            data-testid="stack-file-input"
          />
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <hr className="flex-1 border-border" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
        <hr className="flex-1 border-border" />
      </div>

      {/* Paste JSON */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stack-paste">Paste JSON</Label>
        <Textarea
          id="stack-paste"
          value={pastedJson}
          onChange={(e) => setPastedJson(e.target.value)}
          placeholder='{ "name": "My Stack", "servers": [...], "rules": [...] }'
          rows={6}
          className="font-mono text-xs resize-y"
          disabled={importing}
          data-testid="stack-paste-input"
        />
        <Button
          type="button"
          onClick={() => void handlePasteImport()}
          disabled={importing || pastedJson.trim().length === 0}
          className="self-start gap-1.5"
          data-testid="stack-import-button"
        >
          <Upload size={14} aria-hidden="true" />
          {importing ? 'Importing…' : 'Import'}
        </Button>
      </div>

      {/* Result summary */}
      {result !== null && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm flex flex-col gap-1"
          data-testid="stack-import-result"
        >
          <p className="font-medium">Import complete</p>
          <p className="text-muted-foreground">
            {result.imported} imported · {result.skipped} duplicate{result.skipped !== 1 ? 's' : ''}{' '}
            skipped
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-1 list-disc list-inside text-destructive space-y-0.5">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export { StackImporter }
