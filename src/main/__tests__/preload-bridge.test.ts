import { describe, expect, it, vi } from 'vitest'
import { createApi } from '../../preload/api/bridge'

const EXPECTED_KEYS = [
  'clientsDetectAll',
  'clientsReadConfig',
  'clientsSync',
  'clientsSyncAll',
  'clientsValidateConfig',
  'serversList',
  'serversGet',
  'serversCreate',
  'serversUpdate',
  'serversDelete',
  'serversImportFromClients',
  'serversTest',
  'rulesList',
  'rulesGet',
  'rulesCreate',
  'rulesUpdate',
  'rulesDelete',
  'rulesEstimateTokens',
  'rulesSyncToClient',
  'rulesSyncAll',
  'rulesDetectWorkspaces',
  'rulesImportFromProject',
  'profilesList',
  'profilesGet',
  'profilesCreate',
  'profilesUpdate',
  'profilesDelete',
  'profilesActivate',
  'secretsSet',
  'secretsGet',
  'secretsDelete',
  'secretsListKeys',
  'secretsDeleteAll',
  'licenseActivate',
  'licenseDeactivate',
  'licenseStatus',
  'licenseFeatureGates',
  'logQuery',
  'gitSyncStatus',
  'gitSyncConnectGitHub',
  'gitSyncConnectManual',
  'gitSyncDisconnect',
  'gitSyncPush',
  'gitSyncPull',
  'registrySearch',
  'registryInstall',
  'stacksExport',
  'stacksImport',
  'backupsList',
  'backupsRestore',
  'showOpenDialog',
  'filesReveal',
  'filesReadText',
  'filesWriteText',
  'appVersion',
  'appStartupStatus',
  'settingsGet',
  'settingsSet',
  'settingsDelete',
  'settingsReset',
  'updaterCheck',
  'updaterInstall',
  'windowMinimize',
  'windowMaximize',
  'windowClose',
  'onConfigChanged',
  'onActivateProfileFromTray',
  'onUpdateAvailable',
  'onUpdateDownloaded',
  'onMaximizeChanged',
  'onStartupProgress',
  'onStartupComplete',
] as const

describe('preload bridge composition', () => {
  it('exports the expected API surface', () => {
    const invoke = vi.fn()
    const on = vi.fn()
    const removeListener = vi.fn()
    const api = createApi({ invoke, on, removeListener })

    expect(Object.keys(api).sort()).toEqual([...EXPECTED_KEYS].sort())
  })

  it('routes domain methods to the correct IPC channels', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    const on = vi.fn()
    const removeListener = vi.fn()
    const api = createApi({ invoke, on, removeListener })

    await api.clientsDetectAll()
    await api.serversList()
    await api.rulesSyncAll()
    await api.settingsSet('language', 'en')
    await api.backupsList('cursor')
    await api.filesReveal('C:\\tmp\\file.txt')

    expect(invoke).toHaveBeenCalledWith('clients:detect-all')
    expect(invoke).toHaveBeenCalledWith('servers:list')
    expect(invoke).toHaveBeenCalledWith('rules:sync-all')
    expect(invoke).toHaveBeenCalledWith('settings:set', 'language', 'en')
    expect(invoke).toHaveBeenCalledWith('backups:list', 'cursor')
    expect(invoke).toHaveBeenCalledWith('files:reveal', 'C:\\tmp\\file.txt')
  })
})
