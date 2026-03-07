/**
 * @file src/main/clients/__tests__/cursor.adapter.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the Cursor IDE client adapter.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { cursorAdapter } from '../cursor.adapter'

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `aidrelay-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('cursorAdapter', () => {
  let tmpDir: string
  let originalUserProfile: string | undefined

  beforeEach(() => {
    tmpDir = makeTmpDir()
    originalUserProfile = process.env['USERPROFILE']
    process.env['USERPROFILE'] = tmpDir
  })

  afterEach(() => {
    process.env['USERPROFILE'] = originalUserProfile
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('detect()', () => {
    it('returns installed=false when no config exists', async () => {
      const result = await cursorAdapter.detect()
      expect(result.installed).toBe(false)
      expect(result.configPaths).toHaveLength(0)
    })

    it('detects the config when it exists', async () => {
      const cursorDir = join(tmpDir, '.cursor')
      mkdirSync(cursorDir, { recursive: true })
      writeFileSync(
        join(cursorDir, 'mcp.json'),
        JSON.stringify({ mcpServers: { s1: { command: 'npx' }, s2: { command: 'node' } } }),
      )

      const result = await cursorAdapter.detect()
      expect(result.installed).toBe(true)
      expect(result.configPaths).toHaveLength(1)
      expect(result.serverCount).toBe(2)
    })
  })

  describe('read()', () => {
    it('returns empty for a missing file', async () => {
      expect(await cursorAdapter.read(join(tmpDir, 'nope.json'))).toEqual({})
    })

    it('reads the mcpServers map', async () => {
      const configPath = join(tmpDir, 'mcp.json')
      writeFileSync(configPath, JSON.stringify({ mcpServers: { s1: { command: 'npx' } } }))
      expect(await cursorAdapter.read(configPath)).toEqual({ s1: { command: 'npx' } })
    })
  })

  describe('write()', () => {
    it('writes servers and preserves other keys', async () => {
      const configPath = join(tmpDir, 'mcp.json')
      writeFileSync(configPath, JSON.stringify({ otherKey: true, mcpServers: {} }))

      await cursorAdapter.write(configPath, { srv: { command: 'node' } })

      const { readFileSync } = await import('fs')
      const result = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
      expect(result['otherKey']).toBe(true)
      expect(result['mcpServers']).toEqual({ srv: { command: 'node' } })
    })

    it('creates parent directories if needed', async () => {
      const configPath = join(tmpDir, 'nested', 'dir', 'mcp.json')
      await cursorAdapter.write(configPath, {})
      expect(existsSync(configPath)).toBe(true)
    })
  })

  describe('validate()', () => {
    it('returns valid=false for a missing file', async () => {
      const result = await cursorAdapter.validate(join(tmpDir, 'gone.json'))
      expect(result.valid).toBe(false)
    })

    it('returns valid=true for a well-formed config', async () => {
      const configPath = join(tmpDir, 'mcp.json')
      writeFileSync(configPath, JSON.stringify({ mcpServers: { s: { command: 'npx' } } }))
      const result = await cursorAdapter.validate(configPath)
      expect(result.valid).toBe(true)
    })
  })
})
