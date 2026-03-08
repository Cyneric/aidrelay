/**
 * @file src/main/testing/command-launch.util.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Cross-platform process launch helper for MCP stdio commands.
 * On Windows, known package-manager shims are normalized to `.cmd` first.
 * If launch still fails with ENOENT, a `cmd.exe /d /s /c` fallback is used.
 */

import { spawn } from 'child_process'
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'child_process'

type LaunchMode = 'direct' | 'windows-alias' | 'windows-cmd-fallback'

export interface LaunchSuccess {
  readonly child: ChildProcessWithoutNullStreams
  readonly mode: LaunchMode
  readonly command: string
}

export type LaunchErrorKind = 'executable_not_found' | 'shell_fallback_failed' | 'spawn_failed'

export class CommandLaunchError extends Error {
  readonly kind: LaunchErrorKind
  readonly command: string
  readonly originalCode?: string

  constructor(kind: LaunchErrorKind, message: string, command: string, originalCode?: string) {
    super(message)
    this.name = 'CommandLaunchError'
    this.kind = kind
    this.command = command
    if (originalCode !== undefined) {
      this.originalCode = originalCode
    }
  }
}

const WINDOWS_CMD_ALIASES: Readonly<Record<string, string>> = {
  npx: 'npx.cmd',
  npm: 'npm.cmd',
  pnpm: 'pnpm.cmd',
  yarn: 'yarn.cmd',
  bun: 'bun.cmd',
}

const isWindows = (): boolean => process.platform === 'win32'

const normalizeWindowsCommand = (command: string): string => {
  const trimmed = command.trim()
  if (!trimmed) return command
  const lower = trimmed.toLowerCase()
  return WINDOWS_CMD_ALIASES[lower] ?? command
}

const isEnoent = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false
  const maybeCode = (err as { code?: unknown }).code
  return maybeCode === 'ENOENT'
}

const asCode = (err: unknown): string | undefined => {
  if (!err || typeof err !== 'object') return undefined
  const maybeCode = (err as { code?: unknown }).code
  return typeof maybeCode === 'string' ? maybeCode : undefined
}

const quoteForCmd = (value: string): string => {
  if (value.length === 0) return '""'
  const escaped = value.replace(/"/g, '\\"')
  return `"${escaped}"`
}

const buildCmdCommandLine = (command: string, args: readonly string[]): string => {
  return [command, ...args].map((part) => quoteForCmd(part)).join(' ')
}

const waitForSpawn = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
): Promise<ChildProcessWithoutNullStreams> => {
  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams
    try {
      child = spawn(command, [...args], options)
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
      return
    }

    const onSpawn = (): void => {
      cleanup()
      resolve(child)
    }
    const onError = (err: Error): void => {
      cleanup()
      reject(err)
    }
    const cleanup = (): void => {
      child.off('spawn', onSpawn)
      child.off('error', onError)
    }

    child.once('spawn', onSpawn)
    child.once('error', onError)
  })
}

export const spawnCommandWithWindowsFallback = async (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
): Promise<LaunchSuccess> => {
  const windows = isWindows()
  const normalized = windows ? normalizeWindowsCommand(command) : command
  const mode: LaunchMode = windows && normalized !== command ? 'windows-alias' : 'direct'

  try {
    const child = await waitForSpawn(normalized, args, options)
    return { child, mode, command: normalized }
  } catch (err) {
    if (!windows || !isEnoent(err)) {
      const code = asCode(err)
      const message =
        code === 'ENOENT'
          ? `Executable not found: ${normalized}`
          : `Failed to spawn process "${normalized}": ${String(err)}`
      throw new CommandLaunchError(
        code === 'ENOENT' ? 'executable_not_found' : 'spawn_failed',
        message,
        normalized,
        code,
      )
    }
  }

  const cmdLine = buildCmdCommandLine(command, args)
  try {
    const child = await waitForSpawn('cmd.exe', ['/d', '/s', '/c', cmdLine], options)
    return { child, mode: 'windows-cmd-fallback', command: command }
  } catch (err) {
    const code = asCode(err)
    const message = `Shell fallback failed for "${command}": ${String(err)}`
    throw new CommandLaunchError('shell_fallback_failed', message, command, code)
  }
}
