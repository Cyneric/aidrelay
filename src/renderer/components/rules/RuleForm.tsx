/**
 * @file src/renderer/components/rules/RuleForm.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Structured form for creating or editing an AI rule's metadata.
 * Managed by React Hook Form with a Zod schema for validation. Handles
 * name, description, category, priority, scope, project path (conditional),
 * file globs, alwaysApply, and tags. Content (Markdown) is managed in the
 * sibling `RuleMarkdownEditor` — not here.
 */

import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AiRule } from '@shared/types'
import type { CreateRuleInput } from '@shared/channels'

// ─── Schema ───────────────────────────────────────────────────────────────────

/** Zod schema for the rule metadata form. */
const ruleSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .regex(/^[a-z0-9_-]+$/i, 'Only letters, numbers, hyphens, and underscores allowed'),
    description: z.string(),
    category: z.string().min(1, 'Category is required'),
    priority: z.enum(['critical', 'high', 'normal', 'low']),
    scope: z.enum(['global', 'project']),
    projectPath: z.string(),
    fileGlobs: z.array(z.object({ value: z.string() })),
    alwaysApply: z.boolean(),
    tags: z.string(),
  })
  .refine((data) => data.scope !== 'project' || data.projectPath.trim().length > 0, {
    message: 'Project path is required for project-scoped rules',
    path: ['projectPath'],
  })

type RuleFormValues = z.infer<typeof ruleSchema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface RuleFormProps {
  /** Pre-populated values when editing an existing rule, or `undefined` when creating. */
  readonly defaultValues?: AiRule
  /**
   * Called when the form is valid and the user submits.
   *
   * @param data - Validated form data ready to pass to the IPC layer.
   */
  readonly onSubmit: (data: Omit<CreateRuleInput, 'content'>) => void
  /** Called when the user presses Cancel. */
  readonly onCancel: () => void
  /** Whether an async save operation is in progress. */
  readonly saving?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts an `AiRule` domain object into the flat form values shape.
 *
 * @param rule - The rule to convert.
 * @returns Form-compatible default values.
 */
const ruleToFormValues = (rule: AiRule): RuleFormValues => ({
  name: rule.name,
  description: rule.description,
  category: rule.category,
  priority: rule.priority,
  scope: rule.scope,
  projectPath: rule.projectPath ?? '',
  fileGlobs: rule.fileGlobs.map((v) => ({ value: v })),
  alwaysApply: rule.alwaysApply,
  tags: rule.tags.join(', '),
})

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Metadata form for an AI rule. Covers everything except the Markdown content,
 * which is handled by `RuleMarkdownEditor` in the adjacent "Content" tab.
 */
const RuleForm = ({ defaultValues, onSubmit, onCancel, saving = false }: RuleFormProps) => {
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: defaultValues
      ? ruleToFormValues(defaultValues)
      : {
          name: '',
          description: '',
          category: 'general',
          priority: 'normal',
          scope: 'global',
          projectPath: '',
          fileGlobs: [],
          alwaysApply: false,
          tags: '',
        },
  })

  const {
    fields: globFields,
    append: appendGlob,
    remove: removeGlob,
  } = useFieldArray({
    control,
    name: 'fileGlobs',
  })

  const scope = watch('scope')

  const handleValidSubmit = (values: RuleFormValues) => {
    onSubmit({
      name: values.name,
      ...(values.description && { description: values.description }),
      category: values.category,
      priority: values.priority,
      scope: values.scope,
      ...(values.scope === 'project' && values.projectPath && { projectPath: values.projectPath }),
      fileGlobs: values.fileGlobs.map((f) => f.value).filter(Boolean),
      alwaysApply: values.alwaysApply,
      tags: values.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    })
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(handleValidSubmit)(e)
      }}
      className="flex flex-col gap-5"
      data-testid="rule-form"
      noValidate
    >
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rule-name">
          Name{' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </Label>
        <Input
          id="rule-name"
          type="text"
          placeholder="typescript-strict"
          {...register('name')}
          className={cn('font-mono', errors.name && 'border-destructive')}
          data-testid="rule-name-input"
        />
        {errors.name && (
          <p className="text-xs text-destructive" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rule-description">Description</Label>
        <Input
          id="rule-description"
          type="text"
          placeholder="Brief explanation of what this rule enforces"
          {...register('description')}
          data-testid="rule-description-input"
        />
      </div>

      {/* Category + Priority (side by side) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rule-category">
            Category{' '}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </Label>
          <Input
            id="rule-category"
            type="text"
            placeholder="general"
            {...register('category')}
            className={cn('font-mono', errors.category && 'border-destructive')}
            data-testid="rule-category-input"
          />
          {errors.category && (
            <p className="text-xs text-destructive" role="alert">
              {errors.category.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rule-priority">Priority</Label>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="rule-priority" data-testid="rule-priority-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {/* Scope */}
      <div className="flex flex-col gap-1.5">
        <fieldset>
          <legend className="text-sm font-medium mb-2">Scope</legend>
          <div className="flex gap-4">
            {(['global', 'project'] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  value={s}
                  {...register('scope')}
                  className="accent-primary"
                  data-testid={`rule-scope-${s}`}
                />
                <span className="capitalize">{s}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Project path — only shown for project scope */}
      {scope === 'project' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rule-project-path">
            Project path{' '}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </Label>
          <Input
            id="rule-project-path"
            type="text"
            placeholder="C:\dev\my-project"
            {...register('projectPath')}
            className={cn('font-mono', errors.projectPath && 'border-destructive')}
            data-testid="rule-project-path-input"
          />
          {errors.projectPath && (
            <p className="text-xs text-destructive" role="alert">
              {errors.projectPath.message}
            </p>
          )}
        </div>
      )}

      {/* File globs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">File globs</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => appendGlob({ value: '' })}
            className="gap-1 text-primary"
            data-testid="add-glob-button"
          >
            <Plus size={12} aria-hidden="true" /> Add glob
          </Button>
        </div>
        {globFields.length === 0 ? (
          <p className="text-xs text-muted-foreground">No globs — rule applies to all files.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {globFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="**/*.ts"
                  {...register(`fileGlobs.${index}.value`)}
                  className="flex-1 font-mono text-xs"
                  data-testid={`glob-input-${index}`}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeGlob(index)}
                      aria-label="Remove glob"
                      data-testid={`remove-glob-${index}`}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove glob</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Always apply toggle */}
      <label className="flex items-center gap-2.5 cursor-pointer text-sm">
        <input
          type="checkbox"
          {...register('alwaysApply')}
          className="h-4 w-4 accent-primary"
          data-testid="rule-always-apply-checkbox"
        />
        <span>Always apply (Cursor: always include in context regardless of file match)</span>
      </label>

      {/* Tags */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rule-tags">Tags</Label>
        <Input
          id="rule-tags"
          type="text"
          placeholder="typescript, react, testing"
          {...register('tags')}
          data-testid="rule-tags-input"
        />
        <p className="text-xs text-muted-foreground">Comma-separated</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="rule-form-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={saving} data-testid="rule-form-submit">
          {saving ? 'Saving…' : defaultValues ? 'Save changes' : 'Add rule'}
        </Button>
      </div>
    </form>
  )
}

export { RuleForm }
