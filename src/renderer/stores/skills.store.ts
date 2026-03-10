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
  error: string | null
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
  error: null,

  loadInstalled: async () => {
    set({ loading: true, error: null })
    try {
      const installed = await skillsService.listInstalled()
      set({ installed, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load installed skills'
      set({ error: message, loading: false })
    }
  },

  loadCurated: async () => {
    set({ loading: true, error: null })
    try {
      const curated = await skillsService.listCurated()
      set({ curated, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load curated skills'
      set({ error: message, loading: false })
    }
  },

  loadConflicts: async () => {
    try {
      const conflicts = await skillsService.listSyncConflicts()
      set({ conflicts })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load skill conflicts'
      set({ error: message })
    }
  },

  prepareInstall: (skillName, scope, projectPath) =>
    skillsService.prepareInstall(skillName, scope, projectPath),

  installCurated: async (input) => {
    try {
      await skillsService.installCurated(input)
      await get().loadInstalled()
      toast.success('Skill installed')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to install skill'
      toast.error(message)
    }
  },

  create: async (input) => {
    try {
      await skillsService.create(input)
      await get().loadInstalled()
      toast.success('Skill created')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create skill'
      toast.error(message)
    }
  },

  delete: async (input) => {
    try {
      await skillsService.delete(input)
      await get().loadInstalled()
      toast.success('Skill deleted')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete skill'
      toast.error(message)
    }
  },

  setEnabled: async (input) => {
    try {
      await skillsService.setEnabled(input)
      await get().loadInstalled()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update skill state'
      toast.error(message)
    }
  },

  loadMigrationPreview: async () => {
    try {
      const migrationPreview = await skillsService.migrateLegacyPreview()
      set({ migrationPreview })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load migration preview'
      set({ error: message })
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
    }
  },
}))
