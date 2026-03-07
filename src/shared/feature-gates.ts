/**
 * @file src/shared/feature-gates.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Constant gate sets for each subscription tier. Both the main
 * process (`checkGate`) and the renderer (`useFeatureGate`) import from here
 * so the values are always in sync without any IPC round-trip.
 */

import type { FeatureGates } from './channels'

/**
 * Feature entitlements for the Free tier.
 * Limits are intentionally generous to be genuinely useful without a licence.
 */
export const FREE_GATES: Readonly<FeatureGates> = {
  maxServers: 10,
  maxRules: 10,
  maxProfiles: 2,
  gitSync: false,
  serverTesting: false,
  registryInstall: false,
  stackExport: false,
  tokenBudgetDetailed: false,
  activityLogDays: 7,
  ruleTemplates: false,
}

/**
 * Feature entitlements for the Pro tier.
 * All numeric limits use `Infinity` so no artificial cap is ever hit.
 */
export const PRO_GATES: Readonly<FeatureGates> = {
  maxServers: Infinity,
  maxRules: Infinity,
  maxProfiles: Infinity,
  gitSync: true,
  serverTesting: true,
  registryInstall: true,
  stackExport: true,
  tokenBudgetDetailed: true,
  activityLogDays: Infinity,
  ruleTemplates: true,
}
