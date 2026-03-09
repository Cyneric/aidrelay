/**
 * @file src/main/clients/__tests__/vscode-insiders.adapter.test.ts
 *
 * @description Unit tests for the VS Code Insiders adapter.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { vscodeInsidersAdapter } from '../vscode-insiders.adapter'

const makeTmpDir = (): string => {
  const dir = join(
    tmpdir(),
    `aidrelay-vscode-insiders-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('vscodeInsidersAdapter', () => {
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

  it('uses the servers schema key', () => {
    expect(vscodeInsidersAdapter.schemaKey).toBe('servers')
  })

  it('detects installed=false when config and executable are absent', async () => {
    const result = await vscodeInsidersAdapter.detect()
    expect(result.installed).toBe(false)
    expect(result.configPaths).toEqual([])
    expect(result.serverCount).toBe(0)
  })

  it('detects installed=true when insiders executable exists', async () => {
    const exePath = join(
      process.env['LOCALAPPDATA'] ?? '',
      'Programs',
      'Microsoft VS Code Insiders',
      'Code - Insiders.exe',
    )
    mkdirSync(join(exePath, '..'), { recursive: true })
    writeFileSync(exePath, '')

    const result = await vscodeInsidersAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toEqual([])
  })

  it('detects installed via code-insiders launcher on PATH when fixed install paths are absent', async () => {
    const binDir = join(tmpDir, 'bin with spaces')
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, 'code-insiders.cmd'), '')
    process.env['PATH'] = `"${binDir}"`

    const result = await vscodeInsidersAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toEqual([])
    expect(result.serverCount).toBe(0)
  })

  it('reads and writes servers under the servers key', async () => {
    const configPath = join(tmpDir, 'mcp.json')
    await vscodeInsidersAdapter.write(configPath, { s1: { command: 'node' } })

    const written = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
    expect(written['servers']).toEqual({ s1: { command: 'node' } })
    expect(written['mcpServers']).toBeUndefined()

    const read = await vscodeInsidersAdapter.read(configPath)
    expect(read).toEqual({ s1: { command: 'node' } })
  })

  it('creates parent directories automatically when writing', async () => {
    const configPath = join(tmpDir, 'Code - Insiders', 'User', 'mcp.json')
    await vscodeInsidersAdapter.write(configPath, {})
    expect(existsSync(configPath)).toBe(true)
  })
})
