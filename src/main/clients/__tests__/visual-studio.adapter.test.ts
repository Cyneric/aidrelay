/**
 * @file src/main/clients/__tests__/visual-studio.adapter.test.ts
 *
 * @description Unit tests for the Visual Studio adapter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const { configuredPathValue } = vi.hoisted(() => ({
  configuredPathValue: { current: null as string | null },
}))

vi.mock('@main/db/connection', () => ({
  getDatabase: () => ({}),
}))

vi.mock('@main/db/settings.repo', () => ({
  SettingsRepo: class {
    get(): string | null {
      return configuredPathValue.current
    }
  },
}))

import { visualStudioAdapter } from '../visual-studio.adapter'

const makeTmpDir = (): string => {
  const dir = join(
    tmpdir(),
    `aidrelay-vs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('visualStudioAdapter', () => {
  let tmpDir: string
  let originalAppData: string | undefined
  let originalProgramFiles: string | undefined
  let originalProgramFilesX86: string | undefined

  beforeEach(() => {
    tmpDir = makeTmpDir()
    configuredPathValue.current = null
    originalAppData = process.env['APPDATA']
    originalProgramFiles = process.env['ProgramFiles']
    originalProgramFilesX86 = process.env['ProgramFiles(x86)']

    process.env['APPDATA'] = join(tmpDir, 'appdata')
    process.env['ProgramFiles'] = join(tmpDir, 'programfiles')
    process.env['ProgramFiles(x86)'] = join(tmpDir, 'programfiles-x86')
  })

  afterEach(() => {
    process.env['APPDATA'] = originalAppData
    process.env['ProgramFiles'] = originalProgramFiles
    process.env['ProgramFiles(x86)'] = originalProgramFilesX86
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('uses servers schema key', () => {
    expect(visualStudioAdapter.schemaKey).toBe('servers')
  })

  it('detects configured config path and counts servers', async () => {
    const configuredPath = join(tmpDir, 'custom', 'mcp.json')
    mkdirSync(join(configuredPath, '..'), { recursive: true })
    writeFileSync(configuredPath, JSON.stringify({ servers: { one: { command: 'node' } } }))
    configuredPathValue.current = configuredPath

    const result = await visualStudioAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toContain(configuredPath)
    expect(result.serverCount).toBe(1)
  })

  it('detects installed when devenv executable exists', async () => {
    const exe = join(
      process.env['ProgramFiles'] ?? '',
      'Microsoft Visual Studio',
      '2022',
      'Community',
      'Common7',
      'IDE',
      'devenv.exe',
    )
    mkdirSync(join(exe, '..'), { recursive: true })
    writeFileSync(exe, '')

    const result = await visualStudioAdapter.detect()
    expect(result.installed).toBe(true)
  })

  it('writes and reads servers config', async () => {
    const configPath = join(tmpDir, 'vs', 'mcp.json')
    mkdirSync(join(configPath, '..'), { recursive: true })
    writeFileSync(configPath, JSON.stringify({ keep: true }))

    await visualStudioAdapter.write(configPath, { myServer: { command: 'node' } })
    const written = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
    expect(written['servers']).toEqual({ myServer: { command: 'node' } })
    expect(written['keep']).toBe(true)

    const read = await visualStudioAdapter.read(configPath)
    expect(read).toEqual({ myServer: { command: 'node' } })
  })
})
