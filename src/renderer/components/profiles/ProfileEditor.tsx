/**
 * @file src/renderer/components/profiles/ProfileEditor.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Slide-in drawer for creating and editing configuration profiles.
 * Wraps `ProfileForm` in a right-anchored panel with a backdrop. On submit,
 * calls `create` or `update` from the profiles Zustand store and closes.
 */

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ProfileForm } from './ProfileForm'
import { useProfilesStore } from '@/stores/profiles.store'
import type { Profile } from '@shared/types'
import type { CreateProfileInput } from '@shared/channels'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileEditorProps {
  /** The profile to edit, or `undefined` when creating a new one. */
  readonly profile?: Profile
  /** Other profiles that can be selected as a parent. */
  readonly availableParents?: readonly Profile[]
  /** Called when the drawer should close. */
  readonly onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Right-side drawer for profile create/edit. A semi-transparent backdrop
 * covers the rest of the UI and clicking it closes the drawer.
 */
const ProfileEditor = ({ profile, availableParents = [], onClose }: ProfileEditorProps) => {
  const [saving, setSaving] = useState(false)
  const { create, update } = useProfilesStore()

  const handleSubmit = useCallback(
    async (data: CreateProfileInput) => {
      setSaving(true)
      try {
        if (profile) {
          const result = await update(profile.id, data)
          if (result) {
            toast.success(`"${result.name}" updated`)
            onClose()
          }
        } else {
          const result = await create(data)
          if (result) {
            toast.success(`"${result.name}" created`)
            onClose()
          }
        }
      } finally {
        setSaving(false)
      }
    },
    [profile, create, update, onClose],
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
        data-testid="profile-editor-backdrop"
      />

      {/* Drawer panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-background border-l border-border shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={profile ? `Edit profile: ${profile.name}` : 'Add profile'}
        data-testid="profile-editor"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-base">
            {profile ? `Edit: ${profile.name}` : 'Add profile'}
          </h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close editor"
                data-testid="profile-editor-close"
              >
                <X size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ProfileForm
            {...(profile !== undefined && { defaultValues: profile })}
            availableParents={availableParents}
            onSubmit={(data) => {
              void handleSubmit(data)
            }}
            onCancel={onClose}
            saving={saving}
          />
        </div>
      </aside>
    </>
  )
}

export { ProfileEditor }
