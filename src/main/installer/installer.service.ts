/**
 * @file src/main/installer/installer.service.ts
 *
 * @created 09.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Stateful installer service for local MCP servers. Manages
 * runtime detection, preflight checks, package manager installation,
 * and rollback. Follows a typed state machine pattern with atomic
 * rollback steps.
 */

import { EventEmitter } from 'events'
import os from 'os'
import log from 'electron-log'
import type {
  InstallPlan,
  PreflightReport,
  DeviceSetupState,
  InstallProgressPayload,
  RuntimeDetectionConfig,
  InstallStep,
  LogEntry,
} from '@shared/types'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { DeviceSetupStateRepo } from '@main/db/device-setup-state.repo'
import { PreflightService } from './preflight.service'
import { RecipeResolverService } from './recipe-resolver.service'
import { RollbackService } from './rollback.service'
import { ADAPTERS } from './adapters/registry'
import { ServerTesterService } from '@main/testing/server-tester.service'

// ─── State Machine ──────────────────────────────────────────────────────────────

type InstallState =
  | 'idle'
  | 'preflight'
  | 'installing'
  | 'verifying'
  | 'rolling_back'
  | 'success'
  | 'failed'

interface InstallContext {
  readonly serverId: string
  readonly recipeId: string
  readonly recipeVersion: string
  readonly createdAt: string
  readonly state: InstallState
  readonly installStatus: DeviceSetupState['installStatus']
  readonly progress: number
  readonly logs: readonly LogEntry[]
  readonly runtimeDetectionResults: Readonly<Record<string, boolean>>
  readonly missingRuntimes: readonly RuntimeDetectionConfig[]
}

// ─── Service Interface ──────────────────────────────────────────────────────────

export class InstallerService extends EventEmitter {
  private readonly serversRepo: ServersRepo
  private readonly deviceSetupStateRepo: DeviceSetupStateRepo
  private readonly preflightService: PreflightService
  private readonly recipeResolver: RecipeResolverService
  private readonly rollbackService: RollbackService
  private readonly serverTesterService: ServerTesterService
  private readonly deviceId: string
  private activeInstallations: Map<string, InstallContext> = new Map()

  constructor() {
    super()
    const db = getDatabase()
    this.serversRepo = new ServersRepo(db)
    this.deviceSetupStateRepo = new DeviceSetupStateRepo(db)
    this.preflightService = new PreflightService()
    this.recipeResolver = new RecipeResolverService()
    this.rollbackService = new RollbackService()
    this.serverTesterService = new ServerTesterService()
    // Derive a stable device identifier from the machine's hostname.
    // This is used to isolate per‑device installation state.
    this.deviceId = os.hostname()
  }

  /**
   * Prepare an install plan for a given server ID.
   * Returns a plan with steps and estimated duration.
   */
  async prepare(serverId: string): Promise<InstallPlan> {
    log.debug(`[installer] prepare for server ${serverId}`)
    const server = this.serversRepo.findById(serverId)
    if (!server) {
      throw new Error(`Server not found: ${serverId}`)
    }

    const recipe = await this.recipeResolver.resolve(serverId, server.recipeId || '')
    const steps: InstallStep[] = []

    // Step 1: Detect runtimes
    if (recipe.runtimeDetection.length > 0) {
      steps.push({
        id: 'detect',
        description: 'Detect required runtimes',
        action: 'detect',
      })
    }

    // Step 2: Install via adapters (pick highest priority adapter that is available)
    const availableAdapters = recipe.adapters
      .filter((adapter) => ADAPTERS.has(adapter.type))
      .sort((a, b) => b.priority - a.priority)

    if (availableAdapters.length > 0) {
      const primaryAdapter = availableAdapters[0]!
      const step: InstallStep = {
        id: `install-${primaryAdapter.type}`,
        description: `Install server via ${primaryAdapter.type}`,
        action: 'install',
        adapterType: primaryAdapter.type,
        ...(primaryAdapter.command && { command: primaryAdapter.command }),
        ...(primaryAdapter.args && { args: primaryAdapter.args }),
        ...(primaryAdapter.env && { env: primaryAdapter.env }),
      }
      steps.push(step)
    }

    // Step 3: Configure launch environment (always present)
    steps.push({
      id: 'configure',
      description: 'Configure launch environment',
      action: 'configure',
    })

    // Step 4: Verify installation (always present)
    steps.push({
      id: 'verify',
      description: 'Verify installation',
      action: 'verify',
    })

    // Estimate duration: 2 minutes baseline + 1 minute per adapter
    const estimatedDuration = 120 + availableAdapters.length * 60
    // Requires elevation if any adapter type is winget (may need admin)
    const requiresElevation = availableAdapters.some((adapter) => adapter.type === 'winget')

    return {
      serverId,
      recipeId: recipe.id,
      recipeVersion: recipe.version,
      steps,
      estimatedDuration,
      requiresElevation,
    }
  }

