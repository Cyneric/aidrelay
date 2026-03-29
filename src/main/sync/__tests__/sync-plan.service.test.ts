import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { AiRule, McpServer, Profile, SyncPreviewResult } from '@shared/types'

const mockState = vi.hoisted(() => ({
  adapterMap: new Map([
    [
      'cursor',
      {
        id: 'cursor',
        displayName: 'Cursor',
      },
    ],
  ]),
  detectionByClient: {} as Record<
    string,
    { installed: boolean; configPaths: readonly string[]; serverCount: number }
  >,
  manualPathByClient: {} as Record<string, string | undefined>,
  profiles: [] as Profile[],
  servers: [] as McpServer[],
  rules: [] as AiRule[],
  previewSyncWithServersMock:
    vi.fn<
      (
        adapter: { id: string; displayName: string },
        configPath: string,
        serversOverride?: readonly McpServer[],
      ) => Promise<SyncPreviewResult>
    >(),
  rulesPreviewAllMock: vi.fn(),
}))

let detectionByClient = mockState.detectionByClient
let manualPathByClient = mockState.manualPathByClient
let servers = mockState.servers
let rules = mockState.rules
const previewSyncWithServersMock = mockState.previewSyncWithServersMock
const rulesPreviewAllMock = mockState.rulesPreviewAllMock

vi.mock('@main/clients/registry', () => ({
  ADAPTER_IDS: ['cursor'],
  ADAPTERS: mockState.adapterMap,
}))

vi.mock('@main/ipc/clients.ipc', () => ({
  resolveClientDetection: vi.fn((clientId: string) => ({
    detection: mockState.detectionByClient[clientId] ?? {
      installed: false,
      configPaths: [],
      serverCount: 0,
    },
    manualConfigPath: mockState.manualPathByClient[clientId],
  })),
  resolveConfigPathForSync: vi.fn(
    (
      clientId: string,
      detection: { installed: boolean; configPaths: readonly string[] },
      manualConfigPath: string | undefined,
      options?: { allowCreateConfigIfMissing?: boolean },
    ) => {
      if (detection.configPaths.length > 0) {
        return {
          configPath: detection.configPaths[0]!,
          requiresConfigCreationConfirm: false,
        }
      }

      const fallbackPath = manualConfigPath ?? join(process.cwd(), `${clientId}.json`)
      if (options?.allowCreateConfigIfMissing) {
        return {
          configPath: fallbackPath,
          requiresConfigCreationConfirm: false,
        }
      }

      return {
        configPath: null,
        requiresConfigCreationConfirm: true,
      }
    },
  ),
  getStoredManualConfigPath: vi.fn((clientId: string) => mockState.manualPathByClient[clientId]),
}))

vi.mock('@main/db/connection', () => ({
  getDatabase: vi.fn(() => ({})),
}))

vi.mock('@main/db/servers.repo', () => ({
  ServersRepo: vi.fn().mockImplementation(() => ({
    findAll: () => mockState.servers,
  })),
}))

vi.mock('@main/db/rules.repo', () => ({
  RulesRepo: vi.fn().mockImplementation(() => ({
    findAll: () => mockState.rules,
  })),
}))

vi.mock('@main/db/profiles.repo', () => ({
  ProfilesRepo: vi.fn().mockImplementation(() => ({
    findById: (id: string) => mockState.profiles.find((profile) => profile.id === id),
  })),
}))

