/**
 * @file src/main/clients/__tests__/claude-code.adapter.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the Claude Code CLI client adapter. Both config
 * paths (.claude.json and .claude/settings.json) are exercised.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { claudeCodeAdapter } from '../claude-code.adapter'

const makeTmpDir = (): string => {
  const dir = join(
    tmpdir(),
    `claude-code-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('claudeCodeAdapter', () => {
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

  it('reports not installed when neither config exists', async () => {
    const result = await claudeCodeAdapter.detect()
    expect(result.installed).toBe(false)
    expect(result.configPaths).toHaveLength(0)
  })

  it('detects the legacy .claude.json path', async () => {
    writeFileSync(
      join(tmpDir, '.claude.json'),
      JSON.stringify({ mcpServers: { server1: { command: 'npx', args: [] } } }),
    )

    const result = await claudeCodeAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.configPaths).toHaveLength(1)
    expect(result.serverCount).toBe(1)
  })

  it('detects the settings.json path', async () => {
    const settingsDir = join(tmpDir, '.claude')
    mkdirSync(settingsDir, { recursive: true })
    writeFileSync(
      join(settingsDir, 'settings.json'),
      JSON.stringify({
        mcpServers: { a: { command: 'node', args: [] }, b: { command: 'npx', args: [] } },
      }),
    )

    const result = await claudeCodeAdapter.detect()
    expect(result.installed).toBe(true)
    expect(result.serverCount).toBe(2)
  })

  it('reads and writes mcpServers correctly', async () => {
    const configFile = join(tmpDir, '.claude.json')
    writeFileSync(configFile, JSON.stringify({}))

    await claudeCodeAdapter.write(configFile, {
      srv: { command: 'python', args: ['-m', 'server'] },
    })
    const servers = await claudeCodeAdapter.read(configFile)

    expect(servers['srv']).toBeDefined()
    expect(servers['srv']?.command).toBe('python')
  })
})