  /**
   * Run preflight checks for a server.
   * Returns a report with success/failure and actionable suggestions.
   */
  async preflight(serverId: string): Promise<PreflightReport> {
    log.debug(`[installer] preflight for server ${serverId}`)
    const server = this.serversRepo.findById(serverId)
    if (!server) {
      throw new Error(`Server not found: ${serverId}`)
    }

    const recipe = await this.recipeResolver.resolve(serverId, server.recipeId || '')
    const report = await this.preflightService.run(recipe)
    // Fill in the server ID (preflight service doesn't know it)
    return {
      ...report,
      serverId,
    }
  }

  /**
   * Execute the installation plan for a server.
   * Emits progress events via `installer:progress` push channel.
   */
  async run(serverId: string): Promise<void> {
    log.debug(`[installer] run for server ${serverId}`)
    const plan = await this.prepare(serverId)
    const report = await this.preflight(serverId)

    if (!report.success) {
      throw new Error(`Preflight failed: ${report.missingRuntimes.map((r) => r.hint).join(', ')}`)
    }

    const server = this.serversRepo.findById(serverId)
    if (!server) {
      throw new Error(`Server not found: ${serverId}`)
    }

    // Create installation context
    let ctx: InstallContext = {
      serverId,
      recipeId: plan.recipeId,
      recipeVersion: plan.recipeVersion,
      createdAt: new Date().toISOString(),
      state: 'installing',
      installStatus: 'running',
      progress: 0,
      logs: [],
      runtimeDetectionResults: {},
      missingRuntimes: [],
    }
    this.activeInstallations.set(serverId, ctx)
    this.addLog(serverId, 'info', 'Starting installation')

    try {
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i]!
        this.emitProgress(serverId, step.description, i, plan.steps.length)
        this.addLog(serverId, 'info', `Executing step: ${step.description}`)

        // Execute step
        await this.executeStep(serverId, step)
        this.addLog(serverId, 'info', `Step completed: ${step.description}`)
        // Refresh local ctx after logs
        ctx = this.activeInstallations.get(serverId)!

        // Register rollback step if reversible
        const rollbackStep = this.rollbackService.createRollbackStepFromInstallStep(step)
        if (rollbackStep) {
          this.rollbackService.register(rollbackStep)
        }
      }

      // Verify installation
      this.emitProgress(serverId, 'Verifying installation', plan.steps.length, plan.steps.length)
      this.addLog(serverId, 'info', 'Verifying installation')
      const testResult = await this.serverTesterService.testServer(server)
      if (!testResult.success) {
        throw new Error(`Server verification failed: ${testResult.message}`)
      }
      this.addLog(serverId, 'info', 'Installation verified successfully')
      ctx = this.activeInstallations.get(serverId)!
      // Update install status to success
      ctx = { ...ctx, installStatus: 'success' }
      this.activeInstallations.set(serverId, ctx)
      this.addLog(serverId, 'info', 'Installation completed successfully')
      ctx = this.activeInstallations.get(serverId)!

      // Commit rollback steps
      this.rollbackService.commit()

