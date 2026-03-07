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
 * gated behind the Pro tier. `getActiveGates()` returns the appropriate gate
 * set for the currently validated licence — stubbed to FREE_GATES until the
 * license-provider integration is wired in Step 34.
 */

import type { FeatureGates } from '@shared/channels'
import { FREE_GATES } from '@shared/feature-gates'

/**
 * Returns the feature gate set that matches the user's current licence status.
 *
 * Stub implementation: always returns `FREE_GATES` until the license-provider
 * licence validation service is connected in Step 34.
 *
 * @returns The active `FeatureGates` object for the current session.
 */
export const getActiveGates = (): Readonly<FeatureGates> => {
  // TODO (Step 34): read the cached licence tier from electron.safeStorage and
  // return PRO_GATES when a valid Pro licence is present.
  return FREE_GATES
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
