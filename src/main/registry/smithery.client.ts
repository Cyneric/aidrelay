/**
 * @file src/main/registry/smithery.client.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
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
}

/** Shared singleton used by the registry IPC handler. */
export const smitheryClient = new SmitheryClient()
