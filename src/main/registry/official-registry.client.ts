/**
 * @file src/main/registry/official-registry.client.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description HTTP client for the official MCP registry
 * (`registry.modelcontextprotocol.io`).
 */

import https from 'https'
import type { IncomingMessage } from 'http'
import log from 'electron-log'
import type { RegistryServer } from '@shared/channels'

const OFFICIAL_REGISTRY_BASE = 'https://registry.modelcontextprotocol.io'
const PAGE_SIZE = 20

interface OfficialRemote {
  url?: string
}

interface OfficialServer {
  name?: string
  title?: string
  description?: string
  remotes?: OfficialRemote[]
}

interface OfficialRegistryEntry {
  server?: OfficialServer
  _meta?: {
    'io.modelcontextprotocol.registry/official'?: {
      status?: string
    }
  }
}

interface OfficialListResponse {
  servers?: OfficialRegistryEntry[]
}

const isHttpUrl = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.trim().length === 0) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const hasRemoteEndpoint = (server: OfficialServer): boolean =>
  Array.isArray(server.remotes) && server.remotes.some((remote) => isHttpUrl(remote.url))

export class OfficialRegistryClient {
  private fetch<T>(path: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const url = `${OFFICIAL_REGISTRY_BASE}${path}`
      const options: Parameters<typeof https.get>[1] = {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'aidrelay/0.1.0',
        },
      }

      https
        .get(url, options, (res: IncomingMessage) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('end', () => {
            try {
              const body = Buffer.concat(chunks).toString('utf8')
              resolve(JSON.parse(body) as T)
            } catch (err) {
              reject(new Error(`Failed to parse official registry response: ${String(err)}`))
            }
          })
          res.on('error', reject)
        })
        .on('error', reject)
    })
  }

  async searchServers(query: string): Promise<RegistryServer[]> {
    if (!query.trim()) {
      return []
    }

    const encoded = encodeURIComponent(query.trim())
    const path = `/v0/servers?search=${encoded}&limit=${PAGE_SIZE}`

    try {
      const data = await this.fetch<OfficialListResponse>(path)
      const entries = Array.isArray(data.servers) ? data.servers : []

      return entries
        .map<RegistryServer | null>((entry) => {
          const server = entry.server
          const name = server?.name?.trim()
          if (!server || !name) return null

          const officialStatus =
            entry._meta?.['io.modelcontextprotocol.registry/official']?.status?.toLowerCase() ?? ''

          return {
            id: name,
            displayName: server.title?.trim() || name,
            description: server.description?.trim() ?? '',
            source: 'official',
            verified: officialStatus === 'active',
            remote: hasRemoteEndpoint(server),
          }
        })
        .filter((server): server is RegistryServer => server !== null)
    } catch (err) {
      log.warn(`[official-registry] search failed: ${String(err)}`)
      return []
    }
  }
}

export const officialRegistryClient = new OfficialRegistryClient()
