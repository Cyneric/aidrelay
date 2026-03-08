/**
 * @file src/main/clients/__tests__/opencode.adapter.test.ts
 *
 * @description Unit tests for the OpenCode adapter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('@main/rules/workspace-detector', () => ({
  detectRecentWorkspaces: () => ['C:\\ws\\one', 'C:\\ws\\two'],
}))

import { opencodeAdapter } from '../opencode.adapter'

const makeTmpDir = (): string => {
  const dir = join(
    tmpdir(),
    `aidrelay-opencode-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('opencodeAdapter', () => {
  let tmpDir: string
  let originalUserProfile: string | undefined
  let originalHome: string | undefined
  let originalPath: string | undefined
  let originalPathExt: string | undefined

  beforeEach(() => {
    tmpDir = makeTmpDir()
    originalUserProfile = process.env['USERPROFILE']
    originalHome = process.env['HOME']
    originalPath = process.env['PATH']
    originalPathExt = process.env['PATHEXT']

    process.env['USERPROFILE'] = join(tmpDir, 'user')
    process.env['HOME'] = join(tmpDir, 'home')
    process.env['PATH'] = join(tmpDir, 'bin')
    process.env['PATHEXT'] = '.EXE;.CMD;.BAT'
  })

  afterEach(() => {
    process.env['USERPROFILE'] = originalUserProfile
    process.env['HOME'] = originalHome
    process.env['PATH'] = originalPath
    process.env['PATHEXT'] = originalPathExt
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('uses mcp schema key', () => {
    expect(opencodeAdapter.schemaKey).toBe('mcp')
  })

  it('detects global config and counts mcp servers', async () => {
    const globalPath = join(
      process.env['USERPROFILE'] ?? '',
      '.config',
      'opencode',
      'opencode.json',
    )
    mkdirSync(join(globalPath, '..'), { recursive: true })
    writeFileSync(globalPath, JSON.stringify({ mcp: { a: { command: 'node' } } }))

    const result = await opencodeAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toContain(globalPath)
    expect(result.serverCount).toBe(1)
  })

  it('detects installed via PATH when no config exists', async () => {
    const binDir = process.env['PATH'] ?? ''
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, 'opencode.cmd'), '')

    const result = await opencodeAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toEqual([])
  })

  it('reads and writes mcp section', async () => {
    const configPath = join(tmpDir, 'opencode.json')
    writeFileSync(configPath, JSON.stringify({ other: true }))

    await opencodeAdapter.write(configPath, { myServer: { command: 'npx' } })
    const written = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
    expect(written['mcp']).toEqual({ myServer: { command: 'npx' } })
    expect(written['other']).toBe(true)

    const read = await opencodeAdapter.read(configPath)
    expect(read).toEqual({ myServer: { command: 'npx' } })
  })
})
