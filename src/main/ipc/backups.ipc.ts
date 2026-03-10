/**
 * @file src/main/ipc/backups.ipc.ts
 *
 * @created 07.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for the `backups:*` channel namespace. Exposes
 * backup history querying, restore preview, and restore actions.
 */

import { ipcMain } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import log from 'electron-log'
import type {
  BackupEntry,
  BackupQueryFilters,
  BackupQueryResult,
  RestorePreviewBlock,
  RestorePreviewResult,
} from '@shared/channels'
import type { ClientId } from '@shared/types'
import { getDatabase } from '@main/db/connection'
import { BackupsRepo } from '@main/db/backups.repo'
import { BackupService } from '@main/sync/backup.service'
import { ADAPTERS } from '@main/clients/registry'

const PREVIEW_MAX_BLOCKS = 20
const PREVIEW_MAX_VALUE_LENGTH = 220

const toPreviewString = (value: unknown): string => {
  const serialized =
    typeof value === 'string' ? value : (JSON.stringify(value ?? null, null, 2) ?? String(value))
  if (serialized.length <= PREVIEW_MAX_VALUE_LENGTH) return serialized
  return `${serialized.slice(0, PREVIEW_MAX_VALUE_LENGTH)}…`
}

const flattenJson = (value: unknown, path: string, out: Map<string, string>) => {
  if (value === null || typeof value !== 'object') {
    out.set(path || '$', toPreviewString(value))
    return
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.set(path || '$', '[]')
      return
    }
    value.forEach((item, index) => {
      flattenJson(item, `${path}[${index}]`, out)
    })
    return
  }

  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) {
    out.set(path || '$', '{}')
    return
  }
  entries.forEach(([key, entry]) => {
    const nextPath = path ? `${path}.${key}` : key
    flattenJson(entry, nextPath, out)
  })
}

const previewFromJson = (
  clientId: ClientId,
  backupPath: string,
  liveConfigPath: string,
  hasLiveConfig: boolean,
  currentRaw: string,
  backupRaw: string,
): RestorePreviewResult => {
  const currentParsed = JSON.parse(currentRaw || '{}') as unknown
  const backupParsed = JSON.parse(backupRaw || '{}') as unknown
  const current = new Map<string, string>()
  const backup = new Map<string, string>()
  flattenJson(currentParsed, '', current)
  flattenJson(backupParsed, '', backup)

  const blocks: RestorePreviewBlock[] = []
  let added = 0
  let removed = 0
  let changed = 0

  const keys = new Set([...current.keys(), ...backup.keys()])
  const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b))
  for (const key of sortedKeys) {
    const before = current.get(key) ?? null
    const after = backup.get(key) ?? null
    if (before === after) continue

    if (before === null) {
      added += 1
      if (blocks.length < PREVIEW_MAX_BLOCKS) {
        blocks.push({ path: key, kind: 'added', before: null, after })
      }
      continue
    }

    if (after === null) {
      removed += 1
      if (blocks.length < PREVIEW_MAX_BLOCKS) {
        blocks.push({ path: key, kind: 'removed', before, after: null })
      }
      continue
    }

    changed += 1
    if (blocks.length < PREVIEW_MAX_BLOCKS) {
      blocks.push({ path: key, kind: 'changed', before, after })
    }
  }

  const totalChanges = added + removed + changed
  return {
    clientId,
    backupPath,
    liveConfigPath,
    hasLiveConfig,
    mode: 'json',
    added,
    removed,
    changed,
    totalChanges,
    blocks,
    truncated: totalChanges > PREVIEW_MAX_BLOCKS,
  }
}

