/**
 * @file src/main/testing/__tests__/command-launch.util.test.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for command launch normalization and Windows fallback.
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
    },
    handlers,
  }
}

const emit = (handlers: ChildHandlers, event: string, ...args: unknown[]): void => {
  for (const cb of handlers.get(event) ?? []) cb(...args)
}

const spawnMock = vi.hoisted(() => vi.fn())

vi.mock('child_process', () => ({
  spawn: spawnMock,
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

    const promise = spawnCommandWithWindowsFallback('npx', ['-y', 'pkg'], { stdio: 'pipe' })
    await flushMicrotasks()
    emit(first.handlers, 'spawn')

    const result = await promise
    expect(result.mode).toBe('windows-alias')
    expect(spawnMock).toHaveBeenCalledWith('npx.cmd', ['-y', 'pkg'], expect.any(Object))
  })

  it('falls back to cmd.exe on Windows when direct launch returns ENOENT', async () => {
    withMockPlatform('win32')
    const first = makeSpawnedChild()
    const second = makeSpawnedChild()
    spawnMock.mockReturnValueOnce(first.child).mockReturnValueOnce(second.child)

    const promise = spawnCommandWithWindowsFallback('my-tool', ['--flag'], { stdio: 'pipe' })

    await flushMicrotasks()
    emit(first.handlers, 'error', Object.assign(new Error('not found'), { code: 'ENOENT' }))
    await flushMicrotasks()
    emit(second.handlers, 'spawn')
    const result = await promise

    expect(result.mode).toBe('windows-cmd-fallback')
    expect(spawnMock).toHaveBeenNthCalledWith(1, 'my-tool', ['--flag'], expect.any(Object))
    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      'cmd.exe',
      ['/d', '/s', '/c', '"my-tool" "--flag"'],
      expect.any(Object),
    )
  })

  it('does not fallback on non-Windows and returns executable_not_found for ENOENT', async () => {
    withMockPlatform('linux')
    const first = makeSpawnedChild()
    spawnMock.mockReturnValueOnce(first.child)

    const promise = spawnCommandWithWindowsFallback('missing-tool', [], { stdio: 'pipe' })
    await flushMicrotasks()
    emit(first.handlers, 'error', Object.assign(new Error('not found'), { code: 'ENOENT' }))

    await expect(promise).rejects.toMatchObject({
      name: 'CommandLaunchError',
      kind: 'executable_not_found',
    } satisfies Partial<CommandLaunchError>)
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })
})
