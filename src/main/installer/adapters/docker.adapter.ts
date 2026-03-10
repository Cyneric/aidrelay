/**
 * @file src/main/installer/adapters/docker.adapter.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Docker adapter for local MCP server installation.
 * Pulls Docker images via `docker pull`.
 */

import spawn from 'cross-spawn'
import log from 'electron-log'
import type { InstallAdapterConfig } from '@shared/types'
import type { InstallAdapter, InstallResult } from './types'

const DOCKER_COMMAND = 'docker'

export const dockerAdapter: InstallAdapter = {
  type: 'docker',
  displayName: 'Docker',

  async detectRuntime(): Promise<boolean> {
    try {
      const result = await executeCommand(DOCKER_COMMAND, ['--version'])
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async checkInstalled(config: InstallAdapterConfig): Promise<boolean> {
    try {
      const result = await executeCommand(DOCKER_COMMAND, [
        'image',
        'ls',
        '--format={{.Repository}}:{{.Tag}}',
      ])
      if (result.exitCode !== 0) {
        return false
      }
      const images = result.stdout.split('\n').map((line) => line.trim())
      const target = config.version ? `${config.package}:${config.version}` : config.package
      return images.some((image) => image === target)
    } catch {
      return false
    }
  },

  async install(config: InstallAdapterConfig): Promise<boolean> {
    const target = config.version ? `${config.package}:${config.version}` : config.package
    const args = ['pull', target]
    if (config.args) {
      args.push(...config.args)
    }

    try {
      const result = await executeCommand(DOCKER_COMMAND, args)
      if (result.exitCode === 0) {
        log.info(`[installer:docker] pulled ${target}`)
        return true
      } else {
        log.warn(`[installer:docker] pull failed for ${target}: ${result.stderr}`)
        return false
      }
    } catch (error) {
      log.error(`[installer:docker] pull threw for ${target}:`, error)
      return false
    }
  },

  async uninstall(config: InstallAdapterConfig): Promise<boolean> {
    const target = config.version ? `${config.package}:${config.version}` : config.package
    const args = ['rmi', target]
    if (config.args) {
      args.push(...config.args)
    }

    try {
      const result = await executeCommand(DOCKER_COMMAND, args)
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async getRuntimeVersion(): Promise<string> {
    try {
      const result = await executeCommand(DOCKER_COMMAND, ['--version'])
      // Docker version 24.0.7, build ...
      const match = result.stdout.match(/Docker version (\d+\.\d+\.\d+)/)
      return match?.[1] ?? result.stdout.trim()
    } catch {
      return 'unknown'
    }
  },

  async getPackageVersion(config: InstallAdapterConfig): Promise<string | null> {
    try {
      const result = await executeCommand(DOCKER_COMMAND, [
        'image',
        'inspect',
        '--format={{.RepoTags}}',
        config.package,
      ])
      if (result.exitCode !== 0) {
        return null
      }
      // output like "[ghcr.io/org/image:latest]"
      const match = result.stdout.match(/:([^:\]]+)/)
      return match?.[1] ?? null
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
    log.debug(`[installer:docker] executing: ${command} ${args.join(' ')}`)
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
      log.debug(`[installer:docker] command exited with ${exitCode} in ${durationMs}ms`)
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
      log.debug(`[installer:docker] command errored in ${durationMs}ms:`, error)
      reject(new Error(`Command failed: ${error.message}`))
    })
  })
}
