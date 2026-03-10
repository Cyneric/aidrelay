/**
 * @file src/main/clients/registry.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Central registry of all client adapters. IPC handlers and
 * services look up adapters here rather than importing them directly.
 */

import type { ClientId } from '@shared/types'
import type { ClientAdapter } from './types'
import { claudeDesktopAdapter } from './claude-desktop.adapter'
import { claudeCodeAdapter } from './claude-code.adapter'
import { cursorAdapter } from './cursor.adapter'
import { vscodeAdapter } from './vscode.adapter'
import { vscodeInsidersAdapter } from './vscode-insiders.adapter'
import { windsurfAdapter } from './windsurf.adapter'
import { zedAdapter } from './zed.adapter'
import { jetbrainsAdapter } from './jetbrains.adapter'
import { geminiCliAdapter } from './gemini-cli.adapter'
import { codexCliAdapter } from './codex-cli.adapter'
import { codexGuiAdapter } from './codex-gui.adapter'
import { opencodeAdapter } from './opencode.adapter'
import { visualStudioAdapter } from './visual-studio.adapter'

/**
 * All registered client adapters indexed by `ClientId`.
 * Use `ADAPTERS.get(id)` to retrieve an adapter in IPC handlers and services.
 */
export const ADAPTERS: Readonly<Map<ClientId, ClientAdapter>> = new Map<ClientId, ClientAdapter>([
  ['claude-desktop', claudeDesktopAdapter],
  ['claude-code', claudeCodeAdapter],
  ['cursor', cursorAdapter],
  ['vscode', vscodeAdapter],
  ['vscode-insiders', vscodeInsidersAdapter],
  ['windsurf', windsurfAdapter],
  ['zed', zedAdapter],
  ['jetbrains', jetbrainsAdapter],
  ['gemini-cli', geminiCliAdapter],
  ['codex-cli', codexCliAdapter],
  ['codex-gui', codexGuiAdapter],
  ['opencode', opencodeAdapter],
  ['visual-studio', visualStudioAdapter],
])

/**
 * Ordered list of all adapter IDs, used when iterating over all clients
 * (e.g. for `clients:detect-all` and `clients:sync-all`).
 */
export const ADAPTER_IDS: readonly ClientId[] = [
  'claude-desktop',
  'claude-code',
  'cursor',
  'vscode',
  'vscode-insiders',
  'windsurf',
  'zed',
  'jetbrains',
  'gemini-cli',
  'codex-cli',
  'codex-gui',
  'opencode',
  'visual-studio',
]
