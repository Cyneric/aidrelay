/**
 * @file src/main/reset/factory-reset.service.ts
 *
 * @description Clears all aidrelay-owned persisted state to emulate a fresh
 * install on a new machine.
 */

import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import log from 'electron-log'
import { getDatabase } from '@main/db/connection'
import { ProfilesRepo } from '@main/db/profiles.repo'
import { gitSyncService } from '@main/git-sync/git-sync.service'
import { clearLocalLicenseCache } from '@main/licensing/licensing.service'
import { deleteAllServiceSecrets } from '@main/secrets/keytar.service'

/**
 * Runs a full factory reset over app-owned state.
 *
 * External AI client config files are intentionally not modified.
 */
export const runFactoryReset = async (): Promise<{
  disconnectedGitSync: boolean
  clearedAllSecrets: boolean
  clearedLicenseCache: boolean
  databaseReset: boolean
  deletedPaths: string[]
}> => {
  let disconnectedGitSync = false
  let clearedAllSecrets = false
  let clearedLicenseCache = false
  let databaseReset = false
  const deletedPaths: string[] = []

  // 1) Disconnect git sync (also clears git-sync clone + token/config state).
  await gitSyncService.disconnect()
  disconnectedGitSync = true

  // 2) Clear all OS credentials created by aidrelay.
  await deleteAllServiceSecrets()
  clearedAllSecrets = true

  // 3) Clear encrypted local license cache (no API call).
  clearLocalLicenseCache()
  clearedLicenseCache = true

  // 4) Purge DB tables and re-seed default profile.
  const db = getDatabase()
  const profilesRepo = new ProfilesRepo(db)
  const resetDb = db.transaction(() => {
    db.prepare('DELETE FROM servers').run()
    db.prepare('DELETE FROM rules').run()
    db.prepare('DELETE FROM profiles').run()
    db.prepare('DELETE FROM settings').run()
    db.prepare('DELETE FROM activity_log').run()
    db.prepare('DELETE FROM backups').run()
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('activity_log', 'backups')").run()
  })
  resetDb()

  const defaultProfile = profilesRepo.create({ name: 'default' })
  profilesRepo.setActive(defaultProfile.id)
  databaseReset = true

  // 5) Remove app-owned backup artifacts from userData.
  const backupDir = join(app.getPath('userData'), 'backups')
  if (existsSync(backupDir)) {
    rmSync(backupDir, { recursive: true, force: true })
    deletedPaths.push(backupDir)
  }

  log.info('[reset] factory reset completed')
  return {
    disconnectedGitSync,
    clearedAllSecrets,
    clearedLicenseCache,
    databaseReset,
    deletedPaths,
  }
}
