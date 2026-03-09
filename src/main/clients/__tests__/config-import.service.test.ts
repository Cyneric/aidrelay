import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createTestDb } from '@main/db/__tests__/helpers'
import type Database from 'better-sqlite3'
import { ServersRepo } from '@main/db/servers.repo'
import { opencodeAdapter } from '../opencode.adapter'
import { importExternalConfigChanges, previewExternalConfigImport } from '../config-import.service'

const makeTmpDir = (): string => {
  const dir = join(
    tmpdir(),
    `aidrelay-config-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('config-import.service (OpenCode canonicalization)', () => {
  let db: Database.Database
  let serversRepo: ServersRepo
  let tmpDir: string

  beforeEach(() => {
    db = createTestDb()
    serversRepo = new ServersRepo(db)
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('imports new OpenCode local/remote entries in canonical shape', async () => {
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
          remoteServer: {
            type: 'remote',
            url: 'https://example.test/sse',
            transport: 'sse',
            headers: { Authorization: 'Bearer token' },
          },
        },
      }),
    )

    const payload = {
      clientId: 'opencode' as const,
      configPath,
      added: ['localServer', 'remoteServer'],
      removed: [],
      modified: [],
    }

    const result = await importExternalConfigChanges(opencodeAdapter, payload, serversRepo)
    expect(result.created).toBe(2)
    expect(result.updated).toBe(0)
    expect(result.errors).toEqual([])

    const servers = serversRepo.findAll()
    const local = servers.find((server) => server.name === 'localServer')
    const remote = servers.find((server) => server.name === 'remoteServer')

    expect(local).toMatchObject({
      name: 'localServer',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'local-mcp'],
      env: { TOKEN: 'abc' },
    })

    expect(remote).toMatchObject({
      name: 'remoteServer',
      type: 'sse',
      command: 'fetch',
      url: 'https://example.test/sse',
      headers: { Authorization: 'Bearer token' },
    })
  })

  it('marks canonical-equivalent OpenCode entries as no-op in preview', async () => {
    serversRepo.create({
      name: 'localServer',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'local-mcp'],
      env: { TOKEN: 'abc' },
    })

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
        },
      }),
    )

    const payload = {
      clientId: 'opencode' as const,
      configPath,
      added: [],
      removed: [],
      modified: ['localServer'],
    }

    const preview = await previewExternalConfigImport(opencodeAdapter, payload, serversRepo)
    expect(preview.items).toHaveLength(1)
    expect(preview.items[0]).toMatchObject({
      name: 'localServer',
      action: 'no-op',
      source: 'modified',
    })
  })
})
