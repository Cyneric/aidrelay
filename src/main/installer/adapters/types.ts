/**
 * @file src/main/installer/adapters/types.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Install adapter interface and supporting types for local MCP
 * server installation. Each package manager / installation method implements
 * this interface so the installer engine can work with all adapters through
 * a single contract.
 */

import type { InstallAdapterConfig, InstallAdapterType } from '@shared/types'

// ─── Adapter Interface ────────────────────────────────────────────────────────

/**
 * Common contract for every installation adapter. Each adapter knows how to
 * check if a package is already installed, install it, and uninstall it.
 *
 * Adapters are stateless — they hold no runtime state beyond their constants.
 * All methods are async so subprocess execution never blocks the event loop.
 */
export interface InstallAdapter {
  /** Stable identifier matching the shared `InstallAdapterType` union. */
  readonly type: InstallAdapterType

  /** Human-readable name displayed in the UI (e.g., "winget"). */
  readonly displayName: string

  /**
   * Checks whether the required runtime (package manager) is available
   * on the current machine. This is a pre‑flight check, not a package‑level
   * check.
   *
   * @returns True if the runtime is detected and ready to use.
   */
  detectRuntime(): Promise<boolean>

  /**
   * Checks whether a specific package is already installed.
   * This is a lightweight check (e.g., `winget list`, `npm list -g`).
   *
   * @param config – Adapter config extracted from the install recipe.
   * @returns True if the package is installed at a compatible version.
   */
  checkInstalled(config: InstallAdapterConfig): Promise<boolean>

  /**
   * Installs the package described by the adapter config.
   * Must be idempotent — calling install when already installed should succeed.
   *
   * @param config – Adapter config extracted from the install recipe.
   * @returns True if installation succeeded, false if failed.
   */
  install(config: InstallAdapterConfig): Promise<boolean>

  /**
   * Uninstalls the package described by the adapter config.
   *
   * @param config – Adapter config extracted from the install recipe.
   * @returns True if uninstallation succeeded, false if failed.
   */
  uninstall(config: InstallAdapterConfig): Promise<boolean>

  /**
   * Returns the version of the package manager itself (e.g., `winget --version`).
   * Used for diagnostics and pre‑flight reporting.
   */
  getRuntimeVersion(): Promise<string>

  /**
   * Returns the installed version of a specific package, if available.
   * Should return `null` if the package is not installed.
   *
   * @param config – Adapter config extracted from the install recipe.
   * @returns Installed version string, or `null` if not found.
   */
  getPackageVersion(config: InstallAdapterConfig): Promise<string | null>
}

// ─── Helper Types ─────────────────────────────────────────────────────────────

/**
 * Result of a runtime detection check.
 */
export interface RuntimeDetectionResult {
  readonly runtimeAvailable: boolean
  readonly version?: string
  readonly hint?: string
}

/**
 * Result of a package installation attempt.
 */
export interface InstallResult {
  readonly success: boolean
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
  readonly durationMs: number
}
