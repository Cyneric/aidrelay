/**
 * @file src/main/registry/providers.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Registry provider routing for search requests.
 */

import type { RegistryProvider, RegistryServer } from '@shared/channels'
import { smitheryClient } from './smithery.client'
import { officialRegistryClient } from './official-registry.client'

type Searcher = (query: string) => Promise<RegistryServer[]>

const searchers: Record<RegistryProvider, Searcher> = {
  smithery: (query: string) => smitheryClient.searchServers(query),
  official: (query: string) => officialRegistryClient.searchServers(query),
}

export const searchRegistry = (
  provider: RegistryProvider,
  query: string,
): Promise<RegistryServer[]> => {
  const searcher = searchers[provider] ?? searchers.smithery
  return searcher(query)
}
