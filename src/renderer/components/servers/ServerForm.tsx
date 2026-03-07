/**
 * @file src/renderer/components/servers/ServerForm.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Structured form for creating or editing an MCP server entry.
 * Managed by React Hook Form with a Zod schema for client-side validation.
 * Includes dynamic arg list management and the `EnvVarEditor` for environment
 * variables. Controlled externally so the parent can reset or populate it when
 * switching between the form and JSON tabs.
 */

import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EnvVarEditor } from './EnvVarEditor'
import type { McpServer } from '@shared/types'
import type { CreateServerInput } from '@shared/channels'

// ─── Schema ───────────────────────────────────────────────────────────────────

/** Zod schema for the server form fields. */
const serverSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .regex(/^[a-z0-9_-]+$/i, 'Only letters, numbers, hyphens, and underscores allowed'),
    type: z.enum(['stdio', 'sse', 'http']),
    url: z.string(),
    command: z.string(),
    args: z.array(z.object({ value: z.string() })),
    env: z.record(z.string(), z.string()),
    secretEnvKeys: z.array(z.string()),
    notes: z.string(),
    tags: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'stdio' && data.command.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Command is required',
        path: ['command'],
      })
    }
    if ((data.type === 'sse' || data.type === 'http') && data.url.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL is required for this transport type',
        path: ['url'],
      })
    }
    if ((data.type === 'sse' || data.type === 'http') && data.url.length > 0) {
      try {
        new URL(data.url)
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a valid URL', path: ['url'] })
      }
    }
  })

