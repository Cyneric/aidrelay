/**
 * @file src/main/sync/file-watcher.service.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Watches all known client config file paths using chokidar.
 * When an external tool modifies a config file (e.g. the user updates Cursor
 * settings manually), this service detects the change, diffs the new content
 * against the aidrelay registry, and emits a `clients:config-changed` IPC
 * event to the renderer so it can show an import prompt.
 *
 * Lifecycle:
 *   app start → start() collects config paths from installed adapters
 *             → chokidar watches those paths
 *             → on change: parse, diff, send IPC
 *   app quit  → stop() closes the watcher
 *
 * The diff is a simple set comparison of server names. More detailed field-
 * level diffing is intentionally left for a future version.
 */

import { type FSWatcher, watch } from 'chokidar'
import { readFileSync } from 'fs'
import { BrowserWindow } from 'electron'
import log from 'electron-log'
import type { McpServerMap, ConfigChangedPayload } from '@shared/types'
import type { ClientAdapter } from '@main/clients/types'
import { ADAPTERS, ADAPTER_IDS } from '@main/clients/registry'

export type { ConfigChangedPayload }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses a client config file and returns the set of MCP server names present.
 * Returns an empty set if the file cannot be read or parsed.
 *
 * @param configPath - Absolute path to the client config file.
 * @param schemaKey  - The JSON key that holds the server map (e.g. `mcpServers`).
 * @returns Set of server names found in the file.
 */
const readServerNames = (configPath: string, schemaKey: string): Set<string> => {
  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const servers = parsed[schemaKey] as McpServerMap | undefined
    return new Set(Object.keys(servers ?? {}))
  } catch {
    return new Set()
  }
}

/**
 * Emits a `clients:config-changed` event to all open renderer windows.
 *
 * @param payload - The diff payload to send.
 */
const emitConfigChanged = (payload: ConfigChangedPayload): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('clients:config-changed', payload)
    }
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Manages a chokidar file watcher for all known client config file paths.
 * Emits IPC events to the renderer when external changes are detected.
 */
export class FileWatcherService {
  private watcher: FSWatcher | null = null

  /**
   * Snapshot of server names per config path taken at watch start.
   * Used as the baseline for computing diffs.
   */
  private readonly snapshots = new Map<string, Set<string>>()

  /**
   * Maps config file paths back to the adapter that owns them, so the
   * correct `clientId` can be included in the change event.
   */
  private readonly pathToAdapter = new Map<string, ClientAdapter>()

  /**
   * Starts the file watcher by detecting all installed clients and collecting
   * their config file paths. Existing file contents are snapshotted so diffs
   * can be computed on subsequent changes.
   *
   * Safe to call multiple times — a running watcher is stopped first.
   */
  async start(): Promise<void> {
    await this.stop()

    const pathsToWatch: string[] = []

    for (const id of ADAPTER_IDS) {
      const adapter = ADAPTERS.get(id)!
      const detection = await adapter.detect()
      if (!detection.installed) continue

      for (const configPath of detection.configPaths) {
        pathsToWatch.push(configPath)
        this.pathToAdapter.set(configPath, adapter)
        // Take baseline snapshot so we can diff on first real change.
        this.snapshots.set(configPath, readServerNames(configPath, adapter.schemaKey))
      }
    }

    if (pathsToWatch.length === 0) {
      log.debug('[watcher] no config paths to watch')
      return
    }

    this.watcher = watch(pathsToWatch, {
      persistent: false,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    })

    this.watcher.on('change', (changedPath: string) => {
      this.handleChange(changedPath)
    })

    this.watcher.on('error', (err: unknown) => {
      log.warn('[watcher] error:', err)
    })

    log.info(`[watcher] watching ${pathsToWatch.length} config path(s)`)
  }

  /**
   * Stops the file watcher and clears all internal state.
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.snapshots.clear()
    this.pathToAdapter.clear()
    log.debug('[watcher] stopped')
  }

  /**
   * Handles a file change event by diffing the new server names against the
   * baseline snapshot and emitting an IPC event if anything changed.
   *
   * @param configPath - The path of the file that changed.
   */
  private handleChange(configPath: string): void {
    const adapter = this.pathToAdapter.get(configPath)
    if (!adapter) return

    const previous = this.snapshots.get(configPath) ?? new Set<string>()
    const current = readServerNames(configPath, adapter.schemaKey)

    const added = [...current].filter((name) => !previous.has(name))
    const removed = [...previous].filter((name) => !current.has(name))

    // Update snapshot for the next diff.
    this.snapshots.set(configPath, current)

    if (added.length === 0 && removed.length === 0) {
      // No server-level changes — likely just formatting or a non-server field.
      log.debug(`[watcher] ${adapter.id} config changed but server set is unchanged`)
      return
    }

    log.info(`[watcher] ${adapter.id} config changed: +${added.length} -${removed.length} servers`)

    emitConfigChanged({
      clientId: adapter.id,
      configPath,
      added,
      removed,
      modified: [],
    })
  }
}

/** Singleton instance used across the app lifetime. */
export const fileWatcherService = new FileWatcherService()