      this.emitProgress(serverId, 'Installation completed', plan.steps.length, plan.steps.length)
    } catch (error) {
      log.error(`[installer] installation failed for ${serverId}:`, error)
      // Update installation status to failed and log error
      const ctx = this.activeInstallations.get(serverId)
      if (ctx) {
        const newCtx: InstallContext = { ...ctx, installStatus: 'failed' }
        this.activeInstallations.set(serverId, newCtx)
        this.addLog(
          serverId,
          'error',
          `Installation failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      await this.rollbackService.rollbackAll()
      throw error
    } finally {
      this.activeInstallations.delete(serverId)
    }
  }

  /**
   * Execute a single installation step.
   */
  private async executeStep(serverId: string, step: InstallStep): Promise<void> {
    const server = this.serversRepo.findById(serverId)
    if (!server) {
      throw new Error(`Server not found: ${serverId}`)
    }

    switch (step.action) {
      case 'detect':
        // Already done in preflight, nothing to do
        break
      case 'install':
        await this.executeInstallStep(serverId, step)
        break
      case 'configure':
        await this.executeConfigureStep(serverId, step)
        break
      case 'verify':
        // Verification is done after all steps
        break
      default:
        throw new Error(`Unknown step action: ${(step as { action: string }).action}`)
    }
  }

  /**
   * Execute an installation step via an adapter.
   */
  private async executeInstallStep(serverId: string, step: InstallStep): Promise<void> {
    if (!step.adapterType) {
      throw new Error(`Install step missing adapterType`)
    }
    const adapterType = step.adapterType

    const server = this.serversRepo.findById(serverId)
    if (!server) {
      throw new Error(`Server not found: ${serverId}`)
    }
    const recipe = await this.recipeResolver.resolve(serverId, server.recipeId || '')
    const adapterConfig = recipe.adapters.find((adapter) => adapter.type === adapterType)
    if (!adapterConfig) {
      throw new Error(`No adapter config found for type ${adapterType}`)
    }

    const adapter = ADAPTERS.get(adapterType)
    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterType}`)
    }

    const installed = await adapter.install(adapterConfig)
    if (!installed) {
      throw new Error(`Installation via ${adapterType} failed`)
    }

    // Register rollback step
    const rollbackStep = this.rollbackService.createPackageInstallRollback(
      adapterType,
      adapterConfig.package,
      () => adapter.uninstall(adapterConfig),
    )
    this.rollbackService.register(rollbackStep)
  }

  /**
   * Execute a configuration step (write client configs).
   */
  private async executeConfigureStep(serverId: string, _step: InstallStep): Promise<void> {
    // TODO: Implement configuration step
    log.debug(`[installer] configure step for server ${serverId}`)
    await Promise.resolve()
  }

  /**
   * Cancel an ongoing installation.
   */
  async cancel(serverId: string): Promise<void> {
    log.debug(`[installer] cancel for server ${serverId}`)
    await Promise.resolve()
    const ctx = this.activeInstallations.get(serverId)
    if (!ctx) {
      throw new Error(`No active installation for server: ${serverId}`)
    }
    // TODO: Implement cancellation logic
  }

  /**
   * Get current installation status for a server.
   */
  async status(serverId: string): Promise<DeviceSetupState | null> {
    log.debug(`[installer] status for server ${serverId}`)
    await Promise.resolve()
    return this.deviceSetupStateRepo.findByServerId(this.deviceId, serverId)
  }

  /**
   * Repair a server by rerunning missing steps.
   */
  async repair(serverId: string): Promise<InstallPlan> {
    log.debug(`[installer] repair for server ${serverId}`)
    const existingState = await this.status(serverId)
    if (existingState) {
      log.debug(`[installer] existing install status: ${existingState.installStatus}`)
    }
    const plan = await this.prepare(serverId)
    // TODO: Determine which steps need repair based on device_setup_state and runtime detection
    // For now, return the full plan; the preflight step will identify missing runtimes.
    return plan
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  private emitProgress(
    serverId: string,
    message: string,
    step: number,
    totalSteps: number,
    details?: string,
  ): void {
    const payload: InstallProgressPayload = {
      serverId,
      step: message,
      progress: totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0,
      totalSteps,
      message,
      ...(details ? { details } : {}),
    }
    this.emit('progress', payload)
    log.debug(`[installer] progress: ${serverId} ${step}/${totalSteps} ${message}`)
  }

  private addLog(
    serverId: string,
    level: LogEntry['level'],
    message: string,
    details?: unknown,
  ): void {
    const ctx = this.activeInstallations.get(serverId)
    if (!ctx) {
      log.warn(`[installer] cannot add log for inactive installation: ${serverId}`)
      return
    }
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
    }
    const newLogs = [...ctx.logs, entry]
    const newCtx: InstallContext = {
      ...ctx,
      logs: newLogs,
    }
    this.activeInstallations.set(serverId, newCtx)

    const now = new Date().toISOString()
    const deviceSetupState: DeviceSetupState = {
      deviceId: this.deviceId,
      serverId,
      runtimeDetectionResults: ctx.runtimeDetectionResults,
      logs: newLogs,
      installStatus: ctx.installStatus,
      createdAt: ctx.createdAt,
      updatedAt: now,
    }
    this.deviceSetupStateRepo.upsert(deviceSetupState)
  }
}
