/**
 * @file src/main/clients/__tests__/client-install.service.test.ts
 *
 * @description Unit tests for ClientInstallService fallback chains and
 * failure classifications.
 */

import { EventEmitter } from 'events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientInstallProgressPayload } from '@shared/channels'

type Platform = typeof process.platform

const withMockPlatform = (platform: Platform): void => {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  })
}

interface SpawnPlan {
  readonly command: string
  readonly exitCode?: number
  readonly stdout?: string
  readonly stderr?: string
  readonly error?: string
}

const spawnPlanQueue = vi.hoisted(() => [] as SpawnPlan[])
const managerAvailability = vi.hoisted(
  () => ({ winget: true, choco: true, npm: true }) as Record<string, boolean>,
)

const spawnMock = vi.hoisted(() =>
  vi.fn((command: string) => {
    const plan = spawnPlanQueue.shift()
    const effectivePlan: SpawnPlan = plan ?? { command, exitCode: 0 }

    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter
      stderr: EventEmitter
    }
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()

    queueMicrotask(() => {
      if (effectivePlan.stdout) child.stdout.emit('data', effectivePlan.stdout)
      if (effectivePlan.stderr) child.stderr.emit('data', effectivePlan.stderr)
      if (effectivePlan.error) {
        child.emit('error', new Error(effectivePlan.error))
      } else {
        child.emit('close', effectivePlan.exitCode ?? 0)
      }
    })

    return child
  }),
)

vi.mock('cross-spawn', () => ({
  default: spawnMock,
}))

vi.mock('../windows-detection.util', () => ({
  hasWindowsCommandOnPath: (commandNames: readonly string[]) => {
    const key = commandNames[0]
    if (!key) return false
    return managerAvailability[key] ?? false
  },
}))

import { ClientInstallService } from '../client-install.service'

describe('ClientInstallService', () => {
  beforeEach(() => {
    withMockPlatform('win32')
    spawnMock.mockClear()
    spawnPlanQueue.length = 0
    managerAvailability.winget = true
    managerAvailability.choco = true
    managerAvailability.npm = true
  })

  it('uses fallback chain when winget fails and choco succeeds', async () => {
    spawnPlanQueue.push(
      { command: 'winget', exitCode: 1, stderr: 'failed' },
      { command: 'choco', exitCode: 0, stdout: 'ok' },
    )
    const service = new ClientInstallService()

    const result = await service.install('cursor')

    expect(result.success).toBe(true)
    expect(result.installedWith).toBe('choco')
    expect(result.attempts).toHaveLength(2)
    expect(result.attempts[0]?.manager).toBe('winget')
    expect(result.attempts[0]?.success).toBe(false)
    expect(result.attempts[1]?.manager).toBe('choco')
    expect(result.attempts[1]?.success).toBe(true)
    expect(spawnMock).toHaveBeenNthCalledWith(1, 'winget', expect.any(Array), expect.any(Object))
    expect(spawnMock).toHaveBeenNthCalledWith(2, 'choco', expect.any(Array), expect.any(Object))
  })

  it('emits monotonic progress events across fallback attempts', async () => {
    spawnPlanQueue.push(
      { command: 'winget', exitCode: 1, stderr: 'failed' },
      { command: 'choco', exitCode: 0, stdout: 'ok' },
    )
    const service = new ClientInstallService()
    const progressEvents: ClientInstallProgressPayload[] = []

    await service.install('cursor', (payload) => {
      progressEvents.push(payload)
    })

    expect(progressEvents.map((event) => event.phase)).toEqual([
      'start',
      'manager_check',
      'manager_running',
      'manager_failed',
      'manager_check',
      'manager_running',
      'manager_succeeded',
      'completed',
    ])
    expect(progressEvents.map((event) => event.progress)).toEqual(
      [...progressEvents.map((event) => event.progress)].sort((a, b) => a - b),
    )
    expect(progressEvents.at(-1)?.progress).toBe(100)
  })

  it('returns no_available_manager when none of the managers are present', async () => {
    managerAvailability.winget = false
    managerAvailability.choco = false
    managerAvailability.npm = false
    const service = new ClientInstallService()

    const result = await service.install('codex-cli')

    expect(result.success).toBe(false)
    expect(result.failureReason).toBe('no_available_manager')
    expect(result.attempts).toHaveLength(3)
    expect(result.attempts.every((attempt) => attempt.skipped === true)).toBe(true)
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('installs gemini-cli via npm when npm is available', async () => {
    managerAvailability.winget = false
    managerAvailability.choco = false
    managerAvailability.npm = true
    spawnPlanQueue.push({ command: 'npm', exitCode: 0, stdout: 'ok' })
    const service = new ClientInstallService()

    const result = await service.install('gemini-cli')

    expect(result.success).toBe(true)
    expect(result.installedWith).toBe('npm')
    expect(result.attempts).toHaveLength(1)
    expect(result.attempts[0]?.manager).toBe('npm')
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('installs kilo-cli via npm when npm is available', async () => {
    managerAvailability.winget = false
    managerAvailability.choco = false
    managerAvailability.npm = true
    spawnPlanQueue.push({ command: 'npm', exitCode: 0, stdout: 'ok' })
    const service = new ClientInstallService()

    const result = await service.install('kilo-cli')

    expect(result.success).toBe(true)
    expect(result.installedWith).toBe('npm')
    expect(result.attempts).toHaveLength(1)
    expect(result.attempts[0]?.manager).toBe('npm')
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('emits manager_skipped progress events when managers are unavailable', async () => {
    managerAvailability.winget = false
    managerAvailability.choco = false
    managerAvailability.npm = false
    const service = new ClientInstallService()
    const progressEvents: ClientInstallProgressPayload[] = []

    const result = await service.install('codex-cli', (payload) => {
      progressEvents.push(payload)
    })

    expect(result.failureReason).toBe('no_available_manager')
    expect(progressEvents.filter((event) => event.phase === 'manager_skipped')).toHaveLength(3)
    expect(progressEvents.at(-1)).toMatchObject({
      phase: 'completed',
      failureReason: 'no_available_manager',
      progress: 100,
    })
  })

  it('returns requires_elevation without trying to elevate automatically', async () => {
    spawnPlanQueue.push({
      command: 'winget',
      exitCode: 1,
      stderr: 'This operation requires elevation. Run as administrator.',
    })
    managerAvailability.choco = false
    managerAvailability.npm = false
    const service = new ClientInstallService()

    const result = await service.install('codex-gui')

    expect(result.success).toBe(false)
    expect(result.failureReason).toBe('requires_elevation')
    expect(result.attempts).toHaveLength(1)
    expect(result.attempts[0]?.command).toBe('winget')
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('returns manual_install_required for manual-only clients', async () => {
    const service = new ClientInstallService()
    const progressEvents: ClientInstallProgressPayload[] = []

    const result = await service.install('jetbrains', (payload) => {
      progressEvents.push(payload)
    })

    expect(result.success).toBe(false)
    expect(result.failureReason).toBe('manual_install_required')
    expect(result.docsUrl).toContain('jetbrains.com')
    expect(result.attempts).toHaveLength(0)
    expect(progressEvents.map((event) => event.phase)).toEqual(['start', 'completed'])
    expect(progressEvents.at(-1)?.failureReason).toBe('manual_install_required')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('returns unsupported_platform on non-Windows', async () => {
    withMockPlatform('linux')
    const service = new ClientInstallService()

    const result = await service.install('cursor')

    expect(result.success).toBe(false)
    expect(result.failureReason).toBe('unsupported_platform')
    expect(spawnMock).not.toHaveBeenCalled()
  })
})
