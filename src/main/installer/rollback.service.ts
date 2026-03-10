/**
 * @file src/main/installer/rollback.service.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Atomic rollback service for local MCP server installation.
 * Tracks reversible steps (config writes, server registration, package installs)
 * and can revert them in reverse order if any step fails.
 */

import log from 'electron-log'
import type { InstallStep } from '@shared/types'

export type RollbackAction = () => Promise<void>

export interface RollbackStep {
  readonly id: string
  readonly description: string
  readonly rollback: RollbackAction
}

export class RollbackService {
  private steps: RollbackStep[] = []
  private committed = false

  /**
   * Register a reversible step.
   * The rollback action will be called if `rollbackAll` is invoked before
   * `commit`. Steps are rolled back in reverse order of registration.
   */
  register(step: RollbackStep): void {
    if (this.committed) {
      throw new Error('Cannot register rollback steps after commit')
    }
    this.steps.push(step)
    log.debug(`[rollback] registered step ${step.id}: ${step.description}`)
  }

  /**
   * Commit all steps, discarding rollback information.
   * After commit, no further rollbacks are possible for these steps.
   */
  commit(): void {
    log.debug(`[rollback] committing ${this.steps.length} steps`)
    this.steps = []
    this.committed = true
  }

  /**
   * Roll back all registered steps in reverse order.
   * Logs errors but continues rolling back remaining steps.
   * After rollback, the service is reset and can be reused.
   */
  async rollbackAll(): Promise<void> {
    if (this.committed) {
      log.warn('[rollback] attempt to rollback after commit — ignoring')
      return
    }
    log.info(`[rollback] rolling back ${this.steps.length} steps`)
    const steps = [...this.steps].reverse()
    this.steps = []
    this.committed = false

    for (const step of steps) {
      try {
        log.debug(`[rollback] rolling back step ${step.id}`)
        await step.rollback()
      } catch (error) {
        log.error(`[rollback] failed to rollback step ${step.id}:`, error)
        // continue with other steps
      }
    }
  }

  /**
   * Convert an `InstallStep` into a rollback step that can be registered.
   * This is a convenience method for the installer service.
   */
  createRollbackStepFromInstallStep(_installStep: InstallStep): RollbackStep | null {
    // TODO: map install step to concrete rollback actions
    return null
  }

  /**
   * Create a rollback step for a config file write (client config).
   * The rollback action restores the previous version from backup.
   */
  createConfigWriteRollback(
    clientId: string,
    configPath: string,
    backupPath: string,
  ): RollbackStep {
    return {
      id: `config-write-${clientId}`,
      description: `Restore client config ${clientId} from backup`,
      rollback: async () => {
        log.debug(`[rollback] restoring config ${configPath} from ${backupPath}`)
        await Promise.resolve()
        // TODO: implement actual file restoration
      },
    }
  }

  /**
   * Create a rollback step for a package installation (via adapter).
   * The rollback action uninstalls the package.
   */
  createPackageInstallRollback(
    adapterType: string,
    packageName: string,
    uninstallFn: () => Promise<boolean>,
  ): RollbackStep {
    return {
      id: `package-uninstall-${adapterType}-${packageName}`,
      description: `Uninstall package ${packageName} via ${adapterType}`,
      rollback: async () => {
        log.debug(`[rollback] uninstalling ${packageName} via ${adapterType}`)
        const success = await uninstallFn()
        if (!success) {
          log.warn(`[rollback] uninstall of ${packageName} may have failed`)
        }
      },
    }
  }
}
