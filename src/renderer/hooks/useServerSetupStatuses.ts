/**
 * @file src/renderer/hooks/useServerSetupStatuses.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Hook for fetching and caching MCP server installation statuses.
 * Polls `installer:status` IPC for each server and returns a map of
 * `DeviceSetupState | null`. Automatically refreshes when the server list changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { DeviceSetupState } from '@shared/types'

interface UseServerSetupStatusesResult {
  /** Map from server ID to its device setup state, or `null` if not yet installed. */
  readonly statuses: Readonly<Record<string, DeviceSetupState | null>>
  /** True while any IPC call is in flight. */
  readonly loading: boolean
  /** Manually trigger a refresh of all statuses. */
  readonly refresh: () => Promise<void>
}

export type SetupStatusKey = 'not_installed' | 'installing' | 'installed' | 'failed' | 'rolled_back'

export const getSetupStatusKey = (state: DeviceSetupState | null): SetupStatusKey => {
  if (!state) return 'not_installed'
  switch (state.installStatus) {
    case 'pending':
      return 'not_installed'
    case 'running':
      return 'installing'
    case 'success':
      return 'installed'
    case 'failed':
      return 'failed'
    case 'rolled_back':
      return 'rolled_back'
    default:
      return 'not_installed'
  }
}

/**
 * Fetch installation statuses for a list of server IDs. Returns a map that
 * can be used to display setup badges in the UI.
 *
 * The hook automatically fetches statuses on mount and whenever the
 * `serverIds` array changes (by shallow equality). It does NOT poll
 * automatically — call `refresh` periodically for live updates.
 */
export const useServerSetupStatuses = (
  serverIds: readonly string[],
): UseServerSetupStatusesResult => {
  const [statuses, setStatuses] = useState<Readonly<Record<string, DeviceSetupState | null>>>({})
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const prevIdsRef = useRef<readonly string[] | null>(null)
  const stableIdsRef = useRef<readonly string[] | null>(null)

  const idsAreEqual = (a: readonly string[] | null, b: readonly string[]) => {
    if (!a || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  const idsChanged = !idsAreEqual(prevIdsRef.current, serverIds)
  if (idsChanged) {
    prevIdsRef.current = serverIds
    stableIdsRef.current = serverIds
  }
  const stableServerIds = stableIdsRef.current ?? serverIds

  const refresh = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const results = await Promise.all(
        stableServerIds.map(async (id) => {
          if (controller.signal.aborted) return { id, status: null as DeviceSetupState | null }
          try {
            const status = await window.api.installerStatus(id)
            return { id, status }
          } catch (err) {
            if (controller.signal.aborted) return { id, status: null }
            console.error(`Failed to fetch installer status for ${id}:`, err)
            return { id, status: null }
          }
        }),
      )

      if (controller.signal.aborted) return

      const newStatuses: Record<string, DeviceSetupState | null> = {}
      results.forEach(({ id, status }) => {
        newStatuses[id] = status
      })
      setStatuses(newStatuses)
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        abortRef.current = null
      }
    }
  }, [stableServerIds])

  useEffect(() => {
    if (!idsChanged) return
    setStatuses((prev) => {
      const updated = { ...prev }
      let changed = false
      stableServerIds.forEach((id) => {
        if (!(id in updated)) {
          updated[id] = null
          changed = true
        }
      })
      return changed ? updated : prev
    })
  }, [idsChanged, stableServerIds])

  useEffect(() => {
    if (!idsChanged) return
    void refresh()
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [refresh, idsChanged])

  return { statuses, loading, refresh }
}
