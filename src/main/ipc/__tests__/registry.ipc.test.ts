/**
 * @file src/main/ipc/__tests__/registry.ipc.test.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for registry IPC handlers. The Smithery client,
 * database repos, and feature gates are all mocked so tests run in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestDb } from '@main/db/__tests__/helpers'
import { getDatabase } from '@main/db/connection'

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}))

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@main/db/connection', () => ({ getDatabase: vi.fn() }))

vi.mock('@main/licensing/feature-gates', () => ({
  checkGate: vi.fn().mockImplementation((key: string) => {
    if (key === 'registryInstall') return true
    if (key === 'maxServers') return Infinity
    return true
  }),
}))

vi.mock('@main/registry/smithery.client', () => ({
  smitheryClient: {
    searchServers: vi.fn().mockResolvedValue([]),
    getRemoteInstallRecipe: vi.fn().mockResolvedValue(null),
  },
}))

vi.mock('@main/registry/providers', () => ({
  searchRegistry: vi.fn().mockResolvedValue([]),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { ipcMain } from 'electron'
import { checkGate } from '@main/licensing/feature-gates'
import { searchRegistry } from '@main/registry/providers'
import { smitheryClient } from '@main/registry/smithery.client'
import { registerRegistryIpc } from '../registry.ipc'

type IpcHandler = (_event: unknown, ...args: unknown[]) => unknown

/** Returns the handler registered for a given channel. */
const getHandler = (channel: string): IpcHandler => {
  const calls = vi.mocked(ipcMain.handle).mock.calls
  const call = calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`No handler registered for "${channel}"`)
  return call[1] as IpcHandler
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('registry IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const db = createTestDb()
    vi.mocked(getDatabase).mockReturnValue(db)
    vi.mocked(checkGate).mockImplementation((key: string) => {
      if (key === 'registryInstall') return true
      if (key === 'maxServers') return Infinity
      return true
    })
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
      const handler = getHandler('registry:install')
      const server = await handler(null, '@anthropic/github-mcp')

      expect(server).toMatchObject({
        name: 'github-mcp',
        command: 'npx',
        args: ['-y', '@anthropic/github-mcp'],
        type: 'stdio',
      })
    })

    it('installs a remote server natively when a recipe is resolved', async () => {
      vi.mocked(smitheryClient.getRemoteInstallRecipe).mockResolvedValueOnce({
        type: 'sse',
        url: 'https://example.com/sse',
      })

      const handler = getHandler('registry:install')
      const server = await handler(null, '@acme/remote-mcp')

      expect(server).toMatchObject({
        name: 'remote-mcp',
        type: 'sse',
        url: 'https://example.com/sse',
        command: 'fetch',
        args: [],
      })
    })

    it('falls back to stdio install when no remote recipe is available', async () => {
      vi.mocked(smitheryClient.getRemoteInstallRecipe).mockResolvedValueOnce(null)

      const handler = getHandler('registry:install')
      const server = await handler(null, '@acme/fallback')

      expect(server).toMatchObject({
        name: 'fallback',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@acme/fallback'],
      })
    })

    it('throws when the registryInstall gate is false', async () => {
      vi.mocked(checkGate).mockImplementation((key: string) => {
        if (key === 'registryInstall') return false
        if (key === 'maxServers') return Infinity
        return true
      })

      const handler = getHandler('registry:install')
      await expect(handler(null, '@some/server')).rejects.toThrow('Pro')
    })

    it('throws when the server limit is reached', async () => {
      vi.mocked(checkGate).mockImplementation((key: string) => {
        if (key === 'registryInstall') return true
        if (key === 'maxServers') return 0
        return true
      })

      const handler = getHandler('registry:install')
      await expect(handler(null, '@some/server')).rejects.toThrow('limit')
    })
  })
})
