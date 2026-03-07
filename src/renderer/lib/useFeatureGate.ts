/**
 * @file src/renderer/lib/useFeatureGate.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description React hook for reading a feature gate value in the renderer.
 * Fetches the active gate set from the main process via `license:feature-gates`
 * on first render and caches the result in module-level state. Components use
 * this hook instead of importing gate constants directly so the active tier is
 * always reflected accurately after license activation or deactivation.
 */

import { useState, useEffect } from 'react'
import type { FeatureGates } from '@shared/channels'
import { FREE_GATES } from '@shared/feature-gates'

/** Module-level cache of the gate set loaded from the main process. */
let cachedGates: Readonly<FeatureGates> = FREE_GATES
let gatesFetched = false

/**
 * Returns the current gate value for the given feature key. Fetches the gate
 * set from the main process on first call and uses the cached result thereafter.
 * Falls back to `FREE_GATES` until the IPC response arrives.
 *
 * @param feature - The gate key to query (e.g. `'gitSync'`, `'maxServers'`).
 * @returns The gate value (boolean or number) for the active tier.
 *
 * @example
 * const canSync = useFeatureGate('gitSync')
 * const maxServers = useFeatureGate('maxServers')
 */
export const useFeatureGate = <K extends keyof FeatureGates>(feature: K): FeatureGates[K] => {
  const [gates, setGates] = useState<Readonly<FeatureGates>>(cachedGates)

  useEffect(() => {
    if (gatesFetched) return
    gatesFetched = true

    void window.api.licenseFeatureGates().then((fetched) => {
      cachedGates = fetched
      setGates(fetched)
    })
  }, [])

  return gates[feature]
}

/**
 * Invalidates the cached gate set so the next `useFeatureGate` call fetches
 * fresh values from the main process. Call this after license activation or
 * deactivation.
 */
export const invalidateGateCache = (): void => {
  gatesFetched = false
  cachedGates = FREE_GATES
}