vi.mock('@main/db/activity-log.repo', () => ({
  ActivityLogRepo: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('@main/db/backups.repo', () => ({
  BackupsRepo: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('@main/sync/backup.service', () => ({
  BackupService: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('@main/sync/sync.service', () => ({
  SyncService: vi.fn().mockImplementation(() => ({
    previewSyncWithServers: mockState.previewSyncWithServersMock,
  })),
}))

vi.mock('@main/rules/rules-sync.service', () => ({
  RulesSyncService: vi.fn().mockImplementation(() => ({
    previewAll: mockState.rulesPreviewAllMock,
  })),
}))

import { syncPlanService } from '../sync-plan.service'

const makeServer = (overrides: Partial<McpServer> = {}): McpServer => ({
  id: 'server-1',
  name: 'Filesystem',
  type: 'stdio',
  command: 'npx',
  args: [],
  env: {},
  secretEnvKeys: [],
  headers: {},
  secretHeaderKeys: [],
  enabled: true,
  clientOverrides: {} as McpServer['clientOverrides'],
  tags: [],
  notes: '',
  createdAt: '2026-03-29T00:00:00.000Z',
  updatedAt: '2026-03-29T00:00:00.000Z',
  recipeId: '',
  recipeVersion: '',
  setupStatus: 'ready',
  lastInstallResult: {},
  lastInstallTimestamp: '',
  installPolicy: 'manual',
  normalizedLaunchConfig: {},
  ...overrides,
})

const makeRule = (overrides: Partial<AiRule> = {}): AiRule => ({
  id: 'rule-1',
  name: 'Safety Rule',
  description: '',
  content: 'Always validate inputs.',
  category: 'coding',
  tags: [],
  enabled: true,
  priority: 'normal',
  scope: 'global',
  fileGlobs: [],
  alwaysApply: true,
  clientOverrides: {} as AiRule['clientOverrides'],
  tokenEstimate: 10,
  createdAt: '2026-03-29T00:00:00.000Z',
  updatedAt: '2026-03-29T00:00:00.000Z',
  ...overrides,
})

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'profile-1',
  name: 'Focus Mode',
  description: '',
  icon: '',
  color: '#123456',
  isActive: false,
  serverOverrides: {},
  ruleOverrides: {},
  createdAt: '2026-03-29T00:00:00.000Z',
  updatedAt: '2026-03-29T00:00:00.000Z',
  ...overrides,
})

describe('syncPlanService', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'aidrelay-sync-plan-'))
    mockState.detectionByClient = detectionByClient = {}
    mockState.manualPathByClient = manualPathByClient = {}
    mockState.profiles = []
    mockState.servers = servers = []
    mockState.rules = rules = []
    previewSyncWithServersMock.mockReset()
    rulesPreviewAllMock.mockReset()
    rulesPreviewAllMock.mockReturnValue({ cursor: [] })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('emits a file entry with the exact config path and modify action for an existing config', async () => {
    const configPath = join(tmpDir, 'cursor-mcp.json')
    writeFileSync(configPath, '{}', 'utf-8')

    detectionByClient['cursor'] = {
      installed: true,
      configPaths: [configPath],
      serverCount: 1,
    }
    previewSyncWithServersMock.mockResolvedValue({
      clientId: 'cursor',
      configPath,
      items: [
        {
          name: 'filesystem',
          source: 'modified',
          action: 'overwrite',
          before: { command: 'old' },
          after: { command: 'new' },
        },
      ],
    })

    const result = await syncPlanService.preview({ kind: 'client', clientId: 'cursor' })

    expect(result.confirmable).toBe(true)
    expect(result.blockers).toEqual([])
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toMatchObject({
      path: configPath,
      action: 'modify',
      clientId: 'cursor',
      clientName: 'Cursor',
      feature: 'mcp-config',
      origin: 'client-sync',
    })
  })

  it('returns a blocker instead of syncing when config creation still needs confirmation', async () => {
    const plannedPath = join(tmpDir, 'cursor-new.json')
    detectionByClient['cursor'] = {
      installed: true,
      configPaths: [],
      serverCount: 0,
    }
    manualPathByClient['cursor'] = plannedPath

    const result = await syncPlanService.preview({ kind: 'client', clientId: 'cursor' })

    expect(previewSyncWithServersMock).not.toHaveBeenCalled()
    expect(result.confirmable).toBe(false)
    expect(result.entries).toEqual([])
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clientId: 'cursor',
          path: plannedPath,
          title: 'Cursor needs a config file',
        }),
      ]),
    )
  })

  it('returns a blocker when previewing fails because the config is invalid', async () => {
    const configPath = join(tmpDir, 'broken-cursor.json')
    writeFileSync(configPath, '{ not valid json ', 'utf-8')

    detectionByClient['cursor'] = {
      installed: true,
      configPaths: [configPath],
      serverCount: 1,
    }
    previewSyncWithServersMock.mockRejectedValue(
      new Error(`Config file contains invalid JSON: ${configPath}`),
    )

    const result = await syncPlanService.preview({ kind: 'client', clientId: 'cursor' })

    expect(result.confirmable).toBe(false)
    expect(result.entries).toEqual([])
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clientId: 'cursor',
          path: configPath,
          title: 'Could not preview Cursor',
        }),
      ]),
    )
  })

  it('includes profile override summaries and previewed writes without mutating stored data', async () => {
    const configPath = join(tmpDir, 'cursor-profile.json')
    writeFileSync(configPath, '{}', 'utf-8')

    const originalServer = makeServer({ id: 'server-1', name: 'Filesystem', enabled: true })
    const originalRule = makeRule({ id: 'rule-1', name: 'Safety Rule', enabled: true })

    mockState.servers = servers = [originalServer]
    mockState.rules = rules = [originalRule]
    mockState.profiles = [
      makeProfile({
        serverOverrides: {
          'server-1': {
            enabled: false,
          },
        },
        ruleOverrides: {
          'rule-1': {
            enabled: false,
          },
        },
      }),
    ]
    detectionByClient['cursor'] = {
      installed: true,
      configPaths: [configPath],
      serverCount: 1,
    }

    previewSyncWithServersMock.mockImplementation((_adapter, path, serversOverride) => {
      expect(path).toBe(configPath)
      expect(serversOverride?.find((server) => server.id === 'server-1')?.enabled).toBe(false)
      return Promise.resolve({
        clientId: 'cursor',
        configPath,
        items: [
          {
            name: 'filesystem',
            source: 'removed',
            action: 'removed',
            before: { command: 'npx' },
            after: null,
          },
        ],
      })
    })

    rulesPreviewAllMock.mockImplementation((_clientIds, rulesOverride?: readonly AiRule[]) => {
      expect(rulesOverride?.find((rule) => rule.id === 'rule-1')?.enabled).toBe(false)
      return {
        cursor: [
          {
            path: join(tmpDir, '.cursor', 'rules', 'safety-rule.mdc'),
            before: null,
            after: 'Always validate inputs.',
            action: 'create',
            ruleCount: 1,
          },
        ],
      }
    })

    const result = await syncPlanService.preview({
      kind: 'profile-activate',
      profileId: 'profile-1',
    })

    expect(result.blockers).toEqual([])
    expect(result.confirmable).toBe(true)
    expect(result.profileSummary).toMatchObject({
      profileId: 'profile-1',
      profileName: 'Focus Mode',
      serverOverrides: [
        {
          id: 'server-1',
          name: 'Filesystem',
          currentEnabled: true,
          nextEnabled: false,
        },
      ],
      ruleOverrides: [
        {
          id: 'rule-1',
          name: 'Safety Rule',
          currentEnabled: true,
          nextEnabled: false,
        },
      ],
    })
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          origin: 'profile-activation',
          feature: 'mcp-config',
          path: configPath,
          action: 'modify',
        }),
        expect.objectContaining({
          origin: 'profile-activation',
          feature: 'rules',
          action: 'create',
        }),
      ]),
    )
    expect(servers[0]?.enabled).toBe(true)
    expect(rules[0]?.enabled).toBe(true)
  })
})
