import type {
  ApplySkillMigrationInput,
  CreateSkillInput,
  DeleteSkillInput,
  InstallCuratedSkillInput,
  SetSkillEnabledInput,
} from '@shared/channels'
import type {
  CuratedSkill,
  InstalledSkill,
  SkillInstallPreview,
  SkillMigrationPreview,
  SkillScope,
  SkillSyncConflict,
} from '@shared/types'

export const skillsService = {
  listInstalled: (): Promise<InstalledSkill[]> => window.api.skillsListInstalled(),
  listCurated: (): Promise<CuratedSkill[]> => window.api.skillsListCurated(),
  detectWorkspaces: (): Promise<string[]> => window.api.skillsDetectWorkspaces(),
  prepareInstall: (
    skillName: string,
    scope: SkillScope,
    projectPath?: string,
  ): Promise<SkillInstallPreview> => window.api.skillsPrepareInstall(skillName, scope, projectPath),
  installCurated: (input: InstallCuratedSkillInput): Promise<InstalledSkill> =>
    window.api.skillsInstallCurated(input),
  create: (input: CreateSkillInput): Promise<InstalledSkill> => window.api.skillsCreate(input),
  delete: (input: DeleteSkillInput): Promise<void> => window.api.skillsDelete(input),
  setEnabled: (input: SetSkillEnabledInput): Promise<void> => window.api.skillsSetEnabled(input),
  migrateLegacyPreview: (): Promise<SkillMigrationPreview> =>
    window.api.skillsMigrateLegacyPreview(),
  migrateLegacyApply: (input: ApplySkillMigrationInput): Promise<SkillMigrationPreview> =>
    window.api.skillsMigrateLegacyApply(input),
  listSyncConflicts: (): Promise<SkillSyncConflict[]> => window.api.skillsSyncListConflicts(),
  resolveSyncConflict: (conflictId: string, resolution: 'local' | 'remote'): Promise<void> =>
    window.api.skillsSyncResolveConflict(conflictId, resolution),
}
