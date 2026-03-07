/**
 * @file src/renderer/components/rules/RuleForm.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
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

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
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
        <label htmlFor="rule-name" className="text-sm font-medium">
          Name{' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <input
          id="rule-name"
          type="text"
          placeholder="typescript-strict"
          {...register('name')}
          className={cn(
            'rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring',
            errors.name ? 'border-destructive' : 'border-input',
          )}
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
        <label htmlFor="rule-description" className="text-sm font-medium">
          Description
        </label>
        <input
          id="rule-description"
          type="text"
          placeholder="Brief explanation of what this rule enforces"
          {...register('description')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="rule-description-input"
        />
      </div>

      {/* Category + Priority (side by side) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rule-category" className="text-sm font-medium">
            Category{' '}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <input
            id="rule-category"
            type="text"
            placeholder="general"
            {...register('category')}
            className={cn(
              'rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring',
              errors.category ? 'border-destructive' : 'border-input',
            )}
            data-testid="rule-category-input"
          />
          {errors.category && (
            <p className="text-xs text-destructive" role="alert">
              {errors.category.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="rule-priority" className="text-sm font-medium">
            Priority
          </label>
          <select
            id="rule-priority"
            {...register('priority')}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="rule-priority-select"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
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
          <label htmlFor="rule-project-path" className="text-sm font-medium">
            Project path{' '}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <input
            id="rule-project-path"
            type="text"
            placeholder="C:\dev\my-project"
            {...register('projectPath')}
            className={cn(
              'rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring',
              errors.projectPath ? 'border-destructive' : 'border-input',
            )}
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
          <button
            type="button"
            onClick={() => appendGlob({ value: '' })}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            data-testid="add-glob-button"
          >
            <Plus size={12} aria-hidden="true" /> Add glob
          </button>
        </div>
        {globFields.length === 0 ? (
          <p className="text-xs text-muted-foreground">No globs — rule applies to all files.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {globFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="**/*.ts"
                  {...register(`fileGlobs.${index}.value`)}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid={`glob-input-${index}`}
                />
                <button
                  type="button"
                  onClick={() => removeGlob(index)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remove glob"
                  data-testid={`remove-glob-${index}`}
                >
                  <Trash2 size={12} />
                </button>
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
        <label htmlFor="rule-tags" className="text-sm font-medium">
          Tags
        </label>
        <input
          id="rule-tags"
          type="text"
          placeholder="typescript, react, testing"
          {...register('tags')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="rule-tags-input"
        />
        <p className="text-xs text-muted-foreground">Comma-separated</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm border border-input hover:bg-accent transition-colors"
          data-testid="rule-form-cancel"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="rule-form-submit"
        >
          {saving ? 'Saving…' : defaultValues ? 'Save changes' : 'Add rule'}
        </button>
      </div>
    </form>
  )
}

export { RuleForm }
