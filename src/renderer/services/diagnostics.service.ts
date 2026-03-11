/**
 * @file src/renderer/services/diagnostics.service.ts
 *
 * @created 11.03.2026
 * @modified 11.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Service for structured redacted diagnostics.
 * Provides a single method to generate a diagnostic report for troubleshooting.
 */

import type { DiagnosticReport } from '@shared/types'

export const diagnosticsService = {
  generateReport: (serverId?: string): Promise<DiagnosticReport> =>
    window.api.diagnosticsGenerateReport(serverId),
}
