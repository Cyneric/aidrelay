/**
 * @file src/renderer/components/servers/ServerForm.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Structured form for creating or editing an MCP server entry.
 * Managed by React Hook Form with a Zod schema for client-side validation.
 * Includes dynamic arg list management and the `EnvVarEditor` for environment
 * variables. Controlled externally so the parent can reset or populate it when
 * switching between the form and JSON tabs.
 */

import { useFieldArray, useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="server-name">
          Name{' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </Label>
        <Input
          id="server-name"
          type="text"
          placeholder="e.g. chrome-devtools"
          {...register('name')}
          className={cn(errors.name && 'border-destructive')}
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="server-type">Transport type</Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="server-type" data-testid="server-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">stdio</SelectItem>
                <SelectItem value="sse">SSE</SelectItem>
                <SelectItem value="http">HTTP</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* URL — only for SSE / HTTP transports */}
      {isNetworkTransport && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="server-url">
            Endpoint URL{' '}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </Label>
          <Input
            id="server-url"
            type="url"
            placeholder={
              selectedType === 'sse' ? 'https://example.com/sse' : 'https://example.com/mcp'
            }
            {...register('url')}
            className={cn('font-mono', errors.url && 'border-destructive')}
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="server-command">
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
        </Label>
        <Input
          id="server-command"
          type="text"
          placeholder="e.g. npx"
          {...register('command')}
          className={cn('font-mono', errors.command && 'border-destructive')}
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
            <Input
              type="text"
              {...register(`args.${index}.value`)}
              placeholder={`arg ${index + 1}`}
              className="font-mono"
              data-testid={`server-arg-${index}`}
              aria-label={`Argument ${index + 1}`}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeArg(index)}
                  aria-label={`Remove argument ${index + 1}`}
                >
                  <Trash2 size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove argument</TooltipContent>
            </Tooltip>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => appendArg({ value: '' })}
          className="self-start gap-1.5 text-muted-foreground"
          data-testid="add-arg-button"
        >
          <Plus size={14} />
          Add argument
        </Button>
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="server-tags">Tags</Label>
        <Input
          id="server-tags"
          type="text"
          placeholder="work, remote, dev (comma-separated)"
          {...register('tags')}
          data-testid="server-tags-input"
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="server-notes">Notes</Label>
        <Textarea
          id="server-notes"
          rows={3}
          placeholder="Optional notes about this server…"
          {...register('notes')}
          className="resize-none"
          data-testid="server-notes-input"
        />
      </div>

      {/* Actions */}
      <footer className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="server-form-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={saving} data-testid="server-form-submit">
          {saving ? 'Saving…' : defaultValues ? 'Save changes' : 'Add server'}
        </Button>
      </footer>
    </form>
  )
}

export { ServerForm }
export type { ServerFormProps }
