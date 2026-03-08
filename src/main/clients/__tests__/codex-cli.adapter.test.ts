/**
 * @file src/main/clients/__tests__/codex-cli.adapter.test.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the Codex CLI client adapter. Uses a temporary
 * directory as the fake USERPROFILE to avoid touching the real filesystem.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { codexCliAdapter } from '../codex-cli.adapter'

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `codex-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('codexCliAdapter', () => {
  let tmpDir: string
  let originalUserProfile: string | undefined
  let originalPath: string | undefined
  let originalPathExt: string | undefined
  let originalAppData: string | undefined
  let originalLocalAppData: string | undefined

  beforeEach(() => {
    tmpDir = makeTmpDir()

    originalUserProfile = process.env['USERPROFILE']
    originalPath = process.env['PATH']
    originalPathExt = process.env['PATHEXT']
    originalAppData = process.env['APPDATA']
    originalLocalAppData = process.env['LOCALAPPDATA']

    process.env['USERPROFILE'] = join(tmpDir, 'user')
    process.env['PATH'] = join(tmpDir, 'bin')
    process.env['PATHEXT'] = '.EXE;.CMD;.BAT'
    process.env['APPDATA'] = join(tmpDir, 'appdata')
    process.env['LOCALAPPDATA'] = join(tmpDir, 'localappdata')
  })

  afterEach(() => {
    process.env['USERPROFILE'] = originalUserProfile
    process.env['PATH'] = originalPath
    process.env['PATHEXT'] = originalPathExt
    process.env['APPDATA'] = originalAppData
    process.env['LOCALAPPDATA'] = originalLocalAppData
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reports not installed when config and executable are absent', async () => {
    const result = await codexCliAdapter.detect()
    expect(result.installed).toBe(false)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('detects installed when codex executable exists on PATH', async () => {
    const binDir = process.env['PATH'] ?? ''
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, 'codex.cmd'), '')

    const result = await codexCliAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('detects installed state from .codex/config.json', async () => {
    const codexDir = join(process.env['USERPROFILE'] ?? '', '.codex')
    mkdirSync(codexDir, { recursive: true })
    writeFileSync(
      join(codexDir, 'config.json'),
      JSON.stringify({ mcpServers: { tool: { command: 'npx', args: [] } } }),
    )

    const result = await codexCliAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toHaveLength(1)
    expect(result.serverCount).toBe(1)
  })

  it('reads mcpServers correctly', async () => {
    const codexDir = join(tmpDir, '.codex')
    const configFile = join(codexDir, 'config.json')
    mkdirSync(codexDir, { recursive: true })
    writeFileSync(
      configFile,
      JSON.stringify({ mcpServers: { myTool: { command: 'node', args: ['server.js'] } } }),
    )

    const servers = await codexCliAdapter.read(configFile)
    expect(servers['myTool']?.command).toBe('node')
  })

  it('writes servers and preserves existing top-level keys', async () => {
    const codexDir = join(tmpDir, '.codex')
    const configFile = join(codexDir, 'config.json')
    mkdirSync(codexDir, { recursive: true })
    writeFileSync(configFile, JSON.stringify({ model: 'o1' }))

    await codexCliAdapter.write(configFile, { newServer: { command: 'python', args: [] } })
    const servers = await codexCliAdapter.read(configFile)

    expect(servers['newServer']).toBeDefined()
  })
})
