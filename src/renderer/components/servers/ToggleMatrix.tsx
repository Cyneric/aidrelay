/**
 * @file src/renderer/components/servers/ToggleMatrix.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Per-client enable/disable matrix for MCP servers. Rows are
 * server entries, columns are detected clients. Each checkbox reflects the
 * `clientOverrides` state and updates it via the `servers:update` IPC call
 * when toggled. Only installed clients are shown as columns.
 */

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useServersStore } from '@/stores/servers.store'
import { useClientsStore } from '@/stores/clients.store'
import type { ClientId } from '@shared/types'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Matrix view that maps every server row to every installed client column.
 * A checkbox at each intersection toggles the server's `clientOverrides`
 * for that client. When no override exists the server's global `enabled`
 * state determines the effective value.
 */
const ToggleMatrix = () => {
  const { servers, setClientOverride, load } = useServersStore()
  const { clients, detectAll } = useClientsStore()

  useEffect(() => {
    void load()
    void detectAll()
  }, [load, detectAll])

  const installedClients = clients.filter((c) => c.installed)

  if (servers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4" data-testid="toggle-matrix-empty">
        No servers in the registry yet. Add a server to see the toggle matrix.
      </p>
    )
  }

  if (installedClients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4" data-testid="toggle-matrix-no-clients">
        No installed clients detected. Install a supported AI tool to manage per-client toggles.
      </p>
    )
  }

  /**
   * Determines whether a server is effectively enabled for a given client.
   * If an explicit override exists it takes precedence; otherwise the global
   * enabled flag is used.
   */
  const isEffectivelyEnabled = (serverId: string, clientId: ClientId): boolean => {
    const server = servers.find((s) => s.id === serverId)
    if (!server) return false
    const override = server.clientOverrides[clientId]
    return override !== undefined ? override.enabled : server.enabled
  }

  return (
    <div className="overflow-x-auto" data-testid="toggle-matrix">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th
              scope="col"
              className="text-left font-medium text-muted-foreground py-2 pr-4 min-w-[160px]"
            >
              Server
            </th>
            {installedClients.map((client) => (
              <th
                key={client.id}
                scope="col"
                className="text-center font-medium text-muted-foreground py-2 px-3 min-w-[100px]"
              >
                {client.displayName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {servers.map((server, rowIndex) => (
            <tr
              key={server.id}
              className={cn('border-t border-border', rowIndex % 2 === 0 ? '' : 'bg-muted/30')}
              data-testid={`matrix-row-${server.id}`}
            >
              <td className="py-2 pr-4">
                <span
                  className={cn(
                    'font-mono text-xs',
                    !server.enabled && 'text-muted-foreground line-through',
                  )}
                >
                  {server.name}
                </span>
              </td>
              {installedClients.map((client) => {
                const enabled = isEffectivelyEnabled(server.id, client.id)
                return (
                  <td key={client.id} className="text-center py-2 px-3">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => {
                        void setClientOverride(server.id, client.id, !enabled)
                      }}
                      aria-label={`Enable ${server.name} for ${client.displayName}`}
                      className="h-4 w-4 cursor-pointer accent-primary"
                      data-testid={`matrix-toggle-${server.id}-${client.id}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { ToggleMatrix }
