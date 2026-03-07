/**
 * @file src/main/clients/__tests__/codex-cli.adapter.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
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

  beforeEach(() => {
    tmpDir = makeTmpDir()
    originalUserProfile = process.env['USERPROFILE']
    process.env['USERPROFILE'] = tmpDir
  })

  afterEach(() => {
    process.env['USERPROFILE'] = originalUserProfile
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reports not installed when config is absent', async () => {
    const result = await codexCliAdapter.detect()
    expect(result.installed).toBe(false)
    expect(result.configPaths).toHaveLength(0)
  })

  it('detects installed state from .codex/config.json', async () => {
    const codexDir = join(tmpDir, '.codex')
    mkdirSync(codexDir, { recursive: true })
    writeFileSync(
      join(codexDir, 'config.json'),
      JSON.stringify({ mcpServers: { tool: { command: 'npx', args: [] } } }),
    )

    const result = await codexCliAdapter.detect()
    expect(result.installed).toBe(true)
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
