/**
 * @file src/renderer/components/profiles/ProfileForm.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Metadata form for creating or editing a profile. Managed by
 * React Hook Form with a Zod schema. Handles name, description, icon (emoji),
 * color (preset swatches + native color picker), and optional parent profile.
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Profile } from '@shared/types'
import type { CreateProfileInput } from '@shared/channels'

// ─── Schema ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(64, 'Name is too long'),
  description: z.string().max(256, 'Description is too long'),
  icon: z.string().max(4, 'Use a single emoji or leave blank'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex colour'),
  parentProfileId: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

// ─── Preset colours ───────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#64748b',
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileFormProps {
  /** Pre-populated values when editing. */
  readonly defaultValues?: Profile
  /** Other profiles available as parents. */
  readonly availableParents?: readonly Profile[]
  /** Called when the form is submitted successfully. */
  readonly onSubmit: (data: CreateProfileInput) => void
  /** Called when the user cancels. */
  readonly onCancel: () => void
  /** Whether a save operation is in flight. */
  readonly saving?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

const ProfileForm = ({
  defaultValues,
  availableParents = [],
  onSubmit,
  onCancel,
  saving = false,
}: ProfileFormProps) => {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      icon: defaultValues?.icon ?? '',
      color: defaultValues?.color ?? '#6366f1',
      parentProfileId: defaultValues?.parentProfileId ?? '',
    },
  })

  const color = watch('color')

  const handleValidSubmit = (values: ProfileFormValues) => {
    onSubmit({
      name: values.name,
      ...(values.description && { description: values.description }),
      ...(values.icon && { icon: values.icon }),
      color: values.color,
      ...(values.parentProfileId && { parentProfileId: values.parentProfileId }),
    })
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(handleValidSubmit)(e)
      }}
      className="flex flex-col gap-5"
      data-testid="profile-form"
      noValidate
    >
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-name" className="text-sm font-medium">
          Name{' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <input
          id="profile-name"
          type="text"
          {...register('name')}
          placeholder="Work mode"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="profile-name-input"
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-xs text-destructive" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-description" className="text-sm font-medium">
          Description
        </label>
        <input
          id="profile-description"
          type="text"
          {...register('description')}
          placeholder="Optimised for focused coding sessions"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="profile-description-input"
        />
      </div>

      {/* Icon */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-icon" className="text-sm font-medium">
          Icon <span className="text-muted-foreground text-xs">(emoji)</span>
        </label>
        <input
          id="profile-icon"
          type="text"
          {...register('icon')}
          placeholder="🚀"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="profile-icon-input"
          aria-invalid={!!errors.icon}
        />
        {errors.icon && (
          <p className="text-xs text-destructive" role="alert">
            {errors.icon.message}
          </p>
        )}
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Colour</label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue('color', c)}
              className="w-6 h-6 rounded-full ring-offset-background transition-shadow"
              style={{
                backgroundColor: c,
                boxShadow: color === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : undefined,
              }}
              aria-label={`Select colour ${c}`}
              aria-pressed={color === c}
              data-testid={`color-swatch-${c}`}
            />
          ))}
          <input
            type="color"
            {...register('color')}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
            aria-label="Custom colour"
            data-testid="color-picker"
          />
        </div>
        {errors.color && (
          <p className="text-xs text-destructive" role="alert">
            {errors.color.message}
          </p>
        )}
      </div>

      {/* Parent profile */}
      {availableParents.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="parent-profile" className="text-sm font-medium">
            Inherit from
          </label>
          <select
            id="parent-profile"
            {...register('parentProfileId')}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="parent-profile-select"
          >
            <option value="">None</option>
            {availableParents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm border border-input hover:bg-accent transition-colors"
          data-testid="profile-form-cancel"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          data-testid="profile-form-submit"
        >
          {saving ? 'Saving…' : defaultValues ? 'Save changes' : 'Create profile'}
        </button>
      </div>
    </form>
  )
}

export { ProfileForm }
