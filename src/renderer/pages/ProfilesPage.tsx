/**
 * @file src/renderer/pages/ProfilesPage.tsx
 *
 * @created 07.03.2026
 * @modified 17.03.2026
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
import { Plus, Info, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CardGrid } from '@/components/ui/card-grid'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
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
      <PageHeader
        id="profiles-heading"
        title={t('profiles.title')}
        subtitle={t('profiles.subtitle')}
        actions={
          <Button
            type="button"
            onClick={openCreate}
            className="gap-1.5"
            data-testid="add-profile-button"
          >
            <Plus size={14} aria-hidden="true" />
            {t('profiles.add')}
          </Button>
        }
      />

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

      {/* Contextual help for new users */}
      {!loading && profiles.length <= 1 && profiles.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3"
          data-testid="profiles-context-help"
        >
          <Info size={16} className="mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" />
          <p className="text-xs text-text-secondary">
            {t('profiles.contextHelp', {
              defaultValue:
                'Profiles let you switch between different MCP server and rule configurations. Create additional profiles for different workflows or projects.',
            })}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && profiles.length === 0 && !error && (
        <EmptyState
          icon={Layers}
          title={t('profiles.noProfilesHeading')}
          description={t('profiles.noProfilesDescription')}
          action={{ label: t('profiles.addFirst'), onClick: openCreate }}
          testId="profiles-empty"
        />
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
