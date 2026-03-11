/**
 * @file src/main/ipc/diagnostics.ipc.ts
 *
 * @created 11.03.2026
 * @modified 11.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for structured redacted diagnostics.
 * Collects system information, server configurations (with secrets redacted),
 * install intents, device setup state, and recent activity logs into a JSON
 * report suitable for troubleshooting and sharing.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { DiagnosticReport } from '@shared/types'
import { diagnosticsService } from '@main/diagnostics/diagnostics.service'

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `diagnostics:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerDiagnosticsIpc = (): void => {
  // ── diagnostics:generate-report ─────────────────────────────────────────────
  ipcMain.handle(
    'diagnostics:generate-report',
    async (_event, serverId?: string): Promise<DiagnosticReport> => {
      log.debug(`[ipc] diagnostics:generate-report ${serverId ?? '(full)'}`)
      return diagnosticsService.generateReport(serverId)
    },
  )

  log.info('[ipc] diagnostics handlers registered')
}
