import { create } from 'zustand'
import { toast } from 'sonner'
import type {
  CuratedSkill,
  InstalledSkill,
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
import { skillsService } from '@/services/skills.service'

interface SkillsState {
  installed: InstalledSkill[]
  curated: CuratedSkill[]
  conflicts: SkillSyncConflict[]
  migrationPreview: SkillMigrationPreview | null
  loading: boolean
  loadingInstalled: boolean
  loadingCurated: boolean
  loadingConflicts: boolean
  loadingMigrationPreview: boolean
  installingSkillSlug: string | null
  creatingSkill: boolean
  deletingSkillKey: string | null
  togglingSkillKey: string | null
  error: string | null
  getSectionCounts: () => {
    discover: number
    installed: number
    conflicts: number
    migration: number
  }
  loadInstalled: () => Promise<void>
  loadCurated: () => Promise<void>
  loadConflicts: () => Promise<void>
  prepareInstall: (
    skillName: string,
    scope: SkillScope,
    projectPath?: string,
  ) => ReturnType<typeof skillsService.prepareInstall>
  installCurated: (input: InstallCuratedSkillInput) => Promise<void>
  create: (input: CreateSkillInput) => Promise<void>
  delete: (input: DeleteSkillInput) => Promise<void>
  setEnabled: (input: SetSkillEnabledInput) => Promise<void>
  loadMigrationPreview: () => Promise<void>
  applyMigration: (input: ApplySkillMigrationInput) => Promise<void>
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote') => Promise<void>
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  installed: [],
  curated: [],
  conflicts: [],
  migrationPreview: null,
  loading: false,
  loadingInstalled: false,
  loadingCurated: false,
  loadingConflicts: false,
  loadingMigrationPreview: false,
  installingSkillSlug: null,
  creatingSkill: false,
  deletingSkillKey: null,
  togglingSkillKey: null,
  error: null,

  getSectionCounts: () => {
    const { curated, installed, conflicts, migrationPreview } = get()
    return {
      discover: curated.length,
      installed: installed.length,
      conflicts: conflicts.length,
      migration: migrationPreview?.items.length ?? 0,
    }
  },

  loadInstalled: async () => {
    set({ loading: true, loadingInstalled: true, error: null })
    try {
      const installed = await skillsService.listInstalled()
      set({ installed, loading: false, loadingInstalled: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load installed skills'
      set({ error: message, loading: false, loadingInstalled: false })
    }
  },

  loadCurated: async () => {
    set({ loading: true, loadingCurated: true, error: null })
    try {
      const curated = await skillsService.listCurated()
      set({ curated, loading: false, loadingCurated: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load curated skills'
      set({ error: message, loading: false, loadingCurated: false })
    }
  },

  loadConflicts: async () => {
    set({ loadingConflicts: true })
    try {
      const conflicts = await skillsService.listSyncConflicts()
      set({ conflicts, loadingConflicts: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load skill conflicts'
      set({ error: message, loadingConflicts: false })
    }
  },

  prepareInstall: (skillName, scope, projectPath) =>
    skillsService.prepareInstall(skillName, scope, projectPath),

  installCurated: async (input) => {
    set({ installingSkillSlug: input.skillName })
    try {
      await skillsService.installCurated(input)
      await get().loadInstalled()
      toast.success('Skill installed')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to install skill'
      toast.error(message)
      throw err
    } finally {
      set({ installingSkillSlug: null })
    }
  },

  create: async (input) => {
    set({ creatingSkill: true })
    try {
      await skillsService.create(input)
      await get().loadInstalled()
      toast.success('Skill created')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create skill'
      toast.error(message)
      throw err
    } finally {
      set({ creatingSkill: false })
    }
  },

  delete: async (input) => {
    const key = `${input.scope}:${input.projectPath ?? 'user'}:${input.skillName}`
    set({ deletingSkillKey: key })
    try {
      await skillsService.delete(input)
      await get().loadInstalled()
      toast.success('Skill deleted')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete skill'
      toast.error(message)
      throw err
    } finally {
      set({ deletingSkillKey: null })
    }
  },

  setEnabled: async (input) => {
    const key = `${input.scope}:${input.projectPath ?? 'user'}:${input.skillName}`
    set({ togglingSkillKey: key })
    try {
      await skillsService.setEnabled(input)
      await get().loadInstalled()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update skill state'
      toast.error(message)
      throw err
    } finally {
      set({ togglingSkillKey: null })
    }
  },

  loadMigrationPreview: async () => {
    set({ loadingMigrationPreview: true })
    try {
      const migrationPreview = await skillsService.migrateLegacyPreview()
      set({ migrationPreview, loadingMigrationPreview: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load migration preview'
      set({ error: message, loadingMigrationPreview: false })
    }
  },

  applyMigration: async (input) => {
    try {
      const migrationPreview = await skillsService.migrateLegacyApply(input)
      set({ migrationPreview })
      await get().loadInstalled()
      toast.success('Legacy migration finished')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply migration'
      toast.error(message)
      throw err
    }
  },

  resolveConflict: async (conflictId, resolution) => {
    try {
      await skillsService.resolveSyncConflict(conflictId, resolution)
      await get().loadConflicts()
      await get().loadInstalled()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve skill conflict'
      toast.error(message)
      throw err
    }
  },
}))
