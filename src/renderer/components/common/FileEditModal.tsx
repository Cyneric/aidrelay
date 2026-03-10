/**
 * @file src/renderer/components/common/FileEditModal.tsx
 *
 * @description Modal editor for UTF-8 text files with optimistic concurrency.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmActionDialog } from '@/components/common/ConfirmActionDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { filesService } from '@/services/files.service'
import { useTheme } from '@/lib/useTheme'
import { ensureAidrelayMonacoThemes, getAidrelayMonacoTheme } from '@/lib/monacoTheme'

type FileErrorCode =
  | 'file_not_found'
  | 'file_not_regular'
  | 'file_too_large'
  | 'file_not_utf8'
  | 'file_conflict'
  | 'file_write_failed'
  | 'file_invalid_path'
  | 'file_reveal_failed'
  | 'unknown'

const parseFileError = (err: unknown): { code: FileErrorCode; message: string } => {
  const raw = err instanceof Error ? err.message : String(err)
  const match = /^\[([a-z_]+)\]\s*(.*)$/i.exec(raw)
  if (!match) return { code: 'unknown', message: raw }
  const code = match[1] as FileErrorCode
  return {
    code,
    message: match[2] || raw,
  }
}

const languageFromPath = (path: string): string => {
  const lower = path.toLowerCase()
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml'
  if (lower.endsWith('.toml')) return 'ini'
  if (lower.endsWith('.md')) return 'markdown'
  if (lower.endsWith('.xml')) return 'xml'
  if (lower.endsWith('.html')) return 'html'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.js') || lower.endsWith('.cjs') || lower.endsWith('.mjs')) return 'javascript'
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript'
  return 'plaintext'
}

interface FileEditModalProps {
  readonly path: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

const FileEditModal = ({ path, open, onOpenChange }: FileEditModalProps) => {
  const { t } = useTranslation()
  const { effectiveTheme } = useTheme()
  const [content, setContent] = useState('')
  const [initialContent, setInitialContent] = useState('')
  const [mtimeMs, setMtimeMs] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const bypassCloseGuardRef = useRef(false)

  const hasUnsavedChanges = content !== initialContent
  const language = useMemo(() => languageFromPath(path), [path])

  const loadFile = useCallback(async () => {
    if (!path) return
    setLoading(true)
    setErrorMessage(null)
    try {
      const file = await filesService.readText(path)
      setContent(file.content)
      setInitialContent(file.content)
      setMtimeMs(file.mtimeMs)
    } catch (err) {
      const parsed = parseFileError(err)
      const key =
        parsed.code === 'file_not_utf8' || parsed.code === 'file_too_large'
          ? 'files.errorUnsupported'
          : 'files.errorRead'
      setErrorMessage(t(key, { message: parsed.message }))
    } finally {
      setLoading(false)
    }
  }, [path, t])

  useEffect(() => {
    if (!open) return
    void loadFile()
  }, [loadFile, open])

  useEffect(() => {
    if (!open) {
      setDiscardDialogOpen(false)
      bypassCloseGuardRef.current = false
    }
  }, [open])

  const handleSave = async () => {
    if (mtimeMs === null) return
    setSaving(true)
    setErrorMessage(null)
    try {
      const result = await filesService.writeText(path, content, mtimeMs)
      setMtimeMs(result.mtimeMs)
      setInitialContent(content)
      toast.success(t('files.saved'))
    } catch (err) {
      const parsed = parseFileError(err)
      if (parsed.code === 'file_conflict') {
        setErrorMessage(t('files.errorConflict'))
      } else {
        setErrorMessage(t('files.errorSave', { message: parsed.message }))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && hasUnsavedChanges && !bypassCloseGuardRef.current) {
      setDiscardDialogOpen(true)
      return
    }
    bypassCloseGuardRef.current = false
    onOpenChange(nextOpen)
  }

  const handleDiscardCancel = () => {
    setDiscardDialogOpen(false)
  }

  const handleDiscardConfirm = () => {
    bypassCloseGuardRef.current = true
    setDiscardDialogOpen(false)
    handleOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-5xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('files.editTitle')}</DialogTitle>
            <DialogDescription className="font-mono break-all">{path}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 rounded-md border border-input overflow-hidden">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 size={16} className="animate-spin" />
                {t('files.loading')}
              </div>
            ) : errorMessage ? (
              <div className="h-full flex items-center justify-center px-6 text-sm text-destructive gap-2 text-center">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : (
              <Editor
                value={content}
                language={language}
                beforeMount={ensureAidrelayMonacoThemes}
                onChange={(val) => setContent(val ?? '')}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  tabSize: 2,
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
                theme={getAidrelayMonacoTheme(effectiveTheme)}
              />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadFile()}
              disabled={loading}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('files.reload')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading || saving || mtimeMs === null || !hasUnsavedChanges}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Save size={14} aria-hidden="true" />
              )}
              {t('files.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={discardDialogOpen}
        title={t('files.discardChangesTitle')}
        description={t('files.discardChangesDescription')}
        confirmLabel={t('files.discardChangesAction')}
        variant="destructive"
        onConfirm={handleDiscardConfirm}
        onCancel={handleDiscardCancel}
      />
    </>
  )
}

export { FileEditModal }
