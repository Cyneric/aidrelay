import type { DiagnosticReport } from '../../shared/types'
import type { IpcRendererLike } from './types'

export const createDiagnosticsApi = (ipcRenderer: IpcRendererLike) => ({
  diagnosticsGenerateReport: (serverId?: string): Promise<DiagnosticReport> =>
    ipcRenderer.invoke('diagnostics:generate-report', serverId),
})
