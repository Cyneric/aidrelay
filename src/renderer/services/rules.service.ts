import type { AiRule, ClientId, SyncResult } from '@shared/types'
import type { CreateRuleInput, ImportResult, UpdateRuleInput } from '@shared/channels'

export const rulesService = {
  list: (): Promise<AiRule[]> => window.api.rulesList(),
  create: (input: CreateRuleInput): Promise<AiRule> => window.api.rulesCreate(input),
  update: (id: string, updates: UpdateRuleInput): Promise<AiRule> =>
    window.api.rulesUpdate(id, updates),
  remove: (id: string): Promise<void> => window.api.rulesDelete(id),
  syncAll: (): Promise<SyncResult[]> => window.api.rulesSyncAll(),
  syncClient: (clientId: ClientId): Promise<SyncResult> => window.api.rulesSyncToClient(clientId),
  detectWorkspaces: (): Promise<string[]> => window.api.rulesDetectWorkspaces(),
  importFromProject: (dirPath: string): Promise<ImportResult> =>
    window.api.rulesImportFromProject(dirPath),
  estimateTokens: (content: string): Promise<number> => window.api.rulesEstimateTokens(content),
}
