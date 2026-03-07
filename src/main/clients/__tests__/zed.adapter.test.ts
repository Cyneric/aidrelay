/**
 * @file src/main/clients/__tests__/zed.adapter.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the Zed editor client adapter. Verifies that
 * Zed's nested `context_servers` format is correctly normalized when reading
 * and re-encoded when writing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { zedAdapter } from '../zed.adapter'

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `zed-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('zedAdapter', () => {
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

  it('reports not installed when settings.json is absent', async () => {
    const result = await zedAdapter.detect()
    expect(result.installed).toBe(false)
  })

  it('detects installed state from settings.json with context_servers', async () => {
    const zedDir = join(tmpDir, 'Zed')
    mkdirSync(zedDir, { recursive: true })
    writeFileSync(
      join(zedDir, 'settings.json'),
      JSON.stringify({
        context_servers: {
          myServer: { settings: { command: 'npx', args: ['-y', 'pkg'] } },
        },
      }),
    )

    const result = await zedAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.serverCount).toBe(1)
  })

  it('normalizes nested context_servers into McpServerMap on read', async () => {
    const zedDir = join(tmpDir, 'Zed')
    mkdirSync(zedDir, { recursive: true })
    const configFile = join(zedDir, 'settings.json')
    writeFileSync(
      configFile,
      JSON.stringify({
        context_servers: {
          zedServer: { settings: { command: 'node', args: ['index.js'], env: { PORT: '3000' } } },
        },
      }),
    )

    const servers = await zedAdapter.read(configFile)
    expect(servers['zedServer']?.command).toBe('node')
    expect(servers['zedServer']?.args).toEqual(['index.js'])
    expect(servers['zedServer']?.env).toEqual({ PORT: '3000' })
  })

  it('writes back in Zed nested format', async () => {
    const zedDir = join(tmpDir, 'Zed')
    mkdirSync(zedDir, { recursive: true })
    const configFile = join(zedDir, 'settings.json')
    writeFileSync(configFile, JSON.stringify({ theme: 'dark' }))

    await zedAdapter.write(configFile, {
      myTool: { command: 'python', args: ['-m', 'tool'] },
    })

    const written = JSON.parse(readFileSync(configFile, 'utf-8')) as {
      theme: string
      context_servers: Record<string, { settings: { command: string } }>
    }

    expect(written.theme).toBe('dark')
    expect(written.context_servers?.myTool?.settings?.command).toBe('python')
  })
})
