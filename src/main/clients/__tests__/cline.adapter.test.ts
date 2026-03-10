/**
 * @file src/main/clients/__tests__/cline.adapter.test.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the Cline client adapter.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import { clineAdapter } from '../cline.adapter'

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `cline-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('clineAdapter', () => {
  let tmpDir: string
  let originalAppData: string | undefined

  beforeEach(() => {
    tmpDir = makeTmpDir()
    originalAppData = process.env['APPDATA']
    process.env['APPDATA'] = join(tmpDir, 'appdata')
  })

  afterEach(() => {
    process.env['APPDATA'] = originalAppData
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reports not installed when config and storage are absent', async () => {
    const result = await clineAdapter.detect()
    expect(result.installed).toBe(false)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('detects installed from cline_mcp_settings.json in globalStorage', async () => {
    const configFile = join(
      process.env['APPDATA'] ?? '',
      'Code',
      'User',
      'globalStorage',
      'saoudrizwan.claude-dev',
      'settings',
      'cline_mcp_settings.json',
    )
    mkdirSync(dirname(configFile), { recursive: true })
    writeFileSync(configFile, JSON.stringify({ mcpServers: { tool: { command: 'node' } } }))

    const result = await clineAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toContain(configFile)
    expect(result.serverCount).toBe(1)
  })

  it('reads mcpServers correctly', async () => {
    const configFile = join(tmpDir, 'cline_mcp_settings.json')
    writeFileSync(configFile, JSON.stringify({ mcpServers: { myTool: { command: 'node' } } }))

    const servers = await clineAdapter.read(configFile)
    expect(servers['myTool']?.command).toBe('node')
  })

  it('writes servers and preserves unrelated top-level keys', async () => {
    const configFile = join(tmpDir, 'cline_mcp_settings.json')
    writeFileSync(configFile, JSON.stringify({ theme: 'dark' }))

    await clineAdapter.write(configFile, { newServer: { command: 'python' } })
    const raw = JSON.parse(readFileSync(configFile, 'utf-8')) as {
      theme?: string
      mcpServers?: Record<string, unknown>
    }

    expect(raw.theme).toBe('dark')
    expect(raw.mcpServers?.['newServer']).toBeDefined()
  })

  it('validate reports malformed JSON', async () => {
    const configFile = join(tmpDir, 'cline_mcp_settings.json')
    writeFileSync(configFile, '{ bad json')

    const validation = await clineAdapter.validate(configFile)
    expect(validation.valid).toBe(false)
    expect(validation.errors[0]).toContain('JSON parse error')
  })
})
