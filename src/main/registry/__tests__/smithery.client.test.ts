/**
 * @file src/main/registry/__tests__/smithery.client.test.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for SmitheryClient. The `https` module and the
 * keytar service are mocked so tests run fully offline without network calls
 * or credential store access.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('@main/secrets/keytar.service', () => ({
  getSecret: vi.fn().mockResolvedValue(null),
}))

vi.mock('https', () => ({
  default: { get: vi.fn() },
  get: vi.fn(),
}))

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import https from 'https'
import type { IncomingMessage } from 'http'
import { getSecret } from '@main/secrets/keytar.service'
import { SmitheryClient } from '../smithery.client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a fake IncomingMessage that emits the given JSON and then ends. */
const mockHttpsGet = (responseJson: unknown): void => {
  const mockedGet = vi.mocked(https.get)
  mockedGet.mockImplementation(((
    _url: unknown,
    _options: unknown,
    callback: (res: IncomingMessage) => void,
  ) => {
    const chunks: Buffer[] = [Buffer.from(JSON.stringify(responseJson))]
    let dataHandler: ((chunk: Buffer) => void) | null = null
    let endHandler: (() => void) | null = null

    const res = {
      on: (event: string, handler: (arg?: Buffer) => void) => {
        if (event === 'data') dataHandler = handler as (chunk: Buffer) => void
        if (event === 'end') endHandler = handler
        return res
      },
    } as unknown as IncomingMessage

    // Simulate async data emission.
    setTimeout(() => {
      chunks.forEach((c) => dataHandler?.(c))
      endHandler?.()
    }, 0)

    callback(res)
    return { on: vi.fn() } as unknown as ReturnType<typeof https.get>
  }) as unknown as Parameters<typeof mockedGet.mockImplementation>[0])
}

/** Forces `https.get` to call the error handler on the request object. */
const mockHttpsGetError = (errorMsg: string): void => {
  const mockedGet = vi.mocked(https.get)
  mockedGet.mockImplementation(() => {
    const req = { on: vi.fn() }
    // Trigger error on next tick.
    setTimeout(() => {
      const errorCallback = req.on.mock.calls.find(([ev]) => ev === 'error')?.[1] as
        | ((err: Error) => void)
        | undefined
      errorCallback?.(new Error(errorMsg))
    }, 0)
    return req as unknown as ReturnType<typeof https.get>
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SmitheryClient', () => {
  let client: SmitheryClient

  beforeEach(() => {
    client = new SmitheryClient()
    vi.clearAllMocks()
    vi.mocked(getSecret).mockResolvedValue(null)
  })

  describe('searchServers()', () => {
    it('returns mapped RegistryServer[] on a successful response', async () => {
      mockHttpsGet({
        servers: [
          {
            qualifiedName: '@anthropic/github-mcp',
            displayName: 'GitHub MCP',
            description: 'Interact with GitHub',
            isVerified: true,
            deploymentCount: 1200,
            isDeployed: false,
          },
        ],
      })

      const results = await client.searchServers('github')

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        id: '@anthropic/github-mcp',
        displayName: 'GitHub MCP',
        description: 'Interact with GitHub',
        source: 'smithery',
        verified: true,
        useCount: 1200,
        remote: false,
      })
    })

    it('includes the API key as a Bearer header when configured', async () => {
      vi.mocked(getSecret).mockResolvedValue('test-api-key')
      mockHttpsGet({ servers: [] })

      await client.searchServers('anything')

      const callArgs = vi.mocked(https.get).mock.calls[0]
      if (!callArgs) throw new Error('https.get was not called')
      const options = callArgs[1] as { headers?: Record<string, string> }
      expect(options.headers?.['Authorization']).toBe('Bearer test-api-key')
    })

    it('returns [] when the API key is null (no auth header)', async () => {
      vi.mocked(getSecret).mockResolvedValue(null)
      mockHttpsGet({ servers: [] })

      const results = await client.searchServers('anything')

      const callArgs = vi.mocked(https.get).mock.calls[0]
      if (!callArgs) throw new Error('https.get was not called')
      const options = callArgs[1] as { headers?: Record<string, string> }
      expect(options.headers?.['Authorization']).toBeUndefined()
      expect(results).toEqual([])
    })

    it('returns [] and does not throw on HTTP error', async () => {
      mockHttpsGetError('ENOTFOUND registry.smithery.ai')

      const results = await client.searchServers('github')

      expect(results).toEqual([])
    })

    it('returns [] for an empty query without making a network request', async () => {
      const results = await client.searchServers('   ')

      expect(results).toEqual([])
      expect(https.get).not.toHaveBeenCalled()
    })

    it('handles missing optional fields gracefully', async () => {
      mockHttpsGet({
        servers: [{ qualifiedName: 'some/mcp' }],
      })

      const results = await client.searchServers('mcp')

      expect(results[0]).toMatchObject({
        id: 'some/mcp',
        displayName: 'some/mcp',
        description: '',
        verified: false,
        remote: false,
      })
      expect(results[0]?.useCount).toBeUndefined()
    })
  })

  describe('getRemoteInstallRecipe()', () => {
    it('derives an sse recipe when details include transport + url', async () => {
      mockHttpsGet({
        server: {
          transport: 'sse',
          url: 'https://example.com/sse',
        },
      })

      const recipe = await client.getRemoteInstallRecipe('@acme/remote')

      expect(recipe).toEqual({
        type: 'sse',
        url: 'https://example.com/sse',
      })
    })

    it('defaults to http when only a valid endpoint URL is present', async () => {
      mockHttpsGet({
        deployment: {
          endpointUrl: 'https://example.com/mcp',
        },
      })

      const recipe = await client.getRemoteInstallRecipe('@acme/remote')

      expect(recipe).toEqual({
        type: 'http',
        url: 'https://example.com/mcp',
      })
    })

    it('returns null for malformed details payloads', async () => {
      mockHttpsGet({
        server: {
          transport: 'sse',
          url: 'not-a-url',
        },
      })

      const recipe = await client.getRemoteInstallRecipe('@acme/remote')

      expect(recipe).toBeNull()
    })

    it('returns null when details lookup fails', async () => {
      mockHttpsGetError('request failed')

      const recipe = await client.getRemoteInstallRecipe('@acme/remote')

      expect(recipe).toBeNull()
    })
  })
})
