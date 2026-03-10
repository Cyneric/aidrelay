import { describe, expect, it, vi } from 'vitest'
import { createApi } from '../../preload/api/bridge'

const EXPECTED_KEYS = [
  'clientsDetectAll',
  'clientsInstall',
  'clientsReadConfig',
  'clientsSync',
  'clientsSyncAll',
  'clientsPreviewConfigImport',
  'clientsPreviewSync',
  'clientsPreviewSyncAll',
  'clientsImportConfigChanges',
  'clientsSetManualConfigPath',
  'clientsClearManualConfigPath',
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
  'registryPrepareInstall',
  'registryInstall',
  'installerPrepare',
  'installerPreflight',
  'installerRun',
  'installerCancel',
  'installerStatus',
  'installerRepair',
  'syncListPending',
  'syncApplyPending',
  'syncAutoPull',
  'syncResolveConflict',
  'syncPushReview',
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
  'onClientInstallProgress',
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
    await api.clientsInstall('cursor')
    await api.clientsPreviewConfigImport({
      clientId: 'cursor',
      configPath: 'C:\\tmp\\mcp.json',
      added: ['alpha'],
      removed: [],
      modified: [],
    })
    await api.clientsImportConfigChanges({
      clientId: 'cursor',
      configPath: 'C:\\tmp\\mcp.json',
      added: [],
      removed: ['alpha'],
      modified: [],
    })
    await api.clientsSetManualConfigPath('cursor', 'C:\\tmp\\mcp.json')
    await api.clientsClearManualConfigPath('cursor')
    await api.serversList()
    await api.rulesSyncAll()
    await api.settingsSet('language', 'en')
    await api.backupsList('cursor')
    await api.filesReveal('C:\\tmp\\file.txt')
    await api.registryPrepareInstall('smithery', '@anthropic/github-mcp')
    const offInstallProgress = api.onClientInstallProgress(() => {})
    offInstallProgress()

    expect(invoke).toHaveBeenCalledWith('clients:detect-all')
    expect(invoke).toHaveBeenCalledWith('clients:install', 'cursor')
    expect(invoke).toHaveBeenCalledWith('clients:preview-config-import', {
      clientId: 'cursor',
      configPath: 'C:\\tmp\\mcp.json',
      added: ['alpha'],
      removed: [],
      modified: [],
    })
    expect(invoke).toHaveBeenCalledWith('clients:import-config-changes', {
      clientId: 'cursor',
      configPath: 'C:\\tmp\\mcp.json',
      added: [],
      removed: ['alpha'],
      modified: [],
    })
    expect(invoke).toHaveBeenCalledWith(
      'clients:set-manual-config-path',
      'cursor',
      'C:\\tmp\\mcp.json',
    )
    expect(invoke).toHaveBeenCalledWith('clients:clear-manual-config-path', 'cursor')
    expect(invoke).toHaveBeenCalledWith('servers:list')
    expect(invoke).toHaveBeenCalledWith('rules:sync-all')
    expect(invoke).toHaveBeenCalledWith('settings:set', 'language', 'en')
    expect(invoke).toHaveBeenCalledWith('backups:list', 'cursor')
    expect(invoke).toHaveBeenCalledWith('files:reveal', 'C:\\tmp\\file.txt')
    expect(invoke).toHaveBeenCalledWith(
      'registry:prepare-install',
      'smithery',
      '@anthropic/github-mcp',
    )
    const installProgressListener = (
      on.mock.calls as [string, (...args: unknown[]) => void][]
    ).find((call) => call[0] === 'clients:install-progress')?.[1]
    expect(installProgressListener).toBeTypeOf('function')
    expect(removeListener).toHaveBeenCalledWith('clients:install-progress', installProgressListener)
  })
})
