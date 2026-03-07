/**
 * @file src/main/clients/__tests__/claude-desktop.adapter.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the Claude Desktop client adapter. Uses real temp
 * directories so the actual filesystem code paths are exercised. Environment
 * variables are overridden in beforeEach to point at the temp dirs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { claudeDesktopAdapter } from '../claude-desktop.adapter'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a unique temp directory for each test run. */
const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `aidrelay-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

const SAMPLE_CONFIG = JSON.stringify({ mcpServers: { 'some-server': { command: 'npx' } } })

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('claudeDesktopAdapter', () => {
  let tmpDir: string
  let originalAppData: string | undefined
  let originalLocalAppData: string | undefined

  beforeEach(() => {
    tmpDir = makeTmpDir()
    originalAppData = process.env['APPDATA']
    originalLocalAppData = process.env['LOCALAPPDATA']
    // Point both APPDATA and LOCALAPPDATA at our temp dir so the adapter's
    // primary path AND the MSIX Packages scan both stay inside it.
    process.env['APPDATA'] = tmpDir
    process.env['LOCALAPPDATA'] = tmpDir
  })

  afterEach(() => {
    process.env['APPDATA'] = originalAppData
    process.env['LOCALAPPDATA'] = originalLocalAppData
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // ─── detect ─────────────────────────────────────────────────────────────────

  describe('detect()', () => {
    it('returns installed=false when no config file exists', async () => {
      const result = await claudeDesktopAdapter.detect()
      expect(result.installed).toBe(false)
      expect(result.configPaths).toHaveLength(0)
      expect(result.serverCount).toBe(0)
    })

    it('detects the primary config when it exists', async () => {
      const configDir = join(tmpDir, 'Claude')
      mkdirSync(configDir, { recursive: true })
      writeFileSync(join(configDir, 'claude_desktop_config.json'), SAMPLE_CONFIG)

      const result = await claudeDesktopAdapter.detect()
      expect(result.installed).toBe(true)
      expect(result.configPaths).toHaveLength(1)
      expect(result.serverCount).toBe(1)
    })
  })

  // ─── read ───────────────────────────────────────────────────────────────────

  describe('read()', () => {
    it('returns an empty object when the file does not exist', async () => {
      const result = await claudeDesktopAdapter.read(join(tmpDir, 'missing.json'))
      expect(result).toEqual({})
    })

    it('reads and returns the mcpServers map', async () => {
      const configPath = join(tmpDir, 'config.json')
      writeFileSync(
        configPath,
        JSON.stringify({ mcpServers: { server1: { command: 'npx', args: ['-y', 'pkg'] } } }),
      )

      const result = await claudeDesktopAdapter.read(configPath)
      expect(result).toEqual({ server1: { command: 'npx', args: ['-y', 'pkg'] } })
    })

    it('returns an empty object when mcpServers key is absent', async () => {
      const configPath = join(tmpDir, 'config.json')
      writeFileSync(configPath, JSON.stringify({ globalShortcut: 'F1' }))

      const result = await claudeDesktopAdapter.read(configPath)
      expect(result).toEqual({})
    })
  })

  // ─── write ──────────────────────────────────────────────────────────────────

  describe('write()', () => {
    it('creates the config file with the given servers', async () => {
      const configPath = join(tmpDir, 'claude', 'config.json')
      const servers = { 'my-server': { command: 'node', args: ['index.js'] } }

      await claudeDesktopAdapter.write(configPath, servers)

      expect(existsSync(configPath)).toBe(true)
    })

    it('merges servers into an existing config without losing other keys', async () => {
      const configPath = join(tmpDir, 'claude_desktop_config.json')
      writeFileSync(configPath, JSON.stringify({ globalShortcut: 'Ctrl+K', mcpServers: {} }))

      const servers = { 'new-server': { command: 'npx' } }
      await claudeDesktopAdapter.write(configPath, servers)

      const { readFileSync } = await import('fs')
      const written = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
      expect(written['globalShortcut']).toBe('Ctrl+K')
      expect(written['mcpServers']).toEqual(servers)
    })

    it('leaves no .aidrelay.tmp file after a successful write', async () => {
      const configPath = join(tmpDir, 'config.json')
      await claudeDesktopAdapter.write(configPath, {})
      expect(existsSync(`${configPath}.aidrelay.tmp`)).toBe(false)
    })
  })

  // ─── validate ───────────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('returns valid=false when the file does not exist', async () => {
      const result = await claudeDesktopAdapter.validate(join(tmpDir, 'missing.json'))
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('returns valid=true for a well-formed config', async () => {
      const configPath = join(tmpDir, 'config.json')
      writeFileSync(configPath, JSON.stringify({ mcpServers: {} }))

      const result = await claudeDesktopAdapter.validate(configPath)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid=false for a malformed JSON file', async () => {
      const configPath = join(tmpDir, 'config.json')
      writeFileSync(configPath, '{ not valid json }')

      const result = await claudeDesktopAdapter.validate(configPath)
      expect(result.valid).toBe(false)
    })
  })
})
