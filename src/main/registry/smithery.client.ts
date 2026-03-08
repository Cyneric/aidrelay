/**
 * @file src/main/registry/smithery.client.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description HTTP client for the Smithery MCP server registry. Searches
 * the public Smithery index and maps results to the shared `RegistryServer`
 * type. The Smithery API key is optional — browsing works without it, though
 * rate limits are tighter on unauthenticated requests.
 */

import https from 'https'
import type { IncomingMessage } from 'http'
import log from 'electron-log'
import type { RegistryServer } from '@shared/channels'
import { getSecret } from '@main/secrets/keytar.service'
import type { McpServerType } from '@shared/types'

/** Base URL for the Smithery registry REST API. */
const SMITHERY_API_BASE = 'https://registry.smithery.ai'

/** Keytar service + account used to store the optional Smithery API key. */
const SMITHERY_SERVICE = 'smithery'
const SMITHERY_ACCOUNT = 'api-key'

/** Maximum number of results to fetch per search query. */
const PAGE_SIZE = 20

// ─── Response Shape ───────────────────────────────────────────────────────────

/**
 * Shape of a single server object as returned by the Smithery API.
 * Only the fields we consume are listed; extra fields are ignored.
 */
interface SmitheryServerItem {
  qualifiedName: string
  displayName?: string
  description?: string
  isVerified?: boolean
  deploymentCount?: number
  isDeployed?: boolean
}

/**
 * Top-level shape of the Smithery servers list response.
 */
interface SmitheryListResponse {
  servers: SmitheryServerItem[]
  pagination?: { total: number; page: number; pageSize: number }
}

/**
 * Resolved install shape for native remote MCP servers.
 */
export interface RemoteInstallRecipe {
  readonly type: Extract<McpServerType, 'http' | 'sse'>
  readonly url: string
}

/**
 * Converts unknown API strings into supported remote transport values.
 */
const normalizeRemoteType = (value: unknown): RemoteInstallRecipe['type'] | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replace(/_/g, '-')
  if (normalized === 'sse') return 'sse'
  if (
    normalized === 'http' ||
    normalized === 'streamable-http' ||
    normalized === 'streamablehttp'
  ) {
    return 'http'
  }
  return null
}

/**
 * Returns a normalized URL string if valid, otherwise null.
 */
const normalizeUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Tries to build a remote install recipe from one arbitrary object node.
 */
const recipeFromNode = (node: Record<string, unknown>): RemoteInstallRecipe | null => {
  const url =
    normalizeUrl(node['url']) ??
    normalizeUrl(node['endpoint']) ??
    normalizeUrl(node['endpointUrl']) ??
    normalizeUrl(node['remoteUrl']) ??
    normalizeUrl(node['httpUrl']) ??
    normalizeUrl(node['sseUrl'])
  if (!url) return null

  const explicitType =
    normalizeRemoteType(node['type']) ??
    normalizeRemoteType(node['transport']) ??
    normalizeRemoteType(node['protocol'])

  if (explicitType) {
    return { type: explicitType, url }
  }

  if ('sseUrl' in node && normalizeUrl(node['sseUrl'])) {
    return { type: 'sse', url }
  }
  if ('httpUrl' in node && normalizeUrl(node['httpUrl'])) {
    return { type: 'http', url }
  }

  // Conservative default when the endpoint exists but transport is omitted.
  return { type: 'http', url }
}

/**
 * Extracts a remote install recipe from a Smithery detail response.
 */
const deriveRemoteInstallRecipe = (payload: unknown): RemoteInstallRecipe | null => {
  if (typeof payload !== 'object' || payload === null) return null
  const root = payload as Record<string, unknown>

  const candidateNodes: Record<string, unknown>[] = [root]

  const nestedKeys = [
    'server',
    'deployment',
    'remote',
    'connection',
    'connections',
    'endpoint',
    'endpoints',
    'transport',
    'transports',
  ]

  for (const key of nestedKeys) {
    const value = root[key]
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            candidateNodes.push(item as Record<string, unknown>)
          }
        }
      } else {
        candidateNodes.push(value as Record<string, unknown>)
      }
    }
  }

  for (const node of candidateNodes) {
    const recipe = recipeFromNode(node)
    if (recipe) return recipe
  }

  return null
}

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * Thin HTTP client for the Smithery MCP server registry.
 * Instantiate once and reuse across handler calls.
 */
export class SmitheryClient {
  /**
   * Performs a GET request and resolves with the parsed JSON response body.
   *
   * @param path    - Request path including query string (e.g. `/servers?q=github`).
   * @param apiKey  - Optional Bearer token for authenticated requests.
   * @returns Parsed JSON response, typed as `T`.
   */
  private fetch<T>(path: string, apiKey: string | null): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const url = `${SMITHERY_API_BASE}${path}`
      const options: Parameters<typeof https.get>[1] = {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'aidrelay/0.1.0',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
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
              reject(new Error(`Failed to parse Smithery response: ${String(err)}`))
            }
          })
          res.on('error', reject)
        })
        .on('error', reject)
    })
  }

  /**
   * Searches the Smithery registry for MCP servers matching the given query.
   * Returns an empty array if no API key is configured or if the request fails.
   *
   * @param query - Free-text search query (e.g. "github", "postgres").
   * @returns Array of `RegistryServer` objects sorted by Smithery's ranking.
   */
  async searchServers(query: string): Promise<RegistryServer[]> {
    const apiKey = await getSecret(SMITHERY_SERVICE, SMITHERY_ACCOUNT)

    if (!query.trim()) {
      return []
    }

    const encoded = encodeURIComponent(query.trim())
    const path = `/servers?q=${encoded}&pageSize=${PAGE_SIZE}`

    try {
      const data = await this.fetch<SmitheryListResponse>(path, apiKey)
      return (data.servers ?? []).map<RegistryServer>((item) => ({
        id: item.qualifiedName,
        displayName: item.displayName ?? item.qualifiedName,
        description: item.description ?? '',
        source: 'smithery',
        verified: item.isVerified ?? false,
        ...(item.deploymentCount !== undefined ? { useCount: item.deploymentCount } : {}),
        remote: item.isDeployed ?? false,
      }))
    } catch (err) {
      log.warn(`[smithery] search failed: ${String(err)}`)
      return []
    }
  }

  /**
   * Fetches and derives a native remote install recipe for one registry entry.
   * Returns null when the detail response has no usable remote endpoint.
   *
   * @param qualifiedName - Registry server identifier (e.g. "@anthropic/github-mcp").
   * @returns Native remote install recipe or null when unresolved.
   */
  async getRemoteInstallRecipe(qualifiedName: string): Promise<RemoteInstallRecipe | null> {
    const apiKey = await getSecret(SMITHERY_SERVICE, SMITHERY_ACCOUNT)
    const encoded = encodeURIComponent(qualifiedName.trim())
    if (!encoded) return null

    try {
      const details = await this.fetch<unknown>(`/servers/${encoded}`, apiKey)
      return deriveRemoteInstallRecipe(details)
    } catch (err) {
      log.warn(`[smithery] details lookup failed for "${qualifiedName}": ${String(err)}`)
      return null
    }
  }
}

/** Shared singleton used by the registry IPC handler. */
export const smitheryClient = new SmitheryClient()
