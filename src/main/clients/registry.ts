/**
 * @file src/main/clients/registry.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Central registry of all client adapters. IPC handlers and
 * services look up adapters here rather than importing them directly. The map
 * is populated with the three Phase 1 adapters; Phase 2 (Step 18) adds the
 * remaining five (Windsurf, Claude Code, Zed, JetBrains, Codex CLI).
 */

import type { ClientId } from '@shared/types'
import type { ClientAdapter } from './types'
import { claudeDesktopAdapter } from './claude-desktop.adapter'
import { cursorAdapter } from './cursor.adapter'
import { vscodeAdapter } from './vscode.adapter'

/**
 * All registered client adapters indexed by `ClientId`.
 * Use `ADAPTERS.get(id)` to retrieve an adapter in IPC handlers and services.
 */
export const ADAPTERS: Readonly<Map<ClientId, ClientAdapter>> = new Map<ClientId, ClientAdapter>([
  ['claude-desktop', claudeDesktopAdapter],
  ['cursor', cursorAdapter],
  ['vscode', vscodeAdapter],
])

/**
 * Ordered list of all adapter IDs, used when iterating over all clients
 * (e.g. for `clients:detect-all` and `clients:sync-all`).
 */
export const ADAPTER_IDS: readonly ClientId[] = ['claude-desktop', 'cursor', 'vscode']
