/**
 * @file src/main/ipc/__tests__/registry.ipc.test.ts
 *
 * @created 07.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for registry IPC handlers. The registry providers
 * and database repos are mocked so tests run in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestDb } from '@main/db/__tests__/helpers'
import { getDatabase } from '@main/db/connection'
import type { RegistryInstallPlan, RegistryInstallRequest } from '@shared/channels'

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}))

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@main/db/connection', () => ({ getDatabase: vi.fn() }))

vi.mock('@main/secrets/keytar.service', () => ({
  storeSecret: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@main/registry/providers', () => ({
  searchRegistry: vi.fn().mockResolvedValue([]),
  prepareRegistryInstallPlan: vi.fn(),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { ipcMain } from 'electron'
import { searchRegistry, prepareRegistryInstallPlan } from '@main/registry/providers'
import { registerRegistryIpc } from '../registry.ipc'

type IpcHandler = (_event: unknown, ...args: unknown[]) => unknown

/** Returns the handler registered for a given channel. */
const getHandler = (channel: string): IpcHandler => {
  const calls = vi.mocked(ipcMain.handle).mock.calls
  const call = calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`No handler registered for "${channel}"`)
  return call[1] as IpcHandler
}

const makeStdioPlan = (serverId: string): RegistryInstallPlan => ({
  provider: 'smithery',
  serverId,
  displayName: serverId.split('/').pop() ?? serverId,
  description: '',
  options: [
    {
      id: 'smithery-stdio',
      label: 'Local package',
      type: 'stdio',
      command: 'npx',
      args: ['-y', serverId],
      inputFields: [],
    },
  ],
  defaultOptionId: 'smithery-stdio',
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('registry IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const db = createTestDb()
    vi.mocked(getDatabase).mockReturnValue(db)
    vi.mocked(prepareRegistryInstallPlan).mockImplementation((_provider, serverId) =>
      Promise.resolve(makeStdioPlan(serverId)),
    )
    registerRegistryIpc()
  })

  describe('registry:search', () => {
    it('dispatches to the selected provider and returns mapped results', async () => {
      const mockResults = [
        {
          id: '@a/b',
          displayName: 'B',
          description: '',
          source: 'smithery' as const,
          verified: false,
          remote: false,
        },
      ]
      vi.mocked(searchRegistry).mockResolvedValueOnce(mockResults)

      const handler = getHandler('registry:search')
      const result = await handler(null, 'smithery', 'github')

      expect(searchRegistry).toHaveBeenCalledWith('smithery', 'github')
      expect(result).toEqual(mockResults)
    })

    it('supports official provider lookups', async () => {
      vi.mocked(searchRegistry).mockResolvedValueOnce([])

      const handler = getHandler('registry:search')
      const result = await handler(null, 'official', 'github')

      expect(searchRegistry).toHaveBeenCalledWith('official', 'github')
      expect(result).toEqual([])
    })
  })

  describe('registry:install', () => {
    it('creates a server from the qualified name and returns it', async () => {
      const request: RegistryInstallRequest = {
        provider: 'smithery',
        serverId: '@anthropic/github-mcp',
        optionId: 'smithery-stdio',
        confirmed: true,
      }

      const handler = getHandler('registry:install')
      const server = await handler(null, request)

      expect(server).toMatchObject({
        name: 'github-mcp',
        command: 'npx',
        args: ['-y', '@anthropic/github-mcp'],
        type: 'stdio',
      })
    })

    it('installs a remote server natively when a recipe is resolved', async () => {
      vi.mocked(prepareRegistryInstallPlan).mockResolvedValueOnce({
        provider: 'smithery',
        serverId: '@acme/remote-mcp',
        displayName: 'remote-mcp',
        description: '',
        options: [
          {
            id: 'smithery-remote',
            label: 'Hosted (SSE)',
            type: 'sse',
            command: 'fetch',
            args: [],
            url: 'https://example.com/sse',
            inputFields: [],
          },
        ],
        defaultOptionId: 'smithery-remote',
      })

      const request: RegistryInstallRequest = {
        provider: 'smithery',
        serverId: '@acme/remote-mcp',
        optionId: 'smithery-remote',
        confirmed: true,
      }

      const handler = getHandler('registry:install')
      const server = await handler(null, request)

      expect(server).toMatchObject({
        name: 'remote-mcp',
        type: 'sse',
        url: 'https://example.com/sse',
        command: 'fetch',
        args: [],
      })
    })

    it('falls back to stdio install when no remote recipe is available', async () => {
      const request: RegistryInstallRequest = {
        provider: 'smithery',
        serverId: '@acme/fallback',
        optionId: 'smithery-stdio',
        confirmed: true,
      }

      const handler = getHandler('registry:install')
      const server = await handler(null, request)

      expect(server).toMatchObject({
        name: 'fallback',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@acme/fallback'],
      })
    })
  })
})
