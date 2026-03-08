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
 * Launching is delegated to `cross-spawn` for reliable Windows behavior.
 */

import spawn from 'cross-spawn'
import type {
  ChildProcess,
  ChildProcessWithoutNullStreams,
  SpawnOptionsWithoutStdio,
} from 'child_process'

type LaunchMode = 'direct' | 'windows-alias'
type ProcessEnvMap = Record<string, string | undefined>

export interface LaunchSuccess {
  readonly child: ChildProcessWithoutNullStreams
  readonly mode: LaunchMode
  readonly command: string
}

export type LaunchErrorKind = 'executable_not_found' | 'spawn_failed'

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
const NOISY_NPM_ENV_KEYS = new Set([
  'npm_config_verify_deps_before_run',
  'npm_config__jsr_registry',
])

const isWindows = (): boolean => process.platform === 'win32'

const normalizeWindowsCommand = (command: string): string => {
  const trimmed = command.trim()
  if (!trimmed) return command
  const lower = trimmed.toLowerCase()
  return WINDOWS_CMD_ALIASES[lower] ?? command
}

const asCode = (err: unknown): string | undefined => {
  if (!err || typeof err !== 'object') return undefined
  const maybeCode = (err as { code?: unknown }).code
  return typeof maybeCode === 'string' ? maybeCode : undefined
}

const canonicalizeWindowsPathKey = (env: ProcessEnvMap): ProcessEnvMap => {
  const out: ProcessEnvMap = {}
  let firstPathValue: string | undefined
  let firstNonEmptyPathValue: string | undefined

  for (const [key, value] of Object.entries(env)) {
    if (key.toLowerCase() === 'path') {
      if (typeof value !== 'string') continue
      if (firstPathValue === undefined) firstPathValue = value
      if (firstNonEmptyPathValue === undefined && value.trim().length > 0) {
        firstNonEmptyPathValue = value
      }
      continue
    }
    out[key] = value
  }

  const resolvedPath = firstNonEmptyPathValue ?? firstPathValue
  if (resolvedPath !== undefined) out.Path = resolvedPath
  return out
}

const sanitizeSpawnEnv = (
  env: SpawnOptionsWithoutStdio['env'],
  windows: boolean,
): SpawnOptionsWithoutStdio['env'] => {
  if (env === undefined) return undefined

  const out: ProcessEnvMap = {}
  for (const [key, value] of Object.entries(env)) {
    const lowerKey = key.toLowerCase()
    if (typeof value !== 'string') continue
    if (key.length === 0) continue
    if (key.includes('\u0000') || value.includes('\u0000')) continue
    if (NOISY_NPM_ENV_KEYS.has(lowerKey)) continue
    if (windows && key.includes('=')) continue
    out[key] = value
  }
  return windows ? canonicalizeWindowsPathKey(out) : out
}

const waitForSpawn = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
): Promise<ChildProcessWithoutNullStreams> => {
  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams
    try {
      const spawned = spawn(command, [...args], options) as unknown as ChildProcess
      if (!spawned.stdin || !spawned.stdout || !spawned.stderr) {
        reject(new Error(`Spawned process "${command}" did not expose stdio pipes.`))
        return
      }
      child = spawned as ChildProcessWithoutNullStreams
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
  const sanitizedOptions: SpawnOptionsWithoutStdio = {
    ...options,
    ...(options.env !== undefined ? { env: sanitizeSpawnEnv(options.env, windows) } : {}),
  }

  try {
    const child = await waitForSpawn(normalized, args, sanitizedOptions)
    return { child, mode, command: normalized }
  } catch (err) {
    const code = asCode(err)
    const message =
      code === 'ENOENT'
        ? `Executable not found: ${normalized}. Ensure Node.js/npm is installed and available in PATH.`
        : `Failed to spawn process "${normalized}": ${String(err)}`
    throw new CommandLaunchError(
      code === 'ENOENT' ? 'executable_not_found' : 'spawn_failed',
      message,
      normalized,
      code,
    )
  }
}
