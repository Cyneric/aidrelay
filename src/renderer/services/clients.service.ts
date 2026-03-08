import type {
  ClientId,
  ClientStatus,
  ConfigChangedPayload,
  SyncClientOptions,
  SyncResult,
  ValidationResult,
} from '@shared/types'

export const clientsService = {
  detectAll: (): Promise<ClientStatus[]> => window.api.clientsDetectAll(),
  sync: (clientId: ClientId, options?: SyncClientOptions): Promise<SyncResult> =>
    window.api.clientsSync(clientId, options),
  syncAll: (): Promise<SyncResult[]> => window.api.clientsSyncAll(),
  validateConfig: (clientId: ClientId): Promise<ValidationResult> =>
    window.api.clientsValidateConfig(clientId),
  onConfigChanged: (handler: (payload: ConfigChangedPayload) => void): (() => void) =>
    window.api.onConfigChanged(handler),
  onActivateProfileFromTray: (handler: (profileId: string) => void): (() => void) =>
    window.api.onActivateProfileFromTray(handler),
}
