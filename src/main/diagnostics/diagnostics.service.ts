/**
 * @file src/main/diagnostics/diagnostics.service.ts
 *
 * @created 11.03.2026
 * @modified 11.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Structured redacted install diagnostics service. Collects
 * installation logs, runtime detection results, server configurations (with
 * secrets redacted), and system information into a JSON report suitable for
 * troubleshooting and sharing.
 */

import os from 'os'
import log from 'electron-log'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { SyncInstallIntentRepo } from '@main/db/sync-install-intent.repo'
import { DeviceSetupStateRepo } from '@main/db/device-setup-state.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { gitSyncService } from '@main/git-sync/git-sync.service'
import type {
  McpServer,
  SyncedInstallIntent,
  DeviceSetupState,
  LogEntry,
  ActivityLogEntry,
  DiagnosticReport,
  ServerDiagnostic,
} from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Redacts secret values in environment variables and headers.
 * Replaces the value with `***REDACTED***` for keys marked as secret.
 */
const redactServerConfig = (server: McpServer): McpServer => {
  const redacted = { ...server }

  // Redact secret env values
  const redactedEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(redacted.env)) {
    if (server.secretEnvKeys.includes(key)) {
      redactedEnv[key] = '***REDACTED***'
    } else {
      redactedEnv[key] = value
    }
  }
  redacted.env = redactedEnv

  // Redact secret header values (if any)
  // Note: secretHeaderKeys are keys of the `headers` object (not env).
  // Since headers are not stored in the server object (they are in secret store),
  // we don't need to redact them here.
  return redacted
}

/**
 * Replaces user home directory in file paths with `~` to avoid exposing
 * personally identifiable information.
 */
const redactPaths = (text: string): string => {
  const home = os.homedir()
  if (home && text.includes(home)) {
    return text.replace(new RegExp(home.replace(/\\/g, '\\\\'), 'gi'), '~')
  }
  return text
}

/**
 * Recursively redacts user home directory paths in any string values
 * within an object or array. Returns a new object with redacted strings.
 */
const redactPathsInObject = <T>(value: T): T => {
  if (typeof value === 'string') {
    return redactPaths(value) as T
  }
  if (Array.isArray(value)) {
    return value.map(redactPathsInObject) as T
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = redactPathsInObject(val)
    }
    return result as T
  }
  return value
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Provides structured redacted diagnostics for installation troubleshooting.
 * Use the exported singleton `diagnosticsService` — do not instantiate this
 * class directly.
 */
class DiagnosticsService {
  private readonly deviceId: string

  constructor() {
    this.deviceId = os.hostname()
  }

  /**
   * Creates fresh repository instances from the current database connection.
   */
  private createRepos(): {
    servers: ServersRepo
    installIntents: SyncInstallIntentRepo
    deviceSetupState: DeviceSetupStateRepo
    log: ActivityLogRepo
  } {
    const db = getDatabase()
    return {
      servers: new ServersRepo(db),
      installIntents: new SyncInstallIntentRepo(db),
      deviceSetupState: new DeviceSetupStateRepo(db),
      log: new ActivityLogRepo(db),
    }
  }

  /**
   * Collects system information that is safe to share (no secrets, no PII).
   */
  private async collectSystemInfo(): Promise<{
    platform: string
    arch: string
    hostname: string
    appVersion: string
    electronVersion: string
    nodeVersion: string
    gitSyncConnected: boolean
    gitRemoteUrl?: string
  }> {
    const gitStatus = await gitSyncService.getStatus()
    const result: {
      platform: string
      arch: string
      hostname: string
      appVersion: string
      electronVersion: string
      nodeVersion: string
      gitSyncConnected: boolean
      gitRemoteUrl?: string
    } = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      appVersion: process.env.npm_package_version ?? 'unknown',
      electronVersion: process.versions.electron,
      nodeVersion: process.version,
      gitSyncConnected: gitStatus.connected,
    }
    if (gitStatus.config?.remoteUrl !== undefined) {
      result.gitRemoteUrl = gitStatus.config.remoteUrl
    }
    return result
  }

  /**
   * Builds a diagnostic entry for a single server, including its install intent,
   * device‑specific setup state, and redacted configuration.
   */
  private buildServerDiagnostic(
    server: McpServer,
    installIntent: SyncedInstallIntent | null,
    deviceState: DeviceSetupState | null,
  ): ServerDiagnostic {
    const redactedServer = redactServerConfig(server)

    // Redact paths in logs
    const redactedLogs: LogEntry[] = (deviceState?.logs ?? []).map((entry) => ({
      ...entry,
      message: redactPaths(entry.message),
    }))

    return {
      serverId: server.id,
      serverName: server.name,
      serverType: server.type,
      config: redactedServer,
      installIntent: installIntent ?? null,
      deviceSetupState: deviceState
        ? {
            ...deviceState,
            logs: redactedLogs,
          }
        : null,
    }
  }

  /**
   * Generates a complete diagnostic report for all servers, or for a single
   * server if `serverId` is provided.
   *
   * @param serverId Optional server ID to limit the report to one server.
   * @returns A `DiagnosticReport` object ready for JSON serialization.
   */
  async generateReport(serverId?: string): Promise<DiagnosticReport> {
    log.info(
      `[diagnostics] Generating diagnostic report${serverId ? ` for server ${serverId}` : ''}`,
    )

    const repos = this.createRepos()
    const systemInfo = await this.collectSystemInfo()

    // Determine which servers to include
    const servers = serverId
      ? (() => {
          const server = repos.servers.findById(serverId)
          return server ? [server] : []
        })()
      : repos.servers.findAll()

    const serverDiagnostics: ServerDiagnostic[] = []

    for (const server of servers) {
      const installIntent = repos.installIntents.findByServerId(server.id)
      const deviceState = repos.deviceSetupState.findByServerId(this.deviceId, server.id)
      serverDiagnostics.push(this.buildServerDiagnostic(server, installIntent, deviceState))
    }

    // Collect recent activity log entries (last 100) for additional context
    const recentActivity = repos.log.query({ limit: 100 }).map((entry: ActivityLogEntry) => ({
      ...entry,
      details: redactPathsInObject(entry.details),
    }))

    const report: DiagnosticReport = {
      timestamp: new Date().toISOString(),
      systemInfo,
      serverDiagnostics,
      recentActivity,
    }

    log.info(`[diagnostics] Diagnostic report generated (${serverDiagnostics.length} server(s))`)
    return report
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * Application‑wide singleton instance of the diagnostics service.
 * All IPC handlers should import and use this instance directly.
 */
export const diagnosticsService = new DiagnosticsService()
