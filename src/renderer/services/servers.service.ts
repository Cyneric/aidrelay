import type { McpServer, SyncResult } from '@shared/types'
import type {
  CreateServerInput,
  ImportResult,
  TestResult,
  UpdateServerInput,
} from '@shared/channels'

export const serversService = {
  list: (): Promise<McpServer[]> => window.api.serversList(),
  create: (input: CreateServerInput): Promise<McpServer> => window.api.serversCreate(input),
  update: (id: string, updates: UpdateServerInput): Promise<McpServer> =>
    window.api.serversUpdate(id, updates),
  remove: (id: string): Promise<void> => window.api.serversDelete(id),
  importFromClients: (): Promise<ImportResult> => window.api.serversImportFromClients(),
  test: (id: string): Promise<TestResult> => window.api.serversTest(id),
  syncAllClients: (): Promise<SyncResult[]> => window.api.clientsSyncAll(),
}
