/**
 * @file src/main/clients/__tests__/windsurf.adapter.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the Windsurf client adapter. Uses a temporary
 * directory as the fake USERPROFILE to avoid touching the real filesystem.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { windsurfAdapter } from '../windsurf.adapter'

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `windsurf-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('windsurfAdapter', () => {
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

  it('reports not installed when config file is absent', async () => {
    const result = await windsurfAdapter.detect()
    expect(result.installed).toBe(false)
    expect(result.configPaths).toHaveLength(0)
  })

  it('reports installed with server count when config exists', async () => {
    const configDir = join(tmpDir, '.codeium', 'windsurf')
    mkdirSync(configDir, { recursive: true })
    writeFileSync(
      join(configDir, 'mcp_config.json'),
      JSON.stringify({ mcpServers: { alpha: { command: 'npx', args: [] } } }),
    )

    const result = await windsurfAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.serverCount).toBe(1)
  })

  it('reads mcpServers correctly', async () => {
    const configDir = join(tmpDir, '.codeium', 'windsurf')
    const configFile = join(configDir, 'mcp_config.json')
    mkdirSync(configDir, { recursive: true })
    writeFileSync(
      configFile,
      JSON.stringify({ mcpServers: { beta: { command: 'node', args: [] } } }),
    )

    const servers = await windsurfAdapter.read(configFile)
    expect(servers['beta']).toBeDefined()
    expect(servers['beta']?.command).toBe('node')
  })

  it('writes servers atomically and merges with existing config', async () => {
    const configDir = join(tmpDir, '.codeium', 'windsurf')
    const configFile = join(configDir, 'mcp_config.json')
    mkdirSync(configDir, { recursive: true })
    writeFileSync(configFile, JSON.stringify({ someOtherKey: true }))

    await windsurfAdapter.write(configFile, { myServer: { command: 'npx', args: ['-y', 'pkg'] } })

    const result = await windsurfAdapter.read(configFile)
    expect(result['myServer']).toBeDefined()
  })
})
