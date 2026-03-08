import type { AiRule, ClientId, SyncResult } from '../../shared/types'
import type { CreateRuleInput, ImportResult, UpdateRuleInput } from '../../shared/channels'
import type { IpcRendererLike } from './types'

export const createRulesApi = (ipcRenderer: IpcRendererLike) => ({
  rulesList: (): Promise<AiRule[]> => ipcRenderer.invoke('rules:list'),
  rulesGet: (id: string): Promise<AiRule | null> => ipcRenderer.invoke('rules:get', id),
  rulesCreate: (input: CreateRuleInput): Promise<AiRule> =>
    ipcRenderer.invoke('rules:create', input),
  rulesUpdate: (id: string, updates: UpdateRuleInput): Promise<AiRule> =>
    ipcRenderer.invoke('rules:update', id, updates),
  rulesDelete: (id: string): Promise<void> => ipcRenderer.invoke('rules:delete', id),
  rulesEstimateTokens: (content: string): Promise<number> =>
    ipcRenderer.invoke('rules:estimate-tokens', content),
  rulesSyncToClient: (clientId: ClientId): Promise<SyncResult> =>
    ipcRenderer.invoke('rules:sync', clientId),
  rulesSyncAll: (): Promise<SyncResult[]> => ipcRenderer.invoke('rules:sync-all'),
  rulesDetectWorkspaces: (): Promise<string[]> => ipcRenderer.invoke('rules:detect-workspaces'),
  rulesImportFromProject: (dirPath: string): Promise<ImportResult> =>
    ipcRenderer.invoke('rules:import-from-project', dirPath),
})
