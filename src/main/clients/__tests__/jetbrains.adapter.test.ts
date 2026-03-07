/**
 * @file src/main/clients/__tests__/jetbrains.adapter.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the JetBrains client adapter. Since JetBrains
 * uses no file-based MCP config, the tests focus on installation detection
 * via the `%APPDATA%/JetBrains/` directory.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { jetbrainsAdapter } from '../jetbrains.adapter'

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `jetbrains-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('jetbrainsAdapter', () => {
  let tmpDir: string
  let originalAppData: string | undefined

  beforeEach(() => {
    tmpDir = makeTmpDir()
    originalAppData = process.env['APPDATA']
    process.env['APPDATA'] = tmpDir
  })

  afterEach(() => {
    process.env['APPDATA'] = originalAppData
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reports not installed when JetBrains directory is absent', async () => {
    const result = await jetbrainsAdapter.detect()
    expect(result.installed).toBe(false)
  })

  it('reports not installed when JetBrains dir exists but has no known IDE folders', async () => {
    mkdirSync(join(tmpDir, 'JetBrains', 'UnknownTool2026'), { recursive: true })

    const result = await jetbrainsAdapter.detect()
    expect(result.installed).toBe(false)
  })

  it('reports installed when IntelliJIdea directory is found', async () => {
    mkdirSync(join(tmpDir, 'JetBrains', 'IntelliJIdea2026.1'), { recursive: true })

    const result = await jetbrainsAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toHaveLength(0)
    expect(result.serverCount).toBe(0)
  })

  it('reports installed when WebStorm directory is found', async () => {
    mkdirSync(join(tmpDir, 'JetBrains', 'WebStorm2025.3'), { recursive: true })

    const result = await jetbrainsAdapter.detect()
    expect(result.installed).toBe(true)
  })

  it('read() returns empty map (no file-based config)', async () => {
    const servers = await jetbrainsAdapter.read('/any/path')
    expect(servers).toEqual({})
  })

  it('write() is a no-op and resolves without error', async () => {
    await expect(jetbrainsAdapter.write('/any/path', {})).resolves.toBeUndefined()
  })
})
