/**
 * @file src/renderer/components/history/BackupTimeline.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description A chronological list of backup snapshots for a single client.
 * Displays the backup type (pristine / sync / manual), age, and file size for
 * each entry. Allows the user to restore any backup with one click. A safety
 * backup of the current live config is always created before restoring.
 */

import { useState, useEffect, useCallback, type ElementType } from 'react'
import { toast } from 'sonner'
import { RotateCcw, Shield, RefreshCw, Clock } from 'lucide-react'
import type { BackupEntry } from '@shared/channels'
import type { ClientId } from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a byte count into a human-readable string (KB/MB).
 *
 * @param bytes - The byte count to format.
 * @returns Formatted string with unit.
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Returns a relative time string (e.g. "3 hours ago") for an ISO timestamp.
 *
 * @param iso - ISO 8601 timestamp string.
 * @returns Relative time description.
 */
const relativeTime = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Icon and label for each backup type.
 */
const BACKUP_TYPE_META: Record<
  BackupEntry['backupType'],
  { label: string; icon: ElementType; className: string }
> = {
  pristine: {
    label: 'Pristine',
    icon: Shield,
    className: 'text-blue-600 dark:text-blue-400',
  },
  sync: {
    label: 'Sync',
    icon: RefreshCw,
    className: 'text-muted-foreground',
  },
  manual: {
    label: 'Manual',
    icon: Clock,
    className: 'text-amber-600 dark:text-amber-400',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Props for `BackupTimeline`.
 */
interface Props {
  /** The client whose backup history to display. */
  readonly clientId: ClientId
}

/**
 * Lists all backup snapshots for a client with restore buttons. Fetches the
 * list on mount and after each restore so the timeline stays accurate.
 *
 * @param props - The client ID to display backups for.
 */
const BackupTimeline = ({ clientId }: Readonly<Props>) => {
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const entries = await window.api.backupsList(clientId)
      setBackups(entries)
    } catch {
      toast.error(`Failed to load backups for ${clientId}.`)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  const handleRestore = async (backup: BackupEntry) => {
    const confirmed = window.confirm(
      `Restore "${clientId}" config from ${new Date(backup.createdAt).toLocaleString()}?\n\n` +
        `A safety backup of the current config will be created first.`,
    )
    if (!confirmed) return

    setRestoringId(backup.id)
    try {
      await window.api.backupsRestore(backup.backupPath, clientId)
      toast.success(`Restored ${clientId} config from ${relativeTime(backup.createdAt)}.`)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Restore failed.'
      toast.error(message)
    } finally {
      setRestoringId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading backups…
      </div>
    )
  }

  if (backups.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground" data-testid="no-backups">
        No backups yet for this client. A backup is created automatically before each sync.
      </p>
    )
  }

  return (
    <ol className="space-y-2" data-testid={`backup-timeline-${clientId}`}>
      {backups.map((backup) => {
        const meta = BACKUP_TYPE_META[backup.backupType]
        const TypeIcon = meta.icon
        const isRestoring = restoringId === backup.id

        return (
          <li
            key={backup.id}
            className="flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm"
            data-testid={`backup-entry-${backup.id}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <TypeIcon size={15} className={meta.className} aria-hidden="true" />
              <div className="min-w-0">
                <span className="font-medium">{meta.label}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <time
                  dateTime={backup.createdAt}
                  title={new Date(backup.createdAt).toLocaleString()}
                  className="text-muted-foreground"
                >
                  {relativeTime(backup.createdAt)}
                </time>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-muted-foreground font-mono">
                {formatFileSize(backup.fileSize)}
              </span>
              <button
                type="button"
                onClick={() => void handleRestore(backup)}
                disabled={isRestoring}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium border hover:bg-accent disabled:opacity-50"
                aria-label={`Restore backup from ${new Date(backup.createdAt).toLocaleString()}`}
                data-testid={`btn-restore-${backup.id}`}
              >
                <RotateCcw size={11} aria-hidden="true" />
                {isRestoring ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export { BackupTimeline }
