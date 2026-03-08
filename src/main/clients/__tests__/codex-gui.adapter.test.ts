/**
 * @file src/main/clients/__tests__/codex-gui.adapter.test.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the Codex GUI adapter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
}))

vi.mock('child_process', () => ({
  execFileSync: execFileSyncMock,
}))

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
    execFileSyncMock.mockReset()
    execFileSyncMock.mockReturnValue('')

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
    execFileSyncMock.mockReturnValue('')
    const result = await codexGuiAdapter.detect()
    expect(result.installed).toBe(false)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('detects installed when AppX package is registered and healthy', async () => {
    execFileSyncMock.mockReturnValue('{"Name":"OpenAI.Codex","Status":"Ok"}')

    const result = await codexGuiAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('detects installed when GUI executable exists but config does not', async () => {
    execFileSyncMock.mockReturnValue('')
    const exePath = join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'Codex', 'Codex.exe')
    mkdirSync(join(exePath, '..'), { recursive: true })
    writeFileSync(exePath, '')

    const result = await codexGuiAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('falls back to executable detection when AppX query fails', async () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('powershell timeout')
    })

    const exePath = join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'Codex', 'Codex.exe')
    mkdirSync(join(exePath, '..'), { recursive: true })
    writeFileSync(exePath, '')

    const result = await codexGuiAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('detects config and server count from APPDATA\\Codex\\config.json', async () => {
    execFileSyncMock.mockReturnValue('')
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
