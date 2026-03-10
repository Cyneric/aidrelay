/**
 * @file src/main/installer/adapters/winget.adapter.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Windows Package Manager (winget) adapter for local MCP server
 * installation. Installs packages via `winget install --id`.
 */

import spawn from 'cross-spawn'
import log from 'electron-log'
import type { InstallAdapterConfig } from '@shared/types'
import type { InstallAdapter, InstallResult } from './types'

const WINGET_COMMAND = 'winget'

export const wingetAdapter: InstallAdapter = {
  type: 'winget',
  displayName: 'Windows Package Manager (winget)',

  async detectRuntime(): Promise<boolean> {
    try {
      const result = await executeCommand(WINGET_COMMAND, ['--version'])
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async checkInstalled(config: InstallAdapterConfig): Promise<boolean> {
    try {
      const result = await executeCommand(WINGET_COMMAND, [
        'list',
        '--id',
        config.package,
        '--exact',
      ])
      return result.exitCode === 0 && result.stdout.includes(config.package)
    } catch {
      return false
    }
  },

  async install(config: InstallAdapterConfig): Promise<boolean> {
    const args = ['install', '--id', config.package, '--exact', '--silent']
    if (config.version) {
      args.push('--version', config.version)
    }
    if (config.args) {
      args.push(...config.args)
    }

    try {
      const result = await executeCommand(WINGET_COMMAND, args)
      if (result.exitCode === 0) {
        log.info(
          `[installer:winget] installed ${config.package}${config.version ? `@${config.version}` : ''}`,
        )
        return true
      } else {
        log.warn(`[installer:winget] install failed for ${config.package}: ${result.stderr}`)
        return false
      }
    } catch (error) {
      log.error(`[installer:winget] install threw for ${config.package}:`, error)
      return false
    }
  },

  async uninstall(config: InstallAdapterConfig): Promise<boolean> {
    const args = ['uninstall', '--id', config.package, '--exact', '--silent']
    if (config.args) {
      args.push(...config.args)
    }

    try {
      const result = await executeCommand(WINGET_COMMAND, args)
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async getRuntimeVersion(): Promise<string> {
    try {
      const result = await executeCommand(WINGET_COMMAND, ['--version'])
      return result.stdout.trim()
    } catch {
      return 'unknown'
    }
  },

  async getPackageVersion(config: InstallAdapterConfig): Promise<string | null> {
    try {
      const result = await executeCommand(WINGET_COMMAND, [
        'list',
        '--id',
        config.package,
        '--exact',
      ])
      if (result.exitCode !== 0) {
        return null
      }
      // winget list output parsing: find the version column
      const lines = result.stdout.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith(config.package)) {
          const parts = trimmed.split(/\s+/)
          // format: PackageId Version   Available Source
          if (parts.length >= 2) {
            return parts[1]!
          }
        }
      }
      return null
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
    log.debug(`[installer:winget] executing: ${command} ${args.join(' ')}`)
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
      log.debug(`[installer:winget] command exited with ${exitCode} in ${durationMs}ms`)
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
      log.debug(`[installer:winget] command errored in ${durationMs}ms:`, error)
      reject(new Error(`Command failed: ${error.message}`))
    })
  })
}
