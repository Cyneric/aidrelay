/**
 * @file src/main/registry/__tests__/official-registry.client.test.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for OfficialRegistryClient.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('https', () => ({
  default: { get: vi.fn() },
  get: vi.fn(),
}))

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import https from 'https'
import type { IncomingMessage } from 'http'
import { OfficialRegistryClient } from '../official-registry.client'

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

    setTimeout(() => {
      chunks.forEach((c) => dataHandler?.(c))
      endHandler?.()
    }, 0)

    callback(res)
    return { on: vi.fn() } as unknown as ReturnType<typeof https.get>
  }) as unknown as Parameters<typeof mockedGet.mockImplementation>[0])
}

const mockHttpsGetError = (errorMsg: string): void => {
  const mockedGet = vi.mocked(https.get)
  mockedGet.mockImplementation(() => {
    const req = { on: vi.fn() }
    setTimeout(() => {
      const errorCallback = req.on.mock.calls.find(([ev]) => ev === 'error')?.[1] as
        | ((err: Error) => void)
        | undefined
      errorCallback?.(new Error(errorMsg))
    }, 0)
    return req as unknown as ReturnType<typeof https.get>
  })
}

describe('OfficialRegistryClient', () => {
  let client: OfficialRegistryClient

  beforeEach(() => {
    client = new OfficialRegistryClient()
    vi.clearAllMocks()
  })

  it('maps official registry entries into RegistryServer format', async () => {
    mockHttpsGet({
      servers: [
        {
          server: {
            name: 'org/mcp-server',
            title: 'MCP Server',
            description: 'Useful server',
            remotes: [{ type: 'streamable-http', url: 'https://example.com/mcp' }],
          },
          _meta: {
            'io.modelcontextprotocol.registry/official': {
              status: 'active',
            },
          },
        },
      ],
    })

    const results = await client.searchServers('mcp')

    expect(results).toEqual([
      {
        id: 'org/mcp-server',
        displayName: 'MCP Server',
        description: 'Useful server',
        source: 'official',
        verified: true,
        remote: true,
      },
    ])
  })

  it('returns [] for empty queries without network requests', async () => {
    const results = await client.searchServers('   ')

    expect(results).toEqual([])
    expect(https.get).not.toHaveBeenCalled()
  })

  it('returns [] and does not throw when request fails', async () => {
    mockHttpsGetError('ENOTFOUND registry.modelcontextprotocol.io')

    const results = await client.searchServers('github')

    expect(results).toEqual([])
  })

  it('marks entries as local when no valid remote endpoint is present', async () => {
    mockHttpsGet({
      servers: [
        {
          server: {
            name: 'org/local-server',
            description: 'Local server',
            remotes: [{ type: 'streamable-http', url: 'notaurl' }],
          },
          _meta: {
            'io.modelcontextprotocol.registry/official': {
              status: 'inactive',
            },
          },
        },
      ],
    })

    const results = await client.searchServers('local')

    expect(results).toEqual([
      {
        id: 'org/local-server',
        displayName: 'org/local-server',
        description: 'Local server',
        source: 'official',
        verified: false,
        remote: false,
      },
    ])
  })
})
