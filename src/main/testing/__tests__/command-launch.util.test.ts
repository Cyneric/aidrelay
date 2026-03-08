/**
 * @file src/main/testing/__tests__/command-launch.util.test.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for command launch normalization and cross-spawn mapping.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Platform = typeof process.platform

const withMockPlatform = (platform: Platform): void => {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  })
}

type ChildHandler = (...args: unknown[]) => void
type ChildHandlers = Map<string, ChildHandler[]>

const makeSpawnedChild = (): {
  child: {
    once: ReturnType<typeof vi.fn>
    off: ReturnType<typeof vi.fn>
    stdin: Record<string, unknown>
    stdout: Record<string, unknown>
    stderr: Record<string, unknown>
  }
  handlers: ChildHandlers
} => {
  const handlers: ChildHandlers = new Map()
  return {
    child: {
      once: vi.fn((event: string, cb: ChildHandler) => {
        const list = handlers.get(event) ?? []
        list.push(cb)
        handlers.set(event, list)
        return undefined
      }),
      off: vi.fn((event: string, cb: ChildHandler) => {
        const list = handlers.get(event) ?? []
        handlers.set(
          event,
          list.filter((fn) => fn !== cb),
        )
        return undefined
      }),
      stdin: {},
      stdout: {},
      stderr: {},
    },
    handlers,
  }
}

const emit = (handlers: ChildHandlers, event: string, ...args: unknown[]): void => {
  for (const cb of handlers.get(event) ?? []) cb(...args)
}

const spawnMock = vi.hoisted(() => vi.fn())
vi.mock('cross-spawn', () => ({
  default: spawnMock,
}))

import type { CommandLaunchError } from '../command-launch.util'
import { spawnCommandWithWindowsFallback } from '../command-launch.util'

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('spawnCommandWithWindowsFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses .cmd alias for npx on Windows', async () => {
    withMockPlatform('win32')
    const first = makeSpawnedChild()
    spawnMock.mockReturnValue(first.child)

    const promise = spawnCommandWithWindowsFallback('npx', ['-y', 'pkg'], {
      stdio: 'pipe',
      env: { PATH: 'C:\\node' },
    })
    await flushMicrotasks()
    emit(first.handlers, 'spawn')

    const result = await promise
    expect(result.mode).toBe('windows-alias')
    expect(result.command).toBe('npx.cmd')
    expect(spawnMock).toHaveBeenCalledWith('npx.cmd', ['-y', 'pkg'], expect.any(Object))
  })

  it('maps ENOENT to executable_not_found', async () => {
    withMockPlatform('win32')
    const first = makeSpawnedChild()
    spawnMock.mockReturnValueOnce(first.child)

    const promise = spawnCommandWithWindowsFallback('my-tool', ['--flag'], { stdio: 'pipe' })

    await flushMicrotasks()
    emit(first.handlers, 'error', Object.assign(new Error('not found'), { code: 'ENOENT' }))
    await expect(promise).rejects.toMatchObject({
      name: 'CommandLaunchError',
      kind: 'executable_not_found',
      command: 'my-tool',
    } satisfies Partial<CommandLaunchError>)
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('maps non-ENOENT to spawn_failed', async () => {
    withMockPlatform('win32')
    const first = makeSpawnedChild()
    spawnMock.mockReturnValueOnce(first.child)

    const promise = spawnCommandWithWindowsFallback('npx', ['-y', 'pkg'], { stdio: 'pipe' })

    await flushMicrotasks()
    emit(first.handlers, 'error', Object.assign(new Error('invalid'), { code: 'EINVAL' }))
    await expect(promise).rejects.toMatchObject({
      name: 'CommandLaunchError',
      kind: 'spawn_failed',
      command: 'npx.cmd',
      originalCode: 'EINVAL',
    } satisfies Partial<CommandLaunchError>)
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('sanitizes invalid env entries and canonicalizes Path before spawn', async () => {
    withMockPlatform('win32')
    const first = makeSpawnedChild()
    spawnMock.mockReturnValue(first.child)

    const promise = spawnCommandWithWindowsFallback('node', ['index.js'], {
      stdio: 'pipe',
      env: {
        GOOD: '1',
        EMPTY: '',
        PATH: '',
        Path: 'C:\\preferred',
        path: 'C:\\secondary',
        DROP_UNDEF: undefined,
        'BAD=KEY': 'x',
        NULL_VALUE: `a${String.fromCharCode(0)}b`,
        npm_config_verify_deps_before_run: 'true',
        npm_config__jsr_registry: 'https://npm.jsr.io',
      },
    })
    await flushMicrotasks()
    emit(first.handlers, 'spawn')
    await promise

    const options = spawnMock.mock.calls[0]?.[2] as { env?: Record<string, string> } | undefined
    expect(options?.env).toEqual({
      GOOD: '1',
      EMPTY: '',
      Path: 'C:\\preferred',
    })
  })

  it('does not alias commands on non-Windows', async () => {
    withMockPlatform('linux')
    const first = makeSpawnedChild()
    spawnMock.mockReturnValueOnce(first.child)

    const promise = spawnCommandWithWindowsFallback('npx', [], { stdio: 'pipe' })
    await flushMicrotasks()
    emit(first.handlers, 'spawn')
    const result = await promise
    expect(result.mode).toBe('direct')
    expect(result.command).toBe('npx')
    expect(spawnMock).toHaveBeenCalledWith('npx', [], expect.any(Object))
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })
})
