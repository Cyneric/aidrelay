/**
 * @file src/renderer/components/profiles/ProfileForm.tsx
 *
 * @created 07.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Metadata form for creating or editing a profile. Managed by
 * React Hook Form with a Zod schema. Handles name, description, icon (emoji),
 * color (preset swatches + native color picker), and optional parent profile.
 */

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Profile } from '@shared/types'
import type { CreateProfileInput } from '@shared/channels'

// ─── Schema ───────────────────────────────────────────────────────────────────

const ICON_EMOJIS = [
  '🚀',
  '💻',
  '🧠',
  '⚡',
  '🔧',
  '🐞',
  '🎯',
  '📚',
  '🛡️',
  '🧪',
  '📝',
  '🤖',
] as const

const createProfileSchema = (additionalAllowedIcon?: string) => {
  const allowedIcons = additionalAllowedIcon ? [...ICON_EMOJIS, additionalAllowedIcon] : ICON_EMOJIS
  const iconEnum = z.enum(allowedIcons as [string, ...string[]])

  return z.object({
    name: z.string().min(1, 'Name is required').max(64, 'Name is too long'),
    description: z.string().max(256, 'Description is too long'),
    icon: z.union([z.literal(''), iconEnum]),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex colour'),
    parentProfileId: z.string().optional(),
  })
}

type ProfileFormValues = z.infer<ReturnType<typeof createProfileSchema>>

const NONE_PROFILE_VALUE = '__none__' as const

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
  const legacyIcon =
    defaultValues?.icon && !ICON_EMOJIS.includes(defaultValues.icon as (typeof ICON_EMOJIS)[number])
      ? defaultValues.icon
      : undefined

  const profileSchema = createProfileSchema(legacyIcon)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
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
        <Label htmlFor="profile-name">
          Name{' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </Label>
        <Input
          id="profile-name"
          type="text"
          {...register('name')}
          placeholder="Work mode"
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
        <Label htmlFor="profile-description">Description</Label>
        <Input
          id="profile-description"
          type="text"
          {...register('description')}
          placeholder="Optimised for focused coding sessions"
          data-testid="profile-description-input"
        />
      </div>

      {/* Icon */}
      <div className="flex flex-col gap-1.5">
        <Label>
          Icon <span className="text-muted-foreground text-xs">(emoji)</span>
        </Label>
        <Controller
          control={control}
          name="icon"
          render={({ field }) => {
            const selectedIcon = field.value ?? ''
            return (
              <div
                className="flex items-center gap-2 flex-wrap"
                role="group"
                aria-label="Profile icon"
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => field.onChange('')}
                  className={cn(
                    'h-9 px-3',
                    selectedIcon === '' &&
                      'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  )}
                  aria-label="Clear icon"
                  aria-pressed={selectedIcon === ''}
                  data-testid="icon-clear"
                >
                  None
                </Button>
                {ICON_EMOJIS.map((emoji, index) => {
                  const selected = selectedIcon === emoji
                  return (
                    <Button
                      key={emoji}
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => field.onChange(emoji)}
                      className={cn(
                        'w-9 h-9 rounded-md text-lg',
                        selected &&
                          'bg-accent text-accent-foreground ring-2 ring-primary ring-offset-2 ring-offset-background',
                      )}
                      aria-label={`Select icon ${emoji}`}
                      aria-pressed={selected}
                      data-testid={`icon-option-${index}`}
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </Button>
                  )
                })}
              </div>
            )
          }}
        />
        {errors.icon && (
          <p className="text-xs text-destructive" role="alert">
            {errors.icon.message}
          </p>
        )}
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <Label>Colour</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <Tooltip key={c}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setValue('color', c)}
                  className={cn(
                    'w-6 h-6 rounded-full p-0',
                    color === c && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Select colour ${c}`}
                  aria-pressed={color === c}
                  data-testid={`color-swatch-${c}`}
                />
              </TooltipTrigger>
              <TooltipContent>{c}</TooltipContent>
            </Tooltip>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Input
                type="color"
                {...register('color')}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 h-8 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Custom colour"
                data-testid="color-picker"
              />
            </TooltipTrigger>
            <TooltipContent>Pick a custom colour</TooltipContent>
          </Tooltip>
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
          <Label htmlFor="parent-profile">Inherit from</Label>
          <Controller
            control={control}
            name="parentProfileId"
            render={({ field }) => (
              <Select
                value={field.value && field.value !== '' ? field.value : NONE_PROFILE_VALUE}
                onValueChange={(v) => field.onChange(v === NONE_PROFILE_VALUE ? '' : v)}
              >
                <SelectTrigger id="parent-profile" data-testid="parent-profile-select">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_PROFILE_VALUE}>None</SelectItem>
                  {availableParents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          data-testid="profile-form-cancel"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving} data-testid="profile-form-submit">
          {saving ? 'Saving…' : defaultValues ? 'Save changes' : 'Create profile'}
        </Button>
      </div>
    </form>
  )
}

export { ProfileForm }
