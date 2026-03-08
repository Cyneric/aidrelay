/**
 * @file src/main/clients/__tests__/codex-gui.adapter.test.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the Codex GUI adapter.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { codexGuiAdapter } from '../codex-gui.adapter'

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `codex-gui-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('codexGuiAdapter', () => {
  let tmpDir: string
  let originalAppData: string | undefined
  let originalLocalAppData: string | undefined
  let originalProgramFiles: string | undefined
  let originalProgramFilesX86: string | undefined

  beforeEach(() => {
    tmpDir = makeTmpDir()

    originalAppData = process.env['APPDATA']
    originalLocalAppData = process.env['LOCALAPPDATA']
    originalProgramFiles = process.env['ProgramFiles']
    originalProgramFilesX86 = process.env['ProgramFiles(x86)']

    process.env['APPDATA'] = join(tmpDir, 'appdata')
    process.env['LOCALAPPDATA'] = join(tmpDir, 'localappdata')
    process.env['ProgramFiles'] = join(tmpDir, 'programfiles')
    process.env['ProgramFiles(x86)'] = join(tmpDir, 'programfiles-x86')
  })

  afterEach(() => {
    process.env['APPDATA'] = originalAppData
    process.env['LOCALAPPDATA'] = originalLocalAppData
    process.env['ProgramFiles'] = originalProgramFiles
    process.env['ProgramFiles(x86)'] = originalProgramFilesX86
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reports not installed when config and executable are absent', async () => {
    const result = await codexGuiAdapter.detect()
    expect(result.installed).toBe(false)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('detects installed when GUI executable exists but config does not', async () => {
    const exePath = join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'Codex', 'Codex.exe')
    mkdirSync(join(exePath, '..'), { recursive: true })
    writeFileSync(exePath, '')

    const result = await codexGuiAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('detects config and server count from APPDATA\\Codex\\config.json', async () => {
    const configDir = join(process.env['APPDATA'] ?? '', 'Codex')
    mkdirSync(configDir, { recursive: true })
    const configPath = join(configDir, 'config.json')
    writeFileSync(configPath, JSON.stringify({ mcpServers: { guiServer: { command: 'node' } } }))

    const result = await codexGuiAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toEqual([configPath])
    expect(result.serverCount).toBe(1)
  })
})
