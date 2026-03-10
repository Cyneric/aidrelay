/**
 * @file src/main/installer/preflight.service.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Preflight service for local MCP server installation.
 * Runs runtime detection, command availability checks, and verifies
 * writable paths before attempting installation.
 */

import spawn from 'cross-spawn'
import log from 'electron-log'
import type {
  RuntimeDetectionConfig,
  PreflightResult,
  PreflightReport,
  InstallRecipe,
} from '@shared/types'
import { ADAPTERS } from './adapters/registry'

export class PreflightService {
  /**
   * Run preflight checks for a given install recipe.
   * Returns a report with success/failure and actionable suggestions.
   */
  async run(recipe: InstallRecipe): Promise<PreflightReport> {
    const checks: PreflightResult[] = []
    const missingRuntimes: RuntimeDetectionConfig[] = []

    // 1. Runtime detection checks
    for (const detection of recipe.runtimeDetection) {
      const result = await this.checkRuntimeDetection(detection)
      checks.push(result)
      if (!result.success) {
        missingRuntimes.push(detection)
      }
    }

    // 2. Adapter runtime availability
    for (const adapterConfig of recipe.adapters) {
      const adapter = ADAPTERS.get(adapterConfig.type)
      if (!adapter) {
        checks.push({
          id: `adapter-${adapterConfig.type}`,
          description: `Install adapter ${adapterConfig.type} not supported`,
          success: false,
          message: `Adapter ${adapterConfig.type} is not available in this version of aidrelay.`,
          ...{ hint: 'Update aidrelay or choose a different installation method.' },
        })
        missingRuntimes.push({
          type: 'command',
          check: adapterConfig.type,
          hint: `Package manager ${adapterConfig.type} is not supported.`,
        })
        continue
      }

      const runtimeAvailable = await adapter.detectRuntime()
      const result: PreflightResult = {
        id: `adapter-${adapterConfig.type}`,
        description: `Detect ${adapterConfig.type} runtime`,
        success: runtimeAvailable,
        message: runtimeAvailable
          ? `${adapterConfig.type} is available`
          : `${adapterConfig.type} is not installed or not in PATH`,
        ...(!runtimeAvailable && {
          hint:
            adapterConfig.type === 'winget'
              ? 'Install winget from the Microsoft Store'
              : `Install ${adapterConfig.type} and ensure it's in your PATH`,
        }),
      }
      checks.push(result)
      if (!runtimeAvailable) {
        missingRuntimes.push({
          type: 'command',
          check: adapterConfig.type,
          hint: `Install ${adapterConfig.type} to proceed.`,
          installHint:
            adapterConfig.type === 'winget'
              ? 'Install from Microsoft Store'
              : `Download ${adapterConfig.type} from official website`,
        })
      }
    }

    // 3. Writable path checks (optional)
    // TODO: Check if we can write to the installation directories

    const success = missingRuntimes.length === 0
    const suggestions = this.generateSuggestions(missingRuntimes)

    return {
      serverId: '', // caller must fill
      recipeId: recipe.id,
      recipeVersion: recipe.version,
      checks,
      success,
      missingRuntimes,
      suggestions,
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  private async checkRuntimeDetection(detection: RuntimeDetectionConfig): Promise<PreflightResult> {
    const id = `${detection.type}:${detection.check}`
    const description = `Check ${detection.check}`

    try {
      let success = false
      let message = ''

      switch (detection.type) {
        case 'command': {
          const result = await this.checkCommandExists(detection.check)
          success = result
          message = result
            ? `Command '${detection.check}' is available`
            : `Command '${detection.check}' not found in PATH`
          break
        }
        case 'path': {
          // TODO: implement path existence check
          success = false
          message = 'Path detection not yet implemented'
          break
        }
        case 'registry': {
          // TODO: implement Windows registry check
          success = false
          message = 'Registry detection not yet implemented'
          break
        }
        case 'process': {
          // TODO: implement process running check
          success = false
          message = 'Process detection not yet implemented'
          break
        }
      }

      return {
        id,
        description,
        success,
        message,
        ...(!success && { hint: detection.hint }),
      }
    } catch (error) {
      log.error(`[preflight] runtime detection failed for ${id}:`, error)
      return {
        id,
        description,
        success: false,
        message: `Check failed: ${String(error)}`,
        ...(detection.hint && { hint: detection.hint }),
      }
    }
  }

  private async checkCommandExists(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('where', [command], {
        stdio: 'pipe',
        windowsHide: true,
      })
      child.on('close', (exitCode) => {
        resolve(exitCode === 0)
      })
      child.on('error', () => {
        resolve(false)
      })
    })
  }

  private generateSuggestions(missingRuntimes: RuntimeDetectionConfig[]): string[] {
    const suggestions: string[] = []
    for (const runtime of missingRuntimes) {
      if (runtime.installHint) {
        suggestions.push(runtime.installHint)
      } else {
        suggestions.push(`Install ${runtime.check}: ${runtime.hint}`)
      }
    }
    return suggestions
  }
}
