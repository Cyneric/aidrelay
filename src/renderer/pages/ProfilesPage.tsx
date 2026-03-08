/**
 * @file src/renderer/pages/ProfilesPage.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Profiles management page. Displays all configuration profiles
 * in a responsive card grid. Active profile is highlighted. Provides Add,
 * Edit, Delete, and Activate actions. Activating a profile first shows a diff
 * confirmation modal before committing the change.
 */

import { useEffect, useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CardGrid } from '@/components/ui/card-grid'
import { ProfileCard } from '@/components/profiles/ProfileCard'
import { ProfileEditor } from '@/components/profiles/ProfileEditor'
import { ProfileDiffView } from '@/components/profiles/ProfileDiffView'
import { ProfileDeleteConfirmDialog } from '@/components/profiles/ProfileDeleteConfirmDialog'
import { useProfilesStore } from '@/stores/profiles.store'
import { useServersStore } from '@/stores/servers.store'
import { useRulesStore } from '@/stores/rules.store'
import type { Profile } from '@shared/types'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full profile management page. Loads profiles, servers, and rules on mount
 * so the ProfileDiffView can resolve names and current enabled states.
 */
const ProfilesPage = () => {
  const { t } = useTranslation()
  const { profiles, loading, error, load, delete: deleteProfile, activate } = useProfilesStore()
  const { load: loadServers } = useServersStore()
  const { load: loadRules } = useRulesStore()

  const [showEditor, setShowEditor] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | undefined>(undefined)
  const [activatingProfile, setActivatingProfile] = useState<Profile | undefined>(undefined)
  const [pendingDeleteProfile, setPendingDeleteProfile] = useState<Profile | undefined>(undefined)
  const [deletingProfile, setDeletingProfile] = useState(false)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    void load()
    // Pre-load so the diff view can resolve item names and current enabled states
    void loadServers()
    void loadRules()
  }, [load, loadServers, loadRules])

  const openCreate = useCallback(() => {
    setEditingProfile(undefined)
    setShowEditor(true)
  }, [])

  const openEdit = useCallback((profile: Profile) => {
    setEditingProfile(profile)
    setShowEditor(true)
  }, [])

  const closeEditor = useCallback(() => {
    setShowEditor(false)
    setEditingProfile(undefined)
  }, [])

  const handleDeleteConfirm = useCallback(
    async (profile: Profile) => {
      setDeletingProfile(true)
      try {
        await deleteProfile(profile.id)
        toast.success(t('profiles.deleted'))
      } finally {
        setDeletingProfile(false)
        setPendingDeleteProfile(undefined)
      }
    },
    [deleteProfile, t],
  )

  const handleActivateRequest = useCallback((profile: Profile) => {
    setActivatingProfile(profile)
  }, [])

  const handleActivateConfirm = useCallback(async () => {
    if (!activatingProfile) return
    setActivating(true)
    try {
      const results = await activate(activatingProfile.id)
      const failed = results.filter((r) => !r.success)
      if (failed.length === 0) {
        toast.success(t('profiles.activated', { name: activatingProfile.name }))
      } else {
        toast.warning(
          t('profiles.activatedWithErrors', { name: activatingProfile.name, count: failed.length }),
        )
      }
    } finally {
      setActivating(false)
      setActivatingProfile(undefined)
    }
  }, [activatingProfile, activate, t])

  // Exclude the profile being edited from its own parent options
  const availableParents = editingProfile
    ? profiles.filter((p) => p.id !== editingProfile.id)
    : profiles

  return (
    <section aria-labelledby="profiles-heading" className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 id="profiles-heading" className="text-2xl font-bold tracking-tight">
            {t('profiles.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('profiles.subtitle')}</p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="gap-1.5"
          data-testid="add-profile-button"
        >
          <Plus size={14} aria-hidden="true" />
          {t('profiles.add')}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <p role="alert" className="text-sm text-destructive" data-testid="profiles-error">
          {error}
        </p>
      )}

      {/* Loading */}
      {loading && profiles.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="profiles-loading">
          {t('profiles.loading')}
        </p>
      )}

      {/* Empty state */}
      {!loading && profiles.length === 0 && !error && (
        <div
          className="rounded-lg border border-dashed border-border p-12 flex flex-col items-center gap-3 text-center"
          data-testid="profiles-empty"
        >
          <p className="text-sm font-medium">{t('profiles.noProfilesHeading')}</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            {t('profiles.noProfilesDescription')}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={openCreate}
            data-testid="profiles-empty-add"
          >
            {t('profiles.addFirst')}
          </Button>
        </div>
      )}

      {/* Card grid */}
      {profiles.length > 0 && (
        <CardGrid data-testid="profiles-grid">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onActivate={handleActivateRequest}
              onEdit={openEdit}
              onDelete={(p) => {
                setPendingDeleteProfile(p)
              }}
            />
          ))}
        </CardGrid>
      )}

      {/* Profile editor drawer */}
      {showEditor && (
        <ProfileEditor
          {...(editingProfile !== undefined && { profile: editingProfile })}
          availableParents={availableParents}
          onClose={closeEditor}
        />
      )}

      {/* Activation diff confirmation modal */}
      {activatingProfile !== undefined && (
        <ProfileDiffView
          profile={activatingProfile}
          activating={activating}
          onConfirm={() => {
            void handleActivateConfirm()
          }}
          onCancel={() => {
            setActivatingProfile(undefined)
          }}
        />
      )}

      {/* Delete confirmation modal */}
      {pendingDeleteProfile !== undefined && (
        <ProfileDeleteConfirmDialog
          profile={pendingDeleteProfile}
          deleting={deletingProfile}
          onConfirm={() => {
            void handleDeleteConfirm(pendingDeleteProfile)
          }}
          onCancel={() => {
            if (!deletingProfile) setPendingDeleteProfile(undefined)
          }}
        />
      )}
    </section>
  )
}

export { ProfilesPage }