const previewFromText = (
  clientId: ClientId,
  backupPath: string,
  liveConfigPath: string,
  hasLiveConfig: boolean,
  currentRaw: string,
  backupRaw: string,
): RestorePreviewResult => {
  const beforeLines = currentRaw.split(/\r?\n/)
  const afterLines = backupRaw.split(/\r?\n/)
  const maxLen = Math.max(beforeLines.length, afterLines.length)
  const blocks: RestorePreviewBlock[] = []

  let added = 0
  let removed = 0
  let changed = 0

  for (let index = 0; index < maxLen; index += 1) {
    const before = beforeLines[index]
    const after = afterLines[index]

    if (before === after) continue
    const path = `line ${index + 1}`
    if (before === undefined) {
      added += 1
      if (blocks.length < PREVIEW_MAX_BLOCKS) {
        blocks.push({ path, kind: 'added', before: null, after: toPreviewString(after) })
      }
      continue
    }

    if (after === undefined) {
      removed += 1
      if (blocks.length < PREVIEW_MAX_BLOCKS) {
        blocks.push({ path, kind: 'removed', before: toPreviewString(before), after: null })
      }
      continue
    }

    changed += 1
    if (blocks.length < PREVIEW_MAX_BLOCKS) {
      blocks.push({
        path,
        kind: 'changed',
        before: toPreviewString(before),
        after: toPreviewString(after),
      })
    }
  }

  const totalChanges = added + removed + changed
  return {
    clientId,
    backupPath,
    liveConfigPath,
    hasLiveConfig,
    mode: 'text',
    added,
    removed,
    changed,
    totalChanges,
    blocks,
    truncated: totalChanges > PREVIEW_MAX_BLOCKS,
  }
}

const resolveLiveConfigPath = async (clientId: ClientId): Promise<string> => {
  const adapter = ADAPTERS.get(clientId)
  if (!adapter) {
    throw new Error(`Unknown client: ${clientId}`)
  }

  const detection = await adapter.detect()
  if (!detection.installed || detection.configPaths.length === 0) {
    throw new Error(`Client ${clientId} is not installed or has no config path`)
  }

  return detection.configPaths[0]!
}

// ─── Handler Registration ─────────────────────────────────────────────────────

export const registerBackupsIpc = (): void => {
  ipcMain.handle('backups:list', (_event, clientId: ClientId): BackupEntry[] => {
    log.debug(`[ipc] backups:list ${clientId}`)
    const repo = new BackupsRepo(getDatabase())
    return repo.findByClient(clientId)
  })

  ipcMain.handle('backups:query', (_event, filters: BackupQueryFilters): BackupQueryResult => {
    log.debug('[ipc] backups:query', filters)
    const repo = new BackupsRepo(getDatabase())
    return repo.query(filters)
  })

  ipcMain.handle(
    'backups:preview-restore',
    async (_event, backupPath: string, clientId: ClientId): Promise<RestorePreviewResult> => {
      log.debug(`[ipc] backups:preview-restore ${clientId} ← ${backupPath}`)

      if (!existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`)
      }

      const liveConfigPath = await resolveLiveConfigPath(clientId)
      const hasLiveConfig = existsSync(liveConfigPath)
      const currentRaw = hasLiveConfig ? readFileSync(liveConfigPath, 'utf-8') : ''
      const backupRaw = readFileSync(backupPath, 'utf-8')

      try {
        return previewFromJson(
          clientId,
          backupPath,
          liveConfigPath,
          hasLiveConfig,
          currentRaw,
          backupRaw,
        )
      } catch {
        return previewFromText(
          clientId,
          backupPath,
          liveConfigPath,
          hasLiveConfig,
          currentRaw,
          backupRaw,
        )
      }
    },
  )

  ipcMain.handle('backups:restore', async (_event, backupPath: string, clientId: ClientId) => {
    log.info(`[ipc] backups:restore ${clientId} ← ${backupPath}`)

    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`)
    }

    const liveConfigPath = await resolveLiveConfigPath(clientId)

    // Create a safety backup of the current live config before overwriting
    const db = getDatabase()
    const repo = new BackupsRepo(db)
    const service = new BackupService(repo)

    if (existsSync(liveConfigPath)) {
      service.createBackup(clientId, liveConfigPath, 'sync')
      log.info(`[ipc] safety backup created before restore for ${clientId}`)
    }

    // Restore: copy backup file content back to live config
    const content = readFileSync(backupPath)
    writeFileSync(liveConfigPath, content, { encoding: 'utf-8' })

    log.info(`[ipc] restore complete for ${clientId}`)
  })

  log.info('[ipc] backups handlers registered')
}
