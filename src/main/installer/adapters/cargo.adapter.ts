/**
 * @file src/main/installer/adapters/cargo.adapter.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Cargo (Rust) adapter for local MCP server installation.
 * Installs Rust binaries via `cargo install`.
 */

import spawn from 'cross-spawn'
import log from 'electron-log'
import type { InstallAdapterConfig } from '@shared/types'
import type { InstallAdapter, InstallResult } from './types'

const CARGO_COMMAND = 'cargo'

export const cargoAdapter: InstallAdapter = {
  type: 'cargo',
  displayName: 'Cargo (Rust)',

  async detectRuntime(): Promise<boolean> {
    try {
      const result = await executeCommand(CARGO_COMMAND, ['--version'])
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async checkInstalled(config: InstallAdapterConfig): Promise<boolean> {
    try {
      // cargo install --list outputs installed packages
      const result = await executeCommand(CARGO_COMMAND, ['install', '--list'])
      if (result.exitCode !== 0) {
        return false
      }
      // Each line is like "package_name v1.0.0:"
      const lines = result.stdout.split('\n')
      return lines.some((line) => line.trim().startsWith(`${config.package} `))
    } catch {
      return false
    }
  },

  async install(config: InstallAdapterConfig): Promise<boolean> {
    const args = ['install', config.package]
    if (config.version) {
      args.push('--version', config.version)
    }
    if (config.args) {
      args.push(...config.args)
    }

    try {
      const result = await executeCommand(CARGO_COMMAND, args)
      if (result.exitCode === 0) {
        log.info(
          `[installer:cargo] installed ${config.package}${config.version ? `@${config.version}` : ''}`,
        )
        return true
      } else {
        log.warn(`[installer:cargo] install failed for ${config.package}: ${result.stderr}`)
        return false
      }
    } catch (error) {
      log.error(`[installer:cargo] install threw for ${config.package}:`, error)
      return false
    }
  },

  async uninstall(config: InstallAdapterConfig): Promise<boolean> {
    // cargo uninstall removes a package
    const args = ['uninstall', config.package]
    if (config.args) {
      args.push(...config.args)
    }

    try {
      const result = await executeCommand(CARGO_COMMAND, args)
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async getRuntimeVersion(): Promise<string> {
    try {
      const result = await executeCommand(CARGO_COMMAND, ['--version'])
      // cargo 1.78.0 (xyz) -> extract version
      const match = result.stdout.match(/cargo (\d+\.\d+\.\d+)/)
      return match?.[1] ?? result.stdout.trim()
    } catch {
      return 'unknown'
    }
  },

  async getPackageVersion(config: InstallAdapterConfig): Promise<string | null> {
    try {
      const result = await executeCommand(CARGO_COMMAND, ['install', '--list'])
      if (result.exitCode !== 0) {
        return null
      }
      const lines = result.stdout.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith(`${config.package} v`)) {
          // format: "package_name v1.0.0:"
          const match = trimmed.match(/v(\d+\.\d+\.\d+)/)
          return match?.[1] ?? null
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
    log.debug(`[installer:cargo] executing: ${command} ${args.join(' ')}`)
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
      log.debug(`[installer:cargo] command exited with ${exitCode} in ${durationMs}ms`)
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
      log.debug(`[installer:cargo] command errored in ${durationMs}ms:`, error)
      reject(new Error(`Command failed: ${error.message}`))
    })
  })
}
