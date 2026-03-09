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

  it('detects installed via extensionless launcher in quoted PATH', async () => {
    const binDir = join(tmpDir, 'bin with spaces')
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, 'opencode'), '')
    process.env['PATH'] = `"${binDir}"`

    const result = await opencodeAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toEqual([])
  })

  it('reads legacy mcp server shape', async () => {
    const configPath = join(tmpDir, 'opencode.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        mcp: {
          legacy: {
            command: 'npx',
            args: ['-y', 'legacy-mcp'],
            env: { TOKEN: 'abc' },
          },
        },
      }),
    )

    const read = await opencodeAdapter.read(configPath)
    expect(read).toEqual({
      legacy: {
        command: 'npx',
        args: ['-y', 'legacy-mcp'],
        env: { TOKEN: 'abc' },
      },
    })
  })

  it('reads new OpenCode local/remote shapes into canonical format', async () => {
    const configPath = join(tmpDir, 'opencode.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        mcp: {
          localServer: {
            type: 'local',
            command: ['npx', '-y', 'local-mcp'],
            environment: { TOKEN: 'abc' },
          },
          sseRemote: {
            type: 'remote',
            url: 'https://example.test/sse',
            transport: 'sse',
            headers: { Authorization: 'Bearer token' },
          },
          httpRemote: {
            type: 'remote',
            url: 'https://example.test/http',
          },
        },
      }),
    )

    const read = await opencodeAdapter.read(configPath)
    expect(read).toEqual({
      localServer: {
        command: 'npx',
        args: ['-y', 'local-mcp'],
        env: { TOKEN: 'abc' },
      },
      sseRemote: {
        command: 'fetch',
        type: 'sse',
        url: 'https://example.test/sse',
        headers: { Authorization: 'Bearer token' },
      },
      httpRemote: {
        command: 'fetch',
        type: 'http',
        url: 'https://example.test/http',
      },
    })
  })

  it('writes canonical stdio server shape to OpenCode local format', async () => {
    const configPath = join(tmpDir, 'opencode.json')
    writeFileSync(configPath, JSON.stringify({ other: true }))

    await opencodeAdapter.write(configPath, {
      myServer: {
        command: 'npx',
        args: ['-y', 'my-mcp'],
        env: { TOKEN: 'abc' },
      },
    })
    const written = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
    const mcp = written['mcp'] as Record<string, unknown>
    expect(mcp['myServer']).toEqual({
      type: 'local',
      command: ['npx', '-y', 'my-mcp'],
      environment: { TOKEN: 'abc' },
      enabled: true,
    })
    expect(written['other']).toBe(true)
  })

  it('writes canonical remote server shape to OpenCode remote format', async () => {
    const configPath = join(tmpDir, 'opencode.json')
    writeFileSync(configPath, JSON.stringify({}))

    await opencodeAdapter.write(configPath, {
      sseRemote: {
        command: 'fetch',
        type: 'sse',
        url: 'https://example.test/sse',
        headers: { Authorization: 'Bearer sse' },
      },
      httpRemote: {
        command: 'fetch',
        type: 'http',
        url: 'https://example.test/http',
      },
    })

    const written = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
    const mcp = written['mcp'] as Record<string, unknown>
    expect(mcp['sseRemote']).toEqual({
      type: 'remote',
      url: 'https://example.test/sse',
      headers: { Authorization: 'Bearer sse' },
      transport: 'sse',
      enabled: true,
    })
    expect(mcp['httpRemote']).toEqual({
      type: 'remote',
      url: 'https://example.test/http',
      transport: 'streamable-http',
      enabled: true,
    })
  })

  it('round-trips canonical config through write/read', async () => {
    const configPath = join(tmpDir, 'opencode.json')
    writeFileSync(configPath, JSON.stringify({}))

    await opencodeAdapter.write(configPath, {
      myServer: { command: 'npx', args: ['-y', 'pkg'] },
    })
    const read = await opencodeAdapter.read(configPath)
    expect(read).toEqual({ myServer: { command: 'npx', args: ['-y', 'pkg'] } })
  })

  it('validates new and legacy mcp entry formats', async () => {
    const configPath = join(tmpDir, 'opencode.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        mcp: {
          legacy: { command: 'npx', args: ['-y', 'legacy'] },
          local: { type: 'local', command: ['npx', '-y', 'local'] },
          remote: { type: 'remote', url: 'https://example.test', transport: 'sse' },
        },
      }),
    )

    const validation = await opencodeAdapter.validate(configPath)
    expect(validation.valid).toBe(true)
    expect(validation.errors).toEqual([])
  })

  it('rejects malformed OpenCode entries', async () => {
    const configPath = join(tmpDir, 'opencode.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        mcp: {
          brokenLocal: { type: 'local', command: [] },
          brokenRemote: { type: 'remote', url: '' },
        },
      }),
    )

    const validation = await opencodeAdapter.validate(configPath)
    expect(validation.valid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
  })
})
