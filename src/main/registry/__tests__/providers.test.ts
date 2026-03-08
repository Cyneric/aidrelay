/**
 * @file src/main/registry/__tests__/providers.test.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for registry provider routing.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../smithery.client', () => ({
  smitheryClient: {
    searchServers: vi.fn().mockResolvedValue([{ id: 'smithery-1' }]),
  },
}))

vi.mock('../official-registry.client', () => ({
  officialRegistryClient: {
    searchServers: vi.fn().mockResolvedValue([{ id: 'official-1' }]),
  },
}))

import { smitheryClient } from '../smithery.client'
import { officialRegistryClient } from '../official-registry.client'
import { searchRegistry } from '../providers'

describe('searchRegistry', () => {
  it('routes smithery provider lookups', async () => {
    await searchRegistry('smithery', 'github')

    expect(smitheryClient.searchServers).toHaveBeenCalledWith('github')
    expect(officialRegistryClient.searchServers).not.toHaveBeenCalled()
  })

  it('routes official provider lookups', async () => {
    await searchRegistry('official', 'github')

    expect(officialRegistryClient.searchServers).toHaveBeenCalledWith('github')
  })
})
