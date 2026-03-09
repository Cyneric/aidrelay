/**
 * @file src/main/clients/__tests__/vscode.adapter.test.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the VS Code client adapter. Specifically validates
 * that the adapter uses the `servers` key, not `mcpServers`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { vscodeAdapter } from '../vscode.adapter'

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `aidrelay-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('vscodeAdapter', () => {
  let tmpDir: string
  let originalAppData: string | undefined
  let originalLocalAppData: string | undefined
  let originalProgramFiles: string | undefined
  let originalProgramFilesX86: string | undefined
  let originalPath: string | undefined
  let originalPathExt: string | undefined

  beforeEach(() => {
    tmpDir = makeTmpDir()
    originalAppData = process.env['APPDATA']
    originalLocalAppData = process.env['LOCALAPPDATA']
    originalProgramFiles = process.env['ProgramFiles']
    originalProgramFilesX86 = process.env['ProgramFiles(x86)']
    originalPath = process.env['PATH']
    originalPathExt = process.env['PATHEXT']

    process.env['APPDATA'] = join(tmpDir, 'appdata')
    process.env['LOCALAPPDATA'] = join(tmpDir, 'localappdata')
    process.env['ProgramFiles'] = join(tmpDir, 'programfiles')
    process.env['ProgramFiles(x86)'] = join(tmpDir, 'programfiles-x86')
    process.env['PATH'] = join(tmpDir, 'bin')
    process.env['PATHEXT'] = '.EXE;.CMD;.BAT'
  })

  afterEach(() => {
    process.env['APPDATA'] = originalAppData
    process.env['LOCALAPPDATA'] = originalLocalAppData
    process.env['ProgramFiles'] = originalProgramFiles
    process.env['ProgramFiles(x86)'] = originalProgramFilesX86
    process.env['PATH'] = originalPath
    process.env['PATHEXT'] = originalPathExt
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('adapter metadata', () => {
    it('uses the servers schema key (not mcpServers)', () => {
      expect(vscodeAdapter.schemaKey).toBe('servers')
    })

    it('has the correct id', () => {
      expect(vscodeAdapter.id).toBe('vscode')
    })
  })

  describe('detect()', () => {
    it('returns installed=false when neither config nor executable exists', async () => {
      const result = await vscodeAdapter.detect()
      expect(result.installed).toBe(false)
      expect(result.configPaths).toHaveLength(0)
      expect(result.serverCount).toBe(0)
    })

    it('detects installed=true when executable exists but config does not', async () => {
      const exePath = join(
        process.env['LOCALAPPDATA'] ?? '',
        'Programs',
        'Microsoft VS Code',
        'Code.exe',
      )
      mkdirSync(join(exePath, '..'), { recursive: true })
      writeFileSync(exePath, '')

      const result = await vscodeAdapter.detect()
      expect(result.installed).toBe(true)
      expect(result.configPaths).toHaveLength(0)
      expect(result.serverCount).toBe(0)
    })

    it('detects the config when it exists under Code/User/mcp.json', async () => {
      const configDir = join(process.env['APPDATA'] ?? '', 'Code', 'User')
      mkdirSync(configDir, { recursive: true })
      writeFileSync(
        join(configDir, 'mcp.json'),
        JSON.stringify({ servers: { myServer: { command: 'node' } } }),
      )

      const result = await vscodeAdapter.detect()
      expect(result.installed).toBe(true)
      expect(result.configPaths).toHaveLength(1)
      expect(result.serverCount).toBe(1)
    })

    it('detects installed via code launcher on PATH when fixed install paths are absent', async () => {
      const binDir = join(tmpDir, 'bin with spaces')
      mkdirSync(binDir, { recursive: true })
      writeFileSync(join(binDir, 'code.cmd'), '')
      process.env['PATH'] = `"${binDir}"`

      const result = await vscodeAdapter.detect()
      expect(result.installed).toBe(true)
      expect(result.configPaths).toHaveLength(0)
      expect(result.serverCount).toBe(0)
    })
  })

  describe('read()', () => {
    it('reads servers from the `servers` key', async () => {
      const configPath = join(tmpDir, 'mcp.json')
      writeFileSync(
        configPath,
        JSON.stringify({ servers: { myServer: { command: 'node', args: ['./index.js'] } } }),
      )

      const result = await vscodeAdapter.read(configPath)
      expect(result).toEqual({ myServer: { command: 'node', args: ['./index.js'] } })
    })

    it('does NOT read from mcpServers key', async () => {
      const configPath = join(tmpDir, 'mcp.json')
      writeFileSync(configPath, JSON.stringify({ mcpServers: { s: { command: 'npx' } } }))

      const result = await vscodeAdapter.read(configPath)
      expect(result).toEqual({})
    })
  })

  describe('write()', () => {
    it('writes under the `servers` key, not `mcpServers`', async () => {
      const configPath = join(tmpDir, 'mcp.json')
      await vscodeAdapter.write(configPath, { s1: { command: 'node' } })

      const written = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
      expect(written['servers']).toEqual({ s1: { command: 'node' } })
      expect(written['mcpServers']).toBeUndefined()
    })

    it('preserves non-server keys in the config', async () => {
      const configPath = join(tmpDir, 'mcp.json')
      writeFileSync(configPath, JSON.stringify({ inputs: [], servers: {} }))

      await vscodeAdapter.write(configPath, { s1: { command: 'node' } })

      const written = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
      expect(written['inputs']).toEqual([])
    })

    it('creates parent directories automatically', async () => {
      const configPath = join(tmpDir, 'Code', 'User', 'mcp.json')
      await vscodeAdapter.write(configPath, {})
      expect(existsSync(configPath)).toBe(true)
    })
  })

  describe('validate()', () => {
    it('returns valid=false for a missing file', async () => {
      expect((await vscodeAdapter.validate(join(tmpDir, 'nope.json'))).valid).toBe(false)
    })

    it('returns valid=true for a correct config', async () => {
      const configPath = join(tmpDir, 'mcp.json')
      writeFileSync(configPath, JSON.stringify({ servers: {} }))
      expect((await vscodeAdapter.validate(configPath)).valid).toBe(true)
    })

    it('returns valid=false for invalid JSON', async () => {
      const configPath = join(tmpDir, 'mcp.json')
      writeFileSync(configPath, 'not json')
      expect((await vscodeAdapter.validate(configPath)).valid).toBe(false)
    })
  })
})
