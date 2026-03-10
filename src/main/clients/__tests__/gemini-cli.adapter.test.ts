/**
 * @file src/main/clients/__tests__/gemini-cli.adapter.test.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the Gemini CLI client adapter.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { geminiCliAdapter } from '../gemini-cli.adapter'

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `gemini-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('geminiCliAdapter', () => {
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
    const result = await geminiCliAdapter.detect()
    expect(result.installed).toBe(false)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('detects installed when gemini executable exists on PATH', async () => {
    const binDir = process.env['PATH'] ?? ''
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, 'gemini.cmd'), '')

    const result = await geminiCliAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('detects installed state from .gemini/settings.json', async () => {
    const geminiDir = join(process.env['USERPROFILE'] ?? '', '.gemini')
    mkdirSync(geminiDir, { recursive: true })
    writeFileSync(
      join(geminiDir, 'settings.json'),
      JSON.stringify({ mcpServers: { tool: { command: 'npx', args: [] } } }),
    )

    const result = await geminiCliAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toHaveLength(1)
    expect(result.serverCount).toBe(1)
  })

  it('reads mcpServers correctly', async () => {
    const geminiDir = join(tmpDir, '.gemini')
    const configFile = join(geminiDir, 'settings.json')
    mkdirSync(geminiDir, { recursive: true })
    writeFileSync(
      configFile,
      JSON.stringify({ mcpServers: { myTool: { command: 'node', args: ['server.js'] } } }),
    )

    const servers = await geminiCliAdapter.read(configFile)
    expect(servers['myTool']?.command).toBe('node')
  })

  it('writes servers and preserves existing top-level keys', async () => {
    const geminiDir = join(tmpDir, '.gemini')
    const configFile = join(geminiDir, 'settings.json')
    mkdirSync(geminiDir, { recursive: true })
    writeFileSync(configFile, JSON.stringify({ model: 'gemini-2.5-pro' }))

    await geminiCliAdapter.write(configFile, { newServer: { command: 'python', args: [] } })
    const raw = JSON.parse(readFileSync(configFile, 'utf-8')) as {
      model?: string
      mcpServers?: Record<string, unknown>
    }

    expect(raw.model).toBe('gemini-2.5-pro')
    expect(raw.mcpServers?.['newServer']).toBeDefined()
  })

  it('validate reports malformed json', async () => {
    const geminiDir = join(tmpDir, '.gemini')
    const configFile = join(geminiDir, 'settings.json')
    mkdirSync(geminiDir, { recursive: true })
    writeFileSync(configFile, '{ bad json')

    const validation = await geminiCliAdapter.validate(configFile)
    expect(validation.valid).toBe(false)
    expect(validation.errors[0]).toContain('JSON parse error')
  })
})
