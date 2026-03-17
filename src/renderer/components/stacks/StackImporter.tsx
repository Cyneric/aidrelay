/**
 * @file src/renderer/components/stacks/StackImporter.tsx
 *
 * @created 07.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Stack import UI. Accepts a .json file via a file picker or a
 * pasted JSON string in a textarea, then calls the stacks:import IPC handler
 * and shows a summary of imported vs. skipped items. Import is free (no Pro
 * gate required).
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { dialogService } from '@/services/dialog.service'
import { filesService } from '@/services/files.service'
import { useServersStore } from '@/stores/servers.store'
import { useRulesStore } from '@/stores/rules.store'
import type { ImportResult } from '@shared/channels'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Import form that accepts a McpStack JSON bundle from a file or pasted text.
 */
const StackImporter = () => {
  const { t } = useTranslation()
  const { load: loadServers } = useServersStore()
  const { load: loadRules } = useRulesStore()

  const [pastedJson, setPastedJson] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  const runImport = useCallback(
    async (json: string) => {
      setImporting(true)
      setResult(null)
      try {
        const importResult = await window.api.stacksImport(json)
        setResult(importResult)
        if (importResult.errors.length > 0) {
          toast.warning(t('stacks.importWithErrors', { count: importResult.errors.length }))
        } else {
          toast.success(
            t('stacks.importSuccess', {
              imported: importResult.imported,
              skipped: importResult.skipped,
            }),
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
    [loadServers, loadRules, t],
  )

  const handleFilePick = useCallback(async () => {
    const { canceled, filePaths } = await dialogService.showOpen({
      properties: ['openFile'],
      title: t('stacks.fromFile'),
    })
    if (canceled || filePaths.length === 0) return
    const filePath = filePaths[0]!
    const fileName = filePath.split(/[\\/]/).pop() ?? filePath
    setSelectedFileName(fileName)
    const { content } = await filesService.readText(filePath)
    await runImport(content)
  }, [runImport, t])

  const handlePasteImport = useCallback(async () => {
    if (!pastedJson.trim()) {
      toast.error(t('stacks.importPasteEmpty'))
      return
    }
    await runImport(pastedJson)
  }, [pastedJson, runImport, t])

  return (
    <div className="flex flex-col gap-5" data-testid="stack-importer">
      <h2 className="text-base font-semibold">{t('stacks.importTitle')}</h2>

      {/* File picker */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t('stacks.fromFile')}</span>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleFilePick()}
            disabled={importing}
            className="gap-1.5"
            data-testid="stack-file-input"
          >
            <FolderOpen size={14} aria-hidden="true" />
            {t('stacks.chooseFile')}
          </Button>
          {selectedFileName && (
            <span className="text-sm text-muted-foreground" data-testid="stack-file-name">
              {t('stacks.fileSelected', { name: selectedFileName })}
            </span>
          )}
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <hr className="flex-1 border-border" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          {t('stacks.or')}
        </span>
        <hr className="flex-1 border-border" />
      </div>

      {/* Paste JSON */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stack-paste">{t('stacks.pasteJson')}</Label>
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
          {importing ? t('stacks.importingButton') : t('stacks.importButton')}
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
          <p className="font-medium">{t('stacks.importComplete')}</p>
          <p className="text-muted-foreground">
            {t('stacks.importSummary', {
              count: result.skipped,
              imported: result.imported,
              skipped: result.skipped,
            })}
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
