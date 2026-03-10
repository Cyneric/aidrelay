/**
 * @file src/renderer/components/common/icons/client-icon-mapping.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Maps ClientId values to icon sources (png assets,
 * custom SVG paths, or fallback Lucide icons). All supported clients
 * are enumerated here with exhaustive type checking.
 */

import type { ClientId } from '@shared/types'

// Import all custom icon assets from Icons8
import vscodeIconDark from '@/assets/client-icons/vscode_dark.png'
import vscodeIconLight from '@/assets/client-icons/vscode_light.png'
import vscodeInsidersIconDark from '@/assets/client-icons/vscode_insiders_dark.png'
import vscodeInsidersIconLight from '@/assets/client-icons/vscode_insiders_light.png'
import visualStudioIconDark from '@/assets/client-icons/visual-studio_dark.png'
import visualStudioIconLight from '@/assets/client-icons/visual-studio_light.png'
import opencodeIconDark from '@/assets/client-icons/opencode_dark.png'
import opencodeIconLight from '@/assets/client-icons/opencode_light.png'
import claudeIconDark from '@/assets/client-icons/claude_dark.png'
import claudeIconLight from '@/assets/client-icons/claude_light.png'
import clineIconDark from '@/assets/client-icons/cline_dark.png'
import clineIconLight from '@/assets/client-icons/cline_light.png'
import cursorIconDark from '@/assets/client-icons/cursor_dark.png'
import cursorIconLight from '@/assets/client-icons/cursor_light.png'
import windsurfIconDark from '@/assets/client-icons/windsurf_dark.png'
import windsurfIconLight from '@/assets/client-icons/windsurf_light.png'
import zedIconDark from '@/assets/client-icons/zed_dark.png'
import zedIconLight from '@/assets/client-icons/zed_light.png'
import rooCodeIconDark from '@/assets/client-icons/roocode_dark.png'
import rooCodeIconLight from '@/assets/client-icons/roocode_light.png'
import jetbrainsIconDark from '@/assets/client-icons/jetbrains_dark.png'
import jetbrainsIconLight from '@/assets/client-icons/jetbrains_light.png'
import codexIconDark from '@/assets/client-icons/codex_dark.png'
import codexIconLight from '@/assets/client-icons/codex_light.png'
import geminiIconDark from '@/assets/client-icons/gemini_dark.png'
import geminiIconLight from '@/assets/client-icons/gemini_light.png'
import kiloCodeIconDark from '@/assets/client-icons/kilocode_dark.png'
import kiloCodeIconLight from '@/assets/client-icons/kilocode_light.png'

// ─── Icon Source Types ──────────────────────────────────────────────────────────

/**
 * Source of an icon for a client.
 * - `custom`: Custom PNG asset from Icons8 stored in `src/renderer/assets/client-icons/`
 * - `fallback`: Generic icon from lucide-react when no brand icon exists (not used for now)
 */
export type IconSource =
  | {
      readonly type: 'custom'
      readonly name: string
      readonly pathDark: string
      readonly pathLight: string
    }
  | { readonly type: 'fallback'; readonly name: string; readonly lucideIcon: string }

// ─── Client → Icon Mapping ──────────────────────────────────────────────────────

/**
 * Maps each ClientId to its icon source.
 *
 * All client icons are custom PNG assets from Icons8 for consistent style.
 */
export const CLIENT_ICON_MAP: Record<ClientId, IconSource> = {
  // Claude Desktop & Claude Code — AI/robot icon
  'claude-desktop': {
    type: 'custom',
    name: 'claude',
    pathDark: claudeIconDark,
    pathLight: claudeIconLight,
  },
  'claude-code': {
    type: 'custom',
    name: 'claude',
    pathDark: claudeIconDark,
    pathLight: claudeIconLight,
  },
  cline: {
    type: 'custom',
    name: 'cline',
    pathDark: clineIconDark,
    pathLight: clineIconLight,
  },
  'roo-code': {
    type: 'custom',
    name: 'roo-code',
    pathDark: rooCodeIconDark,
    pathLight: rooCodeIconLight,
  },

  // Cursor — cursor icon
  cursor: {
    type: 'custom',
    name: 'cursor',
    pathDark: cursorIconDark,
    pathLight: cursorIconLight,
  },

  // VS Code — custom icon from Icons8
  vscode: {
    type: 'custom',
    name: 'visual-studio-code',
    pathDark: vscodeIconDark,
    pathLight: vscodeIconLight,
  },

  // VS Code Insiders — custom icon (same as VS Code for now)
  'vscode-insiders': {
    type: 'custom',
    name: 'visual-studio-code-insiders',
    pathDark: vscodeInsidersIconDark,
    pathLight: vscodeInsidersIconLight,
  },

  // Windsurf — web design icon
  windsurf: {
    type: 'custom',
    name: 'windsurf',
    pathDark: windsurfIconDark,
    pathLight: windsurfIconLight,
  },

  // Zed — source code icon
  zed: {
    type: 'custom',
    name: 'zed',
    pathDark: zedIconDark,
    pathLight: zedIconLight,
  },

  // JetBrains — IntelliJ IDE icon
  jetbrains: {
    type: 'custom',
    name: 'jetbrains',
    pathDark: jetbrainsIconDark,
    pathLight: jetbrainsIconLight,
  },

  // Gemini CLI — gemini icon
  'gemini-cli': {
    type: 'custom',
    name: 'gemini-cli',
    pathDark: geminiIconDark,
    pathLight: geminiIconLight,
  },
  'kilo-cli': {
    type: 'custom',
    name: 'kilo-cli',
    pathDark: kiloCodeIconDark,
    pathLight: kiloCodeIconLight,
  },

  // Codex CLI & GUI — GitHub icon (for Copilot)
  'codex-cli': {
    type: 'custom',
    name: 'github-copilot',
    pathDark: codexIconDark,
    pathLight: codexIconLight,
  },
  'codex-gui': {
    type: 'custom',
    name: 'github-copilot',
    pathDark: codexIconDark,
    pathLight: codexIconLight,
  },

  // OpenCode — console icon
  opencode: {
    type: 'custom',
    name: 'opencode',
    pathDark: opencodeIconDark,
    pathLight: opencodeIconLight,
  },

  // Visual Studio — custom icon from Icons8
  'visual-studio': {
    type: 'custom',
    name: 'visual-studio',
    pathDark: visualStudioIconDark,
    pathLight: visualStudioIconLight,
  },
} as const

// ─── Type Guards & Helpers ──────────────────────────────────────────────────────

/**
 * Type guard to check if a value is a valid ClientId.
 */
export const isValidClientId = (value: string): value is ClientId => {
  return Object.keys(CLIENT_ICON_MAP).includes(value)
}

/**
 * Get the icon source for a client ID.
 * @throws {Error} If the clientId is not valid (should not happen in practice)
 */
export const getClientIconSource = (clientId: ClientId): IconSource => {
  const source = CLIENT_ICON_MAP[clientId]
  if (!source) {
    throw new Error(`No icon mapping found for clientId: ${clientId}`)
  }
  return source
}

/**
 * Get display-friendly name for an icon source.
 */
export const getIconSourceName = (source: IconSource): string => {
  switch (source.type) {
    case 'custom':
      return source.name
    case 'fallback':
      return source.name
  }
}