type ServerFormValues = z.infer<typeof serverSchema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServerFormProps {
  /** Pre-populated values when editing an existing server, or `undefined` when creating. */
  readonly defaultValues?: McpServer
  /**
   * Called when the form is valid and submitted.
   *
   * @param data - Validated form data ready to pass to the IPC layer.
   */
  readonly onSubmit: (data: CreateServerInput & { secretEnvKeys: string[] }) => void
  /** Called when the user presses Cancel. */
  readonly onCancel: () => void
  /** Whether an async save operation is in progress. */
  readonly saving?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a `McpServer` into the flat form values structure.
 */
const serverToFormValues = (server: McpServer): ServerFormValues => ({
  name: server.name,
  type: server.type,
  url: server.url ?? '',
  command: server.command,
  args: server.args.map((v) => ({ value: v })),
  env: { ...server.env },
  secretEnvKeys: [...server.secretEnvKeys],
  notes: server.notes,
  tags: server.tags.join(', '),
})

const defaultFormValues = (): ServerFormValues => ({
  name: '',
  type: 'stdio',
  url: '',
  command: '',
  args: [],
  env: {},
  secretEnvKeys: [],
  notes: '',
  tags: '',
})

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Structured form for defining an MCP server. Handles the common case —
 * the JSON mode tab in `ServerEditor` calls `reset()` externally when the
 * user switches between tabs.
 */
const ServerForm = ({ defaultValues, onSubmit, onCancel, saving = false }: ServerFormProps) => {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ServerFormValues>({
    resolver: zodResolver(serverSchema),
    defaultValues: defaultValues ? serverToFormValues(defaultValues) : defaultFormValues(),
  })

  const {
    fields: argFields,
    append: appendArg,
    remove: removeArg,
  } = useFieldArray({
    control,
    name: 'args',
  })

  const selectedType = useWatch({ control, name: 'type' })
  const isNetworkTransport = selectedType === 'sse' || selectedType === 'http'

  const submit = (data: ServerFormValues) => {
    onSubmit({
      name: data.name,
      type: data.type,
      ...(data.url ? { url: data.url } : {}),
      command: data.command,
      args: data.args.map((a) => a.value),
      env: data.env,
      secretEnvKeys: data.secretEnvKeys,
      notes: data.notes,
      tags: data.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    })
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(submit)(e)
      }}
      className="flex flex-col gap-5"
      noValidate
      data-testid="server-form"
    >
      {/* Name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="server-name" className="text-sm font-medium">
          Name{' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <input
          id="server-name"
          type="text"
          placeholder="e.g. chrome-devtools"
          {...register('name')}
          className={cn(
            'rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
            errors.name ? 'border-destructive' : 'border-input',
          )}
          data-testid="server-name-input"
          aria-describedby={errors.name ? 'server-name-error' : undefined}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <span id="server-name-error" role="alert" className="text-xs text-destructive">
            {errors.name.message}
          </span>
        )}
      </div>

      {/* Type */}
      <div className="flex flex-col gap-1">
        <label htmlFor="server-type" className="text-sm font-medium">
          Transport type
        </label>
        <select
          id="server-type"
          {...register('type')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="server-type-select"
        >
          <option value="stdio">stdio</option>
          <option value="sse">SSE</option>
          <option value="http">HTTP</option>
        </select>
      </div>

      {/* URL — only for SSE / HTTP transports */}
      {isNetworkTransport && (
        <div className="flex flex-col gap-1">
          <label htmlFor="server-url" className="text-sm font-medium">
            Endpoint URL{' '}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <input
            id="server-url"
            type="url"
            placeholder={
              selectedType === 'sse' ? 'https://example.com/sse' : 'https://example.com/mcp'
            }
            {...register('url')}
            className={cn(
              'rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring',
              errors.url ? 'border-destructive' : 'border-input',
            )}
            data-testid="server-url-input"
            aria-invalid={!!errors.url}
            aria-describedby={errors.url ? 'server-url-error' : undefined}
          />
          {errors.url && (
            <span id="server-url-error" role="alert" className="text-xs text-destructive">
              {errors.url.message}
            </span>
          )}
        </div>
      )}

      {/* Command */}
      <div className="flex flex-col gap-1">
        <label htmlFor="server-command" className="text-sm font-medium">
          {isNetworkTransport ? (
            'Command'
          ) : (
            <>
              Command{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </>
          )}
        </label>
        <input
          id="server-command"
          type="text"
          placeholder="e.g. npx"
          {...register('command')}
          className={cn(
            'rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring',
            errors.command ? 'border-destructive' : 'border-input',
          )}
          data-testid="server-command-input"
          aria-invalid={!!errors.command}
        />
        {errors.command && (
          <span role="alert" className="text-xs text-destructive">
            {errors.command.message}
          </span>
        )}
      </div>

      {/* Args */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Arguments</span>
        {argFields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <input
              type="text"
              {...register(`args.${index}.value`)}
              placeholder={`arg ${index + 1}`}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid={`server-arg-${index}`}
              aria-label={`Argument ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => removeArg(index)}
              className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
              aria-label={`Remove argument ${index + 1}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => appendArg({ value: '' })}
          className="self-start inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="add-arg-button"
        >
          <Plus size={14} />
          Add argument
        </button>
      </div>

      {/* Env vars */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Environment variables</span>
        <EnvVarEditor
          env={watch('env')}
          secretEnvKeys={watch('secretEnvKeys')}
          onChange={(env, secretEnvKeys) => {
            setValue('env', env)
            setValue('secretEnvKeys', secretEnvKeys)
          }}
        />
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-1">
        <label htmlFor="server-tags" className="text-sm font-medium">
          Tags
        </label>
        <input
          id="server-tags"
          type="text"
          placeholder="work, remote, dev (comma-separated)"
          {...register('tags')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="server-tags-input"
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label htmlFor="server-notes" className="text-sm font-medium">
          Notes
        </label>
        <textarea
          id="server-notes"
          rows={3}
          placeholder="Optional notes about this server…"
          {...register('notes')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          data-testid="server-notes-input"
        />
      </div>

      {/* Actions */}
      <footer className="flex justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm border border-input hover:bg-accent transition-colors"
          data-testid="server-form-cancel"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="server-form-submit"
        >
          {saving ? 'Saving…' : defaultValues ? 'Save changes' : 'Add server'}
        </button>
      </footer>
    </form>
  )
}

export { ServerForm }
export type { ServerFormProps }
