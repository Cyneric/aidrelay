/**
 * @file src/main/ipc/skills.ipc.ts
 *
 * @description IPC handlers for skills lifecycle management.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type {
  CuratedSkill,
  InstalledSkill,
  SkillInstallPreview,
  SkillMigrationPreview,
  SkillScope,
  SkillSyncConflict,
} from '@shared/types'
import type {
  ApplySkillMigrationInput,
  CreateSkillInput,
  DeleteSkillInput,
  InstallCuratedSkillInput,
  SetSkillEnabledInput,
} from '@shared/channels'
import { skillsService } from '@main/skills/skills.service'

export const registerSkillsIpc = (): void => {
  ipcMain.handle('skills:list-installed', async (): Promise<InstalledSkill[]> => {
    log.debug('[ipc] skills:list-installed')
    return skillsService.listInstalled()
  })

  ipcMain.handle('skills:list-curated', async (): Promise<CuratedSkill[]> => {
    log.debug('[ipc] skills:list-curated')
    return skillsService.listCurated()
  })

  ipcMain.handle('skills:detect-workspaces', (): string[] => {
    log.debug('[ipc] skills:detect-workspaces')
    return skillsService.detectWorkspaces()
  })

  ipcMain.handle(
    'skills:prepare-install',
    async (
      _event,
      skillName: string,
      scope: SkillScope,
      projectPath?: string,
    ): Promise<SkillInstallPreview> => {
      log.debug(`[ipc] skills:prepare-install ${skillName} (${scope})`)
      return skillsService.prepareInstall(skillName, scope, projectPath)
    },
  )

  ipcMain.handle(
    'skills:install-curated',
    async (_event, input: InstallCuratedSkillInput): Promise<InstalledSkill> => {
      log.debug(`[ipc] skills:install-curated ${input.skillName} (${input.scope})`)
      return skillsService.installCurated(input)
    },
  )

  ipcMain.handle(
    'skills:create',
    async (_event, input: CreateSkillInput): Promise<InstalledSkill> => {
      log.debug(`[ipc] skills:create ${input.name} (${input.scope})`)
      return skillsService.create(input)
    },
  )

  ipcMain.handle('skills:delete', async (_event, input: DeleteSkillInput): Promise<void> => {
    log.debug(`[ipc] skills:delete ${input.skillName} (${input.scope})`)
    await skillsService.delete(input)
  })

  ipcMain.handle(
    'skills:set-enabled',
    async (_event, input: SetSkillEnabledInput): Promise<void> => {
      log.debug(`[ipc] skills:set-enabled ${input.skillName} => ${input.enabled}`)
      await skillsService.setEnabled(input)
    },
  )

  ipcMain.handle('skills:migrate-legacy-preview', async (): Promise<SkillMigrationPreview> => {
    log.debug('[ipc] skills:migrate-legacy-preview')
    return skillsService.migrateLegacyPreview()
  })

  ipcMain.handle(
    'skills:migrate-legacy-apply',
    async (_event, input: ApplySkillMigrationInput): Promise<SkillMigrationPreview> => {
      log.debug('[ipc] skills:migrate-legacy-apply')
      return skillsService.migrateLegacyApply(input)
    },
  )

  ipcMain.handle('skills:sync:list-conflicts', (): SkillSyncConflict[] => {
    log.debug('[ipc] skills:sync:list-conflicts')
    return skillsService.listSyncConflicts()
  })

  ipcMain.handle(
    'skills:sync:resolve-conflict',
    async (_event, conflictId: string, resolution: 'local' | 'remote'): Promise<void> => {
      log.debug(`[ipc] skills:sync:resolve-conflict ${conflictId} ${resolution}`)
      await skillsService.resolveSyncConflict(conflictId, resolution)
    },
  )

  log.info('[ipc] skills handlers registered')
}
