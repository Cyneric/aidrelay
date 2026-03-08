/**
 * @file src/renderer/components/rules/ImportRulesDialog.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Modal dialog for importing AI rules from an existing project
 * directory. On open, auto-detects recent VS Code / Cursor workspaces and
 * populates a dropdown. Users can also type or browse to a custom path.
 * A preview scan is shown before committing the import.
 */

import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useRulesStore } from '@/stores/rules.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ImportRulesDialogProps {
  /** Called when the dialog should close. */
  readonly onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal dialog that scans a project directory for rule files and imports them.
 * Detects recent workspaces from VS Code / Cursor automatically.
 */
const ImportRulesDialog = ({ onClose }: ImportRulesDialogProps) => {
  const { load } = useRulesStore()

  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [selectedPath, setSelectedPath] = useState('')
  const [customPath, setCustomPath] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<{
    imported: number
    skipped: number
    errors: readonly string[]
  } | null>(null)

  // Detect recent workspaces on mount
  useEffect(() => {
    const detect = async () => {
      setDetecting(true)
      try {
        const paths = await window.api.rulesDetectWorkspaces()
        setWorkspaces(paths)
        if (paths.length > 0) setSelectedPath(paths[0]!)
      } catch {
        // Non-fatal — user can type a path manually
      } finally {
        setDetecting(false)
      }
    }
    void detect()
  }, [])

  const activePath = customPath.trim() || selectedPath

  const handleScan = useCallback(async () => {
    if (!activePath) {
      toast.error('Enter or select a project path first')
      return
    }
    setScanning(true)
    setPreview(null)
    try {
      const result = await window.api.rulesImportFromProject(activePath)
      setPreview(result)
    } catch {
      toast.error('Failed to scan directory')
    } finally {
      setScanning(false)
    }
  }, [activePath])

  const handleImport = useCallback(async () => {
    if (!preview) return
    setImporting(true)
    try {
      toast.success(
        `Imported ${preview.imported} rule${preview.imported !== 1 ? 's' : ''}` +
          (preview.skipped > 0
            ? `, skipped ${preview.skipped} duplicate${preview.skipped !== 1 ? 's' : ''}`
            : ''),
      )
      await load()
      onClose()
    } finally {
      setImporting(false)
    }
  }, [preview, load, onClose])

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-lg" data-testid="import-rules-dialog">
        <DialogHeader>
          <DialogTitle>Import rules from project</DialogTitle>
        </DialogHeader>

        {/* Body */}
        <div className="flex flex-col gap-4 py-2">
          {/* Workspace dropdown */}
          {detecting ? (
            <p className="text-sm text-muted-foreground">Detecting recent workspaces…</p>
          ) : workspaces.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workspace-select">Recent workspace</Label>
              <Select
                value={selectedPath}
                onValueChange={(v) => {
                  setSelectedPath(v)
                  setCustomPath('')
                  setPreview(null)
                }}
              >
                <SelectTrigger id="workspace-select" data-testid="workspace-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.filter(Boolean).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Custom path */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-path">
              {workspaces.length > 0 ? 'Or enter a custom path' : 'Project directory path'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="custom-path"
                type="text"
                value={customPath}
                onChange={(e) => {
                  setCustomPath(e.target.value)
                  setPreview(null)
                }}
                placeholder="C:\Users\me\my-project"
                className="flex-1 font-mono"
                data-testid="custom-path-input"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      void (async () => {
                        const result = await window.api.showOpenDialog({
                          properties: ['openDirectory'],
                          title: 'Select project directory',
                        })
                        if (!result.canceled && result.filePaths[0]) {
                          setCustomPath(result.filePaths[0])
                          setSelectedPath('')
                          setPreview(null)
                        }
                      })()
                    }}
                    aria-label="Browse for directory"
                    data-testid="browse-button"
                  >
                    <FolderOpen size={14} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Browse for directory</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Scan button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleScan()}
            disabled={scanning || !activePath}
            className="self-start gap-1.5"
            data-testid="scan-button"
          >
            <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} aria-hidden="true" />
            {scanning ? 'Scanning…' : 'Scan for rules'}
          </Button>

          {/* Preview result */}
          {preview && (
            <div
              className={cn(
                'rounded-md border px-4 py-3 text-sm',
                preview.imported > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-muted bg-muted/40 text-muted-foreground',
              )}
              data-testid="import-preview"
            >
              {preview.imported === 0 && preview.skipped === 0
                ? 'No rule files found in this directory.'
                : `Found ${preview.imported} new rule${preview.imported !== 1 ? 's' : ''}` +
                  (preview.skipped > 0 ? `, ${preview.skipped} already exist` : '') +
                  '.'}
              {preview.errors.length > 0 && (
                <ul className="mt-1 list-disc list-inside text-destructive">
                  {preview.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="import-dialog-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={importing || !preview || preview.imported === 0}
            data-testid="import-confirm-button"
          >
            {importing
              ? 'Importing…'
              : `Import${preview ? ` ${preview.imported} rule${preview.imported !== 1 ? 's' : ''}` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ImportRulesDialog }
