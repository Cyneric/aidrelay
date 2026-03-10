/**
 * @file src/main/installer/adapters/pip.adapter.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description pip/pipx/uvx adapter for local MCP server installation.
 * Installs Python packages via `pip install` (global or user).
 */

import spawn from 'cross-spawn'
import log from 'electron-log'
import type { InstallAdapterConfig } from '@shared/types'
import type { InstallAdapter, InstallResult } from './types'

const PIP_COMMAND = 'pip'

export const pipAdapter: InstallAdapter = {
  type: 'pip',
  displayName: 'pip / pipx / uvx',

  async detectRuntime(): Promise<boolean> {
    try {
      const result = await executeCommand(PIP_COMMAND, ['--version'])
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async checkInstalled(config: InstallAdapterConfig): Promise<boolean> {
    try {
      const result = await executeCommand(PIP_COMMAND, ['list', '--format=json'])
      if (result.exitCode !== 0) {
        return false
      }
      const packages = JSON.parse(result.stdout) as Array<{ name: string; version: string }>
      return packages.some((pkg) => pkg.name === config.package)
    } catch {
      return false
    }
  },

  async install(config: InstallAdapterConfig): Promise<boolean> {
    const args = ['install', config.package]
    if (config.version) {
      args.push(`${config.package}==${config.version}`)
    }
    if (config.args) {
      args.push(...config.args)
    }

    try {
      const result = await executeCommand(PIP_COMMAND, args)
      if (result.exitCode === 0) {
        log.info(
          `[installer:pip] installed ${config.package}${config.version ? `==${config.version}` : ''}`,
        )
        return true
      } else {
        log.warn(`[installer:pip] install failed for ${config.package}: ${result.stderr}`)
        return false
      }
    } catch (error) {
      log.error(`[installer:pip] install threw for ${config.package}:`, error)
      return false
    }
  },

  async uninstall(config: InstallAdapterConfig): Promise<boolean> {
    const args = ['uninstall', '-y', config.package]
    if (config.args) {
      args.push(...config.args)
    }

    try {
      const result = await executeCommand(PIP_COMMAND, args)
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async getRuntimeVersion(): Promise<string> {
    try {
      const result = await executeCommand(PIP_COMMAND, ['--version'])
      // pip 23.0.1 from ... -> extract version number
      const match = result.stdout.match(/pip (\d+\.\d+\.\d+)/)
      return match?.[1] ?? result.stdout.trim()
    } catch {
      return 'unknown'
    }
  },

  async getPackageVersion(config: InstallAdapterConfig): Promise<string | null> {
    try {
      const result = await executeCommand(PIP_COMMAND, ['list', '--format=json'])
      if (result.exitCode !== 0) {
        return null
      }
      const packages = JSON.parse(result.stdout) as Array<{ name: string; version: string }>
      const pkg = packages.find((p) => p.name === config.package)
      return pkg?.version ?? null
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
    log.debug(`[installer:pip] executing: ${command} ${args.join(' ')}`)
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
      log.debug(`[installer:pip] command exited with ${exitCode} in ${durationMs}ms`)
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
      log.debug(`[installer:pip] command errored in ${durationMs}ms:`, error)
      reject(new Error(`Command failed: ${error.message}`))
    })
  })
}
