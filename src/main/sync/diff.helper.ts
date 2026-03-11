/**
 * @file src/main/sync/diff.helper.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Computes a diff between two MCP server maps for sync preview.
 * Returns rows compatible with SyncPreviewItem, with actions:
 *   - 'create' — server in merged map, not in existing map (managed)
 *   - 'overwrite' — server in both maps, normalized config differs (managed)
 *   - 'no‑op' — server identical (managed)
 *   - 'ignored' — server is managed but ignored for this client via override
 *   - 'preserved_unmanaged' — server exists in both maps, identical, and NOT managed by aidrelay
 *   - 'removed' — server exists in existing map, missing from merged (managed disabled)
 */

import type {
  McpServerConfig,
  McpServerMap,
  SyncPreviewItem,
  SyncPreviewAction,
} from '@shared/types'

const normalizeConfig = (config: McpServerConfig | null): McpServerConfig | null => {
  if (config === null) return null

  const type = config.type ?? 'stdio'
  const normalized: McpServerConfig = {
    command: config.command,
    ...(config.args !== undefined && config.args.length > 0 ? { args: [...config.args] } : {}),
    ...(config.env !== undefined && Object.keys(config.env).length > 0 ? { env: config.env } : {}),
    ...(config.headers !== undefined && Object.keys(config.headers).length > 0
      ? { headers: config.headers }
      : {}),
    ...(type !== 'stdio' ? { type } : {}),
    ...(type !== 'stdio' && config.url ? { url: config.url } : {}),
  }
  return normalized
}

const isSameConfig = (a: McpServerConfig | null, b: McpServerConfig | null): boolean =>
  JSON.stringify(normalizeConfig(a)) === JSON.stringify(normalizeConfig(b))

/**
 * Computes a preview diff between the currently existing client config
 * and the merged map that would be written (managed + preserved unmanaged).
 *
 * @param existing - Server map read from the client config file.
 * @param merged - Server map that would be written (managed + preserved unmanaged).
 * @param managedNames - Set of server names that are managed by aidrelay.
 * @param ignoredNames - Set of server names ignored for this client.
 * @returns Array of preview items, sorted by name.
 */
export const computeSyncPreviewItems = (
  existing: McpServerMap,
  merged: McpServerMap,
  managedNames: Set<string>,
  ignoredNames: Set<string>,
): SyncPreviewItem[] => {
  const allNames = new Set<string>([...Object.keys(existing), ...Object.keys(merged)])
  const items: SyncPreviewItem[] = []

  for (const name of [...allNames].sort((a, b) => a.localeCompare(b))) {
    const before = existing[name] ?? null
    const after = merged[name] ?? null
    const isManaged = managedNames.has(name)

    let action: SyncPreviewAction
    let source: SyncPreviewItem['source'] = 'modified'

    if (before === null && after !== null) {
      // New server (managed)
      action = 'create'
      source = 'added'
    } else if (before !== null && after === null) {
      // Server removed (managed disabled)
      action = 'removed'
      source = 'removed'
    } else if (before !== null && after !== null) {
      if (isSameConfig(before, after)) {
        if (isManaged && ignoredNames.has(name)) {
          action = 'ignored'
        } else {
          action = isManaged ? 'no-op' : 'preserved_unmanaged'
        }
      } else {
        action = 'overwrite'
      }
    } else {
      // Both null – impossible
      continue
    }

    items.push({ name, source, action, before, after })
  }

  return items
}
