/**
 * @file src/main/clients/__tests__/kilo-cli.adapter.test.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the Kilo CLI client adapter.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import { kiloCliAdapter } from '../kilo-cli.adapter'

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `kilo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('kiloCliAdapter', () => {
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
    const result = await kiloCliAdapter.detect()
    expect(result.installed).toBe(false)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('detects installed when kilo executable exists on PATH', async () => {
    const binDir = process.env['PATH'] ?? ''
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, 'kilo.cmd'), '')

    const result = await kiloCliAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toHaveLength(0)
  })

  it('detects installed from global kilocode config', async () => {
    const configFile = join(
      process.env['USERPROFILE'] ?? '',
      '.config',
      'kilocode',
      'kilocode.json',
    )
    mkdirSync(dirname(configFile), { recursive: true })
    writeFileSync(configFile, JSON.stringify({ mcp: { tool: { command: 'npx' } } }))

    const result = await kiloCliAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toContain(configFile)
    expect(result.serverCount).toBe(1)
  })

  it('writes mcp and preserves unrelated top-level keys', async () => {
    const configFile = join(tmpDir, 'kilocode.json')
    writeFileSync(configFile, JSON.stringify({ profile: 'default' }))

    await kiloCliAdapter.write(configFile, { kiloServer: { command: 'node' } })

    const raw = JSON.parse(readFileSync(configFile, 'utf-8')) as {
      profile?: string
      mcp?: Record<string, unknown>
    }
    expect(raw.profile).toBe('default')
    expect(raw.mcp?.['kiloServer']).toBeDefined()
  })

  it('validate reports malformed json', async () => {
    const configFile = join(tmpDir, 'kilocode.json')
    writeFileSync(configFile, '{ bad json')

    const validation = await kiloCliAdapter.validate(configFile)
    expect(validation.valid).toBe(false)
    expect(validation.errors[0]).toContain('JSON parse error')
  })
})
