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
 * Components use this instead of importing gate constants directly so the
 * implementation can be upgraded — in Step 34, it will call the
 * `license:feature-gates` IPC channel to pick up Pro entitlements at runtime.
 */

import { useMemo } from 'react'
import type { FeatureGates } from '@shared/channels'
import { FREE_GATES } from '@shared/feature-gates'

/**
 * Returns the current gate value for the given feature key.
 *
 * Stub implementation: always returns the `FREE_GATES` value until the
 * license-provider licence IPC channel is connected in Step 34.
 *
 * @param feature - The gate key to query (e.g. `'gitSync'`, `'maxServers'`).
 * @returns The gate value (boolean or number) for the active tier.
 *
 * @example
 * const canSync = useFeatureGate('gitSync')
 * const maxServers = useFeatureGate('maxServers')
 */
export const useFeatureGate = <K extends keyof FeatureGates>(feature: K): FeatureGates[K] =>
  useMemo(() => FREE_GATES[feature], [feature])
