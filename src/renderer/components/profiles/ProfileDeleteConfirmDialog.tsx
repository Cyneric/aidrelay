/**
 * @file src/renderer/components/profiles/ProfileDeleteConfirmDialog.tsx
 *
 * @description Confirmation dialog for deleting a profile. Requires typing the
 * profile name to enable the destructive action.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { Profile } from '@shared/types'

interface ProfileDeleteConfirmDialogProps {
  readonly profile: Profile
  readonly deleting?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

const normalize = (value: string): string => value.trim().toLowerCase()

const ProfileDeleteConfirmDialog = ({
  profile,
  deleting = false,
  onConfirm,
  onCancel,
}: ProfileDeleteConfirmDialogProps) => {
  const { t } = useTranslation()
  const [confirmationInput, setConfirmationInput] = useState('')

  useEffect(() => {
    setConfirmationInput('')
  }, [profile.id])

  const matchesProfileName = useMemo(
    () => normalize(confirmationInput) === normalize(profile.name),
    [confirmationInput, profile.name],
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent
        className="max-w-md flex flex-col gap-4"
        data-testid="profile-delete-dialog"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{t('profiles.deleteDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('profiles.deleteDialogDescription', { name: profile.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="delete-profile-confirmation"
            className="text-sm font-medium"
            data-testid="profile-delete-confirmation-label"
          >
            {t('profiles.deleteDialogInputLabel', { name: profile.name })}
          </label>
          <Input
            id="delete-profile-confirmation"
            value={confirmationInput}
            onChange={(event) => {
              setConfirmationInput(event.target.value)
            }}
            placeholder={t('profiles.deleteDialogInputPlaceholder')}
            autoFocus
            data-testid="profile-delete-confirmation-input"
          />
          {!matchesProfileName && confirmationInput.length > 0 && (
            <p
              className="text-xs text-muted-foreground"
              data-testid="profile-delete-confirmation-help"
            >
              {t('profiles.deleteDialogInputHelp', { name: profile.name })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={deleting}
            data-testid="profile-delete-cancel"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={!matchesProfileName || deleting}
            data-testid="profile-delete-confirm"
          >
            {deleting ? t('profiles.deleting') : t('profiles.deleteConfirmAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ProfileDeleteConfirmDialog }
