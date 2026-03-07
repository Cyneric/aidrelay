/**
 * @file src/main/rules/workspace-detector.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Scans VS Code and Cursor workspace history files to suggest
 * recently opened project directories. Reads `storage.json` from each tool's
 * global storage directory, extracts `file:///` URIs from the window state,
 * and returns deduplicated absolute paths. Falls back gracefully when files
 * are absent, unreadable, or contain unexpected structure.
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import log from 'electron-log'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a `file:///` URI to an absolute path.
 * Returns `null` for non-file URIs or invalid strings.
 */
const fileUriToPath = (uri: unknown): string | null => {
  if (typeof uri !== 'string') return null
  if (!uri.startsWith('file:///')) return null
  // Strip the `file:///` prefix and decode percent-encoding.
  // On Windows the path starts with the drive letter, e.g. `C:/...`.
  return decodeURIComponent(uri.slice('file:///'.length)).replace(/\//g, '\\')
}

/**
 * Attempts to read and parse a JSON file from `filePath`.
 * Returns `null` when the file does not exist or cannot be parsed.
 */
const readJson = (filePath: string): unknown => {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as unknown
  } catch (err) {
    log.warn(`[workspace-detector] Failed to parse ${filePath}: ${String(err)}`)
    return null
  }
}

/**
 * Extracts folder paths from VS Code / Cursor's `storage.json` windowsState.
 * Returns an empty array on any structural mismatch.
 */
const extractPathsFromStorage = (storagePath: string): string[] => {
  const data = readJson(storagePath)
  if (data === null || typeof data !== 'object') return []

  const record = data as Record<string, unknown>
  const windowsState = record['windowsState']
  if (!windowsState || typeof windowsState !== 'object') return []

  const ws = windowsState as Record<string, unknown>
  const openedWindows = ws['openedWindows']
  if (!Array.isArray(openedWindows)) return []

  const paths: string[] = []

  for (const win of openedWindows as unknown[]) {
    if (!win || typeof win !== 'object') continue
    const w = win as Record<string, unknown>

    // Single-folder workspace
    const folderUri = w['folderUri']
    const converted = fileUriToPath(folderUri)
    if (converted) paths.push(converted)
  }

  // Also check lastActiveWindow and lastOpenedFolders if present
  for (const key of ['lastActiveWindow', 'lastPluginDevelopmentHostWindow'] as const) {
    const win = ws[key]
    if (!win || typeof win !== 'object') continue
    const w = win as Record<string, unknown>
    const folderUri = w['folderUri']
    const converted = fileUriToPath(folderUri)
    if (converted) paths.push(converted)
  }

  return paths
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detects recently opened workspace directories from VS Code and Cursor.
 *
 * Reads from:
 *   - `%APPDATA%\Code\User\globalStorage\storage.json` (VS Code)
 *   - `%APPDATA%\Cursor\User\globalStorage\storage.json` (Cursor)
 *
 * Returned paths are absolute Windows paths, deduplicated, and filtered to
 * only include directories that currently exist on disk.
 *
 * @returns Sorted array of unique, existing workspace directory paths.
 */
export const detectRecentWorkspaces = (): string[] => {
  const appData = process.env['APPDATA'] ?? ''

  const storagePaths = [
    join(appData, 'Code', 'User', 'globalStorage', 'storage.json'),
    join(appData, 'Cursor', 'User', 'globalStorage', 'storage.json'),
  ]

  const allPaths = new Set<string>()

  for (const storagePath of storagePaths) {
    const paths = extractPathsFromStorage(storagePath)
    for (const p of paths) allPaths.add(p)
  }

  return Array.from(allPaths).sort()
}
