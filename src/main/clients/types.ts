/**
 * @file src/main/clients/types.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description ClientAdapter interface and supporting types for the main-process
 * client integration layer. Each supported AI tool implements this interface so
 * the rest of the codebase can work with all clients through a single contract.
 */

import type { ClientId, ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'

// ─── Schema Key Types ─────────────────────────────────────────────────────────

/**
 * The JSON key used by a client to store its MCP server map.
 * Different clients use different keys — Claude Desktop, Cursor, and Windsurf
 * use `mcpServers`, VS Code/Visual Studio use `servers`, OpenCode uses `mcp`,
 * and Zed uses `context_servers`.
 */
export type McpSchemaKey = 'mcpServers' | 'servers' | 'context_servers' | 'mcp'

// ─── Adapter Interface ────────────────────────────────────────────────────────

/**
 * Common contract for every AI tool client adapter. Each adapter knows how to
 * locate, read, write, and validate config for one specific tool.
 *
 * Adapters are stateless — they hold no runtime state beyond their constants.
 * All methods are async so file I/O never blocks the event loop.
 */
export interface ClientAdapter {
  /** Stable identifier matching the shared `ClientId` union. */
  readonly id: ClientId

  /** Human-readable name displayed in the UI (e.g. "Claude Desktop"). */
  readonly displayName: string

  /**
   * The JSON top-level key that holds the MCP server map in this client's
   * config file. Used by `read()` and `write()` to extract / inject the
   * correct section without touching unrelated config fields.
   */
  readonly schemaKey: McpSchemaKey

  /**
   * Checks whether this client is installed on the current machine.
   * Returns the config paths found, plus the count of servers already
   * present in those configs.
   *
   * @returns Detection result including install status and config paths.
   */
  detect(): Promise<ClientDetectionResult>

  /**
   * Reads and returns the MCP server map from the given config file.
   * Returns an empty object if the file does not contain any servers.
   *
   * @param configPath - Absolute path to the client's config file.
   * @returns A map of server name → raw server config.
   */
  read(configPath: string): Promise<McpServerMap>

  /**
   * Writes the given server map into the client's config file, merging with
   * any existing non-MCP keys rather than replacing the entire file.
   * Uses an atomic write (`.aidrelay.tmp` → rename) per the safety spec.
   *
   * @param configPath - Absolute path to the client's config file.
   * @param servers - The server map to write under `schemaKey`.
   */
  write(configPath: string, servers: McpServerMap): Promise<void>

  /**
   * Validates that the file at the given path is syntactically correct
   * and structurally matches what this client expects.
   *
   * @param configPath - Absolute path to the client's config file.
   * @returns Validation result with an errors array (empty = valid).
   */
  validate(configPath: string): Promise<ValidationResult>
}
