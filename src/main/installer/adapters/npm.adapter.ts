/**
 * @file src/main/installer/adapters/npm.adapter.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description npm/npx adapter for local MCP server installation.
 * Installs packages via `npm install -g` or `npx`.
 */

import spawn from 'cross-spawn'
import log from 'electron-log'
import type { InstallAdapterConfig } from '@shared/types'
import type { InstallAdapter, InstallResult } from './types'

const NPM_COMMAND = 'npm'

export const npmAdapter: InstallAdapter = {
  type: 'npm',
  displayName: 'npm / npx',

  async detectRuntime(): Promise<boolean> {
    try {
      const result = await executeCommand(NPM_COMMAND, ['--version'])
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async checkInstalled(config: InstallAdapterConfig): Promise<boolean> {
    try {
      const result = await executeCommand(NPM_COMMAND, ['list', '-g', config.package, '--depth=0'])
      return result.exitCode === 0 && result.stdout.includes(config.package)
    } catch {
      return false
    }
  },

  async install(config: InstallAdapterConfig): Promise<boolean> {
    const args = ['install', '-g', config.package]
    if (config.version) {
      args.push(`${config.package}@${config.version}`)
    }
    if (config.args) {
      args.push(...config.args)
    }

    try {
      const result = await executeCommand(NPM_COMMAND, args)
      if (result.exitCode === 0) {
        log.info(
          `[installer:npm] installed ${config.package}${config.version ? `@${config.version}` : ''}`,
        )
        return true
      } else {
        log.warn(`[installer:npm] install failed for ${config.package}: ${result.stderr}`)
        return false
      }
    } catch (error) {
      log.error(`[installer:npm] install threw for ${config.package}:`, error)
      return false
    }
  },

  async uninstall(config: InstallAdapterConfig): Promise<boolean> {
    const args = ['uninstall', '-g', config.package]
    if (config.args) {
      args.push(...config.args)
    }

    try {
      const result = await executeCommand(NPM_COMMAND, args)
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async getRuntimeVersion(): Promise<string> {
    try {
      const result = await executeCommand(NPM_COMMAND, ['--version'])
      return result.stdout.trim()
    } catch {
      return 'unknown'
    }
  },

  async getPackageVersion(config: InstallAdapterConfig): Promise<string | null> {
    try {
      const result = await executeCommand(NPM_COMMAND, [
        'list',
        '-g',
        config.package,
        '--depth=0',
        '--json',
      ])
      if (result.exitCode !== 0) {
        return null
      }
      // npm list --json returns a dependency tree
      const parsed = JSON.parse(result.stdout) as {
        dependencies?: Record<string, { version: string }>
      }
      return parsed.dependencies?.[config.package]?.version ?? null
    } catch {
      return null
    }
  },
}

// ─── Private Helper ────────────────────────────────────────────────────────────

async function executeCommand(
  command: string,
  args: readonly string[],
  env?: Readonly<Record<string, string>>,
): Promise<InstallResult> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    log.debug(`[installer:npm] executing: ${command} ${args.join(' ')}`)
    const child = spawn(command, [...args], {
      stdio: 'pipe',
      env: { ...process.env, ...env },
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8')
    })
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8')
    })

    child.on('close', (exitCode) => {
      const durationMs = Date.now() - start
      log.debug(`[installer:npm] command exited with ${exitCode} in ${durationMs}ms`)
      resolve({
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode: exitCode ?? -1,
        durationMs,
      })
    })

    child.on('error', (error) => {
      const durationMs = Date.now() - start
      log.debug(`[installer:npm] command errored in ${durationMs}ms:`, error)
      reject(new Error(`Command failed: ${error.message}`))
    })
  })
}
