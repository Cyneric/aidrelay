/**
 * @file src/renderer/services/sync.service.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Service for cross-device sync operations: pending setups,
 * conflict resolution, and push review.
 */

import type { PendingSetup, SyncConflict } from '@shared/types'

export const syncService = {
  listPending: (): Promise<PendingSetup[]> => window.api.syncListPending(),

  applyPending: (serverId: string): Promise<void> => window.api.syncApplyPending(serverId),

  autoPull: (): Promise<void> => window.api.syncAutoPull(),

  resolveConflict: (conflictId: string, resolution: 'local' | 'remote'): Promise<void> =>
    window.api.syncResolveConflict(conflictId, resolution),

  pushReview: (): Promise<SyncConflict[]> => window.api.syncPushReview(),
}
