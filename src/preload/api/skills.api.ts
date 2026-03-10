import type {
  ApplySkillMigrationInput,
  CreateSkillInput,
  DeleteSkillInput,
  InstallCuratedSkillInput,
  SetSkillEnabledInput,
} from '../../shared/channels'
import type {
  CuratedSkill,
  InstalledSkill,
  SkillInstallPreview,
  SkillMigrationPreview,
  SkillScope,
  SkillSyncConflict,
} from '../../shared/types'
import type { IpcRendererLike } from './types'

export const createSkillsApi = (ipcRenderer: IpcRendererLike) => ({
  skillsListInstalled: (): Promise<InstalledSkill[]> => ipcRenderer.invoke('skills:list-installed'),
  skillsListCurated: (): Promise<CuratedSkill[]> => ipcRenderer.invoke('skills:list-curated'),
  skillsDetectWorkspaces: (): Promise<string[]> => ipcRenderer.invoke('skills:detect-workspaces'),
  skillsPrepareInstall: (
    skillName: string,
    scope: SkillScope,
    projectPath?: string,
  ): Promise<SkillInstallPreview> =>
    ipcRenderer.invoke('skills:prepare-install', skillName, scope, projectPath),
  skillsInstallCurated: (input: InstallCuratedSkillInput): Promise<InstalledSkill> =>
    ipcRenderer.invoke('skills:install-curated', input),
  skillsCreate: (input: CreateSkillInput): Promise<InstalledSkill> =>
    ipcRenderer.invoke('skills:create', input),
  skillsDelete: (input: DeleteSkillInput): Promise<void> =>
    ipcRenderer.invoke('skills:delete', input),
  skillsSetEnabled: (input: SetSkillEnabledInput): Promise<void> =>
    ipcRenderer.invoke('skills:set-enabled', input),
  skillsMigrateLegacyPreview: (): Promise<SkillMigrationPreview> =>
    ipcRenderer.invoke('skills:migrate-legacy-preview'),
  skillsMigrateLegacyApply: (input: ApplySkillMigrationInput): Promise<SkillMigrationPreview> =>
    ipcRenderer.invoke('skills:migrate-legacy-apply', input),
  skillsSyncListConflicts: (): Promise<SkillSyncConflict[]> =>
    ipcRenderer.invoke('skills:sync:list-conflicts'),
  skillsSyncResolveConflict: (conflictId: string, resolution: 'local' | 'remote'): Promise<void> =>
    ipcRenderer.invoke('skills:sync:resolve-conflict', conflictId, resolution),
})
