/**
 * @file src/main/sync/__tests__/diff.helper.test.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for computeSyncPreviewItems.
 */

import { describe, expect, it } from 'vitest'
import { computeSyncPreviewItems } from '../diff.helper'
import type { McpServerConfig, McpServerMap } from '@shared/types'

const stdioConfig = (command: string): McpServerConfig => ({
  command,
  args: [],
})

describe('computeSyncPreviewItems', () => {
  it('returns empty array for empty maps', () => {
    const existing: McpServerMap = {}
    const merged: McpServerMap = {}
    const managed = new Set<string>()
    const result = computeSyncPreviewItems(existing, merged, managed, new Set<string>())
    expect(result).toEqual([])
  })

  it('detects create for new managed server', () => {
    const existing: McpServerMap = {}
    const merged: McpServerMap = { 'new-server': stdioConfig('cmd') }
    const managed = new Set<string>(['new-server'])
    const result = computeSyncPreviewItems(existing, merged, managed, new Set<string>())
    expect(result).toHaveLength(1)
    expect(result[0]!).toMatchObject({
      name: 'new-server',
      action: 'create',
      before: null,
      after: stdioConfig('cmd'),
    })
  })

  it('detects overwrite when config differs for managed server', () => {
    const existing: McpServerMap = { server: stdioConfig('old') }
    const merged: McpServerMap = { server: stdioConfig('new') }
    const managed = new Set<string>(['server'])
    const result = computeSyncPreviewItems(existing, merged, managed, new Set<string>())
    expect(result).toHaveLength(1)
    expect(result[0]!.action).toBe('overwrite')
  })

  it('detects no‑op when config identical for managed server', () => {
    const config = stdioConfig('same')
    const existing: McpServerMap = { server: config }
    const merged: McpServerMap = { server: config }
    const managed = new Set<string>(['server'])
    const result = computeSyncPreviewItems(existing, merged, managed, new Set<string>())
    expect(result).toHaveLength(1)
    expect(result[0]!.action).toBe('no-op')
  })

  it('detects preserved_unmanaged when config identical and not managed', () => {
    const config = stdioConfig('external')
    const existing: McpServerMap = { external: config }
    const merged: McpServerMap = { external: config }
    const managed = new Set<string>()
    const result = computeSyncPreviewItems(existing, merged, managed, new Set<string>())
    expect(result).toHaveLength(1)
    expect(result[0]!.action).toBe('preserved_unmanaged')
  })

  it('detects removed when server disappears from merged (managed)', () => {
    const existing: McpServerMap = { old: stdioConfig('cmd') }
    const merged: McpServerMap = {}
    const managed = new Set<string>(['old'])
    const result = computeSyncPreviewItems(existing, merged, managed, new Set<string>())
    expect(result).toHaveLength(1)
    expect(result[0]!.action).toBe('removed')
  })

  it('preserves unmanaged server that disappears from merged (no action)', () => {
    const existing: McpServerMap = { external: stdioConfig('cmd') }
    const merged: McpServerMap = {}
    const managed = new Set<string>()
    const result = computeSyncPreviewItems(existing, merged, managed, new Set<string>())
    expect(result).toHaveLength(1)
    expect(result[0]!.action).toBe('removed')
  })

  it('sorts items by name', () => {
    const existing: McpServerMap = { zebra: stdioConfig('cmd'), apple: stdioConfig('cmd') }
    const merged: McpServerMap = { apple: stdioConfig('cmd'), zebra: stdioConfig('cmd') }
    const managed = new Set<string>(['apple', 'zebra'])
    const result = computeSyncPreviewItems(existing, merged, managed, new Set<string>())
    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('apple')
    expect(result[1]!.name).toBe('zebra')
  })

  it('handles mixed managed and unmanaged servers', () => {
    const existing: McpServerMap = {
      managed: stdioConfig('old'),
      unmanaged: stdioConfig('external'),
    }
    const merged: McpServerMap = {
      managed: stdioConfig('new'),
      unmanaged: stdioConfig('external'),
    }
    const managed = new Set<string>(['managed'])
    const result = computeSyncPreviewItems(existing, merged, managed, new Set<string>())
    expect(result).toHaveLength(2)
    const managedItem = result.find((item) => item.name === 'managed')
    const unmanagedItem = result.find((item) => item.name === 'unmanaged')
    expect(managedItem?.action).toBe('overwrite')
    expect(unmanagedItem?.action).toBe('preserved_unmanaged')
  })

  it('detects ignored when config is identical and server is ignored for the client', () => {
    const config = stdioConfig('same')
    const existing: McpServerMap = { server: config }
    const merged: McpServerMap = { server: config }
    const managed = new Set<string>(['server'])
    const ignored = new Set<string>(['server'])
    const result = computeSyncPreviewItems(existing, merged, managed, ignored)
    expect(result).toHaveLength(1)
    expect(result[0]!.action).toBe('ignored')
  })
})
