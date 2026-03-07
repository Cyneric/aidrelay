/**
 * @file src/main/licensing/feature-gates.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Main-process feature gate helpers. `checkGate()` is the single
 * callable used throughout the main process whenever a feature needs to be
 * gated behind the Pro tier. `getActiveGates()` reads the current license
 * status from the licensing service and returns the appropriate gate set.
 */

import type { FeatureGates } from '@shared/channels'
import { FREE_GATES, PRO_GATES } from '@shared/feature-gates'
import { getStatus } from './licensing.service'

/**
 * Returns the feature gate set that matches the user's current licence status.
 * Reads the cached licence tier from the licensing service — this is a
 * synchronous read of the local cache, not a network call.
 *
 * @returns The active `FeatureGates` object for the current session.
 */
export const getActiveGates = (): Readonly<FeatureGates> => {
  const status = getStatus()
  return status.valid && status.tier === 'pro' ? PRO_GATES : FREE_GATES
}

/**
 * Reads a single feature gate value for the currently active licence tier.
 * Use this everywhere in the main process instead of importing gate constants
 * directly — it picks up the active tier automatically once Step 34 is done.
 *
 * @param feature - The gate key to query (e.g. `'gitSync'`, `'maxServers'`).
 * @returns The gate value (boolean or number) for the active tier.
 *
 * @example
 * if (!checkGate('gitSync')) {
 *   throw new Error('Git sync requires a Pro licence')
 * }
 */
export const checkGate = <K extends keyof FeatureGates>(feature: K): FeatureGates[K] =>
  getActiveGates()[feature]
