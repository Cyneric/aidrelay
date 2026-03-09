/**
 * @file src/main/registry/install-resolver.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Canonical registry install resolver used by both registry-page
 * installs and the add-server wizard. Produces deterministic install plans from
 * provider metadata, then resolves a reviewed install request into a final
 * `CreateServerInput` plus secret values for keytar persistence.
 */

import type {
  RegistryInstallInputField,
  RegistryInstallOption,
  RegistryInstallPlan,
  RegistryInstallRequest,
  RegistryProvider,
  CreateServerInput,
} from '@shared/channels'
import type { McpServerType } from '@shared/types'
import { officialRegistryClient } from './official-registry.client'
import type {
  OfficialArgument,
  OfficialInput,
  OfficialKeyValueInput,
  OfficialPackage,
  OfficialTransport,
} from './official-registry.client'
import { smitheryClient } from './smithery.client'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Resolved install payload plus secret values that must be written to keytar.
 */
export interface ResolvedRegistryInstall {
  readonly createInput: CreateServerInput
  readonly secretEnvValues: Readonly<Record<string, string>>
  readonly secretHeaderValues: Readonly<Record<string, string>>
}

interface OptionBuildContext {
  readonly option: {
    id: string
    label: string
    description?: string
    type: McpServerType
    command: string
    args: string[]
    env: Record<string, string>
    headers: Record<string, string>
    url?: string
  }
  readonly fields: RegistryInstallInputField[]
  readonly fieldsByKey: Map<string, RegistryInstallInputField>
}

interface InputLike {
  readonly name?: string
  readonly description?: string
  readonly format?: string
  readonly isRequired?: boolean
  readonly isSecret?: boolean
  readonly default?: string
  readonly placeholder?: string
  readonly value?: string
  readonly variables?: Record<string, unknown>
  readonly valueHint?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLACEHOLDER_RE = /\{([^}]+)\}/g

const RUNTIME_HINT_BY_REGISTRY: Record<string, string> = {
  npm: 'npx',
  pypi: 'uvx',
  oci: 'docker',
  nuget: 'dnx',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const normalizeTransportType = (value: unknown): McpServerType => {
  const normalized = normalizeText(value).toLowerCase()
  if (normalized === 'sse') return 'sse'
  if (normalized === 'http' || normalized === 'streamable-http' || normalized === 'streamablehttp')
    return 'http'
  return 'stdio'
}

const toFieldKey = (raw: string, fallback: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) return fallback
  const cleaned = trimmed
    .replace(/^\{+|\}+$/g, '')
    .replace(/^-+/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned || fallback
}

const extractPlaceholders = (template: string): string[] => {
  const placeholders = new Set<string>()
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const key = normalizeText(match[1])
    if (key) placeholders.add(key)
  }
  return [...placeholders]
}

const resolveInlineVariables = (template: string, vars?: Record<string, unknown>): string => {
  if (!vars || Object.keys(vars).length === 0) return template
  return template.replace(PLACEHOLDER_RE, (_m: string, key: string) => {
    const raw = vars[key]
    if (typeof raw === 'string') return raw
    if (typeof raw === 'object' && raw !== null) {
      const variable = raw as { value?: unknown; default?: unknown }
      if (typeof variable.value === 'string') return variable.value
      if (typeof variable.default === 'string') return variable.default
    }
    return `{${key}}`
  })
}

const resolveTemplate = (template: string, values: Readonly<Record<string, string>>): string =>
  template.replace(PLACEHOLDER_RE, (_match: string, key: string) => values[key] ?? `{${key}}`)

const deriveServerName = (serverId: string): string => {
  const base = normalizeText(serverId.split('/').pop() ?? serverId)
  const cleaned = base
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'mcp-server'
}

const defaultRuntimeHint = (registryType: string): string =>
  RUNTIME_HINT_BY_REGISTRY[registryType.toLowerCase()] ?? 'npx'

const createOptionContext = (option: OptionBuildContext['option']): OptionBuildContext => ({
  option,
  fields: [],
  fieldsByKey: new Map<string, RegistryInstallInputField>(),
})

const upsertField = (
  ctx: OptionBuildContext,
  field: RegistryInstallInputField,
): RegistryInstallInputField => {
  const existing = ctx.fieldsByKey.get(field.key)
  if (!existing) {
    ctx.fieldsByKey.set(field.key, field)
    ctx.fields.push(field)
    return field
  }

  const merged: RegistryInstallInputField = {
    ...existing,
    required: existing.required || field.required,
    secret: existing.secret || field.secret,
    ...(existing.description !== undefined
      ? {}
      : field.description !== undefined
        ? { description: field.description }
        : {}),
    ...(existing.defaultValue !== undefined
      ? {}
      : field.defaultValue !== undefined
        ? { defaultValue: field.defaultValue }
        : {}),
    ...(existing.placeholder !== undefined
      ? {}
      : field.placeholder !== undefined
        ? { placeholder: field.placeholder }
        : {}),
  }

  if (merged !== existing) {
    const index = ctx.fields.findIndex((f) => f.key === merged.key)
    if (index >= 0) ctx.fields[index] = merged
    ctx.fieldsByKey.set(merged.key, merged)
  }
  return merged
}

const registerTemplatePlaceholders = (
  ctx: OptionBuildContext,
  template: string,
  target: RegistryInstallInputField['target'],
  defaultsByKey?: Readonly<Record<string, OfficialInput>>,
): void => {
  for (const token of extractPlaceholders(template)) {
    const defaultInput = defaultsByKey?.[token]
    upsertField(ctx, {
      key: token,
      label: token,
      ...(normalizeText(defaultInput?.description)
        ? { description: normalizeText(defaultInput?.description) }
        : {}),
      required:
        defaultInput?.isRequired === true || normalizeText(defaultInput?.default).length === 0,
      secret: defaultInput?.isSecret === true,
      ...(normalizeText(defaultInput?.default)
        ? { defaultValue: normalizeText(defaultInput?.default) }
        : {}),
      ...(normalizeText(defaultInput?.placeholder)
        ? { placeholder: normalizeText(defaultInput?.placeholder) }
        : {}),
      target,
    })
  }
}

const resolveInputTemplate = (
  ctx: OptionBuildContext,
  input: InputLike,
  target: RegistryInstallInputField['target'],
  requestedKey: string,
): string | null => {
  const explicit = resolveInlineVariables(normalizeText(input.value), input.variables)
  if (explicit.length > 0) {
    registerTemplatePlaceholders(ctx, explicit, target)
    return explicit
  }

  const defaultValue = resolveInlineVariables(normalizeText(input.default), input.variables)
  const wantsField =
    defaultValue.length > 0 ||
    input.isRequired === true ||
    normalizeText(input.placeholder).length > 0 ||
    normalizeText(input.description).length > 0

  if (!wantsField) return null

  const key = toFieldKey(
    requestedKey || input.valueHint || input.name || 'value',
    `input_${ctx.fields.length + 1}`,
  )
  upsertField(ctx, {
    key,
    label: key,
    ...(normalizeText(input.description) ? { description: normalizeText(input.description) } : {}),
    required: input.isRequired === true,
    secret: input.isSecret === true,
    ...(defaultValue.length > 0 ? { defaultValue } : {}),
    ...(normalizeText(input.placeholder) ? { placeholder: normalizeText(input.placeholder) } : {}),
    target,
  })

  return `{${key}}`
}

const argumentTemplates = (ctx: OptionBuildContext, arg: OfficialArgument): string[] => {
  const kind = normalizeText(arg.type).toLowerCase()
  const name = normalizeText(arg.name)
  const value = resolveInputTemplate(
    ctx,
    arg,
    'arg',
    normalizeText(arg.valueHint) || name || `arg_${ctx.fields.length + 1}`,
  )

  if (kind === 'named') {
    if (!name) return value ? [value] : []
    if (!value) return [name]
    if (normalizeText(arg.format).toLowerCase() === 'boolean') {
      return [`${name}=${value}`]
    }
    return [name, value]
  }

  if (value) return [value]
  if (name) return [name]
  return []
}

const addEnvironmentInputs = (
  ctx: OptionBuildContext,
  envInputs?: OfficialKeyValueInput[],
): void => {
  if (!Array.isArray(envInputs)) return
  for (const input of envInputs) {
    const envKey = normalizeText(input.name)
    if (!envKey) continue
    const valueTemplate = resolveInputTemplate(ctx, input, 'env', envKey)
    if (valueTemplate && normalizeText(valueTemplate).length > 0) {
      ctx.option.env[envKey] = valueTemplate
    }
  }
}

const addHeaderInputs = (ctx: OptionBuildContext, headers?: OfficialKeyValueInput[]): void => {
  if (!Array.isArray(headers)) return
  for (const input of headers) {
    const headerKey = normalizeText(input.name)
    if (!headerKey) continue
    const valueTemplate = resolveInputTemplate(ctx, input, 'header', headerKey)
    if (valueTemplate && normalizeText(valueTemplate).length > 0) {
      ctx.option.headers[headerKey] = valueTemplate
    }
  }
}

const addRemoteVariables = (
  ctx: OptionBuildContext,
  variables?: Record<string, OfficialInput>,
): void => {
  if (!variables) return
  for (const [key, input] of Object.entries(variables)) {
    upsertField(ctx, {
      key,
      label: key,
      ...(normalizeText(input.description)
        ? { description: normalizeText(input.description) }
        : {}),
      required: input.isRequired === true || normalizeText(input.default).length === 0,
      secret: input.isSecret === true,
      ...(normalizeText(input.default) ? { defaultValue: normalizeText(input.default) } : {}),
      ...(normalizeText(input.placeholder)
        ? { placeholder: normalizeText(input.placeholder) }
        : {}),
      target: 'url',
    })
  }
}

const finalizeOption = (ctx: OptionBuildContext): RegistryInstallOption => ({
  id: ctx.option.id,
  label: ctx.option.label,
  ...(ctx.option.description !== undefined ? { description: ctx.option.description } : {}),
  type: ctx.option.type,
  command: ctx.option.command,
  args: [...ctx.option.args],
  ...(ctx.option.url !== undefined ? { url: ctx.option.url } : {}),
  ...(Object.keys(ctx.option.env).length > 0 ? { env: { ...ctx.option.env } } : {}),
  ...(Object.keys(ctx.option.headers).length > 0 ? { headers: { ...ctx.option.headers } } : {}),
  inputFields: [...ctx.fields],
})

const buildOfficialPackageOption = (
  _serverName: string,
  pkg: OfficialPackage,
  index: number,
): RegistryInstallOption => {
  const transport = pkg.transport
  const type = normalizeTransportType(transport?.type)
  const runtimeHint =
    normalizeText(pkg.runtimeHint) || defaultRuntimeHint(normalizeText(pkg.registryType))
  const command = runtimeHint
  const ctx = createOptionContext({
    id: `official-package-${index + 1}`,
    label:
      type === 'stdio'
        ? `Package (${normalizeText(pkg.registryType) || 'runtime'})`
        : 'Package (local runtime + remote transport)',
    description: normalizeText(pkg.identifier),
    type,
    command,
    args: [],
    env: {},
    headers: {},
  })

  const runtimeArgs = Array.isArray(pkg.runtimeArguments) ? pkg.runtimeArguments : []
  for (const arg of runtimeArgs) {
    ctx.option.args.push(...argumentTemplates(ctx, arg))
  }

  const identifier = normalizeText(pkg.identifier)
  if (identifier.length > 0) {
    if (command === 'docker') {
      if (ctx.option.args.length === 0 || ctx.option.args[0] !== 'run') {
        ctx.option.args.unshift('run')
      }
      ctx.option.args.push(identifier)
    } else {
      ctx.option.args.push(identifier)
    }
  }

  const packageArgs = Array.isArray(pkg.packageArguments) ? pkg.packageArguments : []
  for (const arg of packageArgs) {
    ctx.option.args.push(...argumentTemplates(ctx, arg))
  }

  addEnvironmentInputs(ctx, pkg.environmentVariables)
  addHeaderInputs(ctx, transport?.headers)

  const url = normalizeText(transport?.url)
  if (url.length > 0) {
    ctx.option.url = url
    registerTemplatePlaceholders(ctx, url, 'url')
  }

  if (transport?.variables) {
    addRemoteVariables(ctx, transport.variables)
  }

  return finalizeOption(ctx)
}

const buildOfficialRemoteOption = (
  remote: OfficialTransport,
  index: number,
): RegistryInstallOption => {
  const type = normalizeTransportType(remote.type)
  const url = normalizeText(remote.url)
  const ctx = createOptionContext({
    id: `official-remote-${index + 1}`,
    label: type === 'sse' ? 'Hosted (SSE)' : 'Hosted (HTTP)',
    type,
    command: 'fetch',
    args: [],
    env: {},
    headers: {},
    ...(url.length > 0 ? { url } : {}),
  })

  if (url.length > 0) {
    registerTemplatePlaceholders(ctx, url, 'url', remote.variables)
  }
  addRemoteVariables(ctx, remote.variables)
  addHeaderInputs(ctx, remote.headers)
  return finalizeOption(ctx)
}

const buildOfficialPlan = async (serverId: string): Promise<RegistryInstallPlan> => {
  const detail = await officialRegistryClient.getLatestServerVersion(serverId)
  if (!detail) {
    throw new Error(`Official registry server not found: ${serverId}`)
  }

  const options: RegistryInstallOption[] = []
  const packages = Array.isArray(detail.packages) ? detail.packages : []
  const remotes = Array.isArray(detail.remotes) ? detail.remotes : []

  for (const [index, pkg] of packages.entries()) {
    options.push(buildOfficialPackageOption(normalizeText(detail.name) || serverId, pkg, index))
  }
  for (const [index, remote] of remotes.entries()) {
    options.push(buildOfficialRemoteOption(remote, index))
  }

  if (options.length === 0) {
    throw new Error(`No install options available for "${serverId}"`)
  }

  return {
    provider: 'official',
    serverId,
    displayName: normalizeText(detail.title) || normalizeText(detail.name) || serverId,
    description: normalizeText(detail.description),
    options,
    ...(options.length === 1 && options[0] !== undefined ? { defaultOptionId: options[0].id } : {}),
  }
}

const buildSmitheryPlan = async (serverId: string): Promise<RegistryInstallPlan> => {
  const options: RegistryInstallOption[] = [
    {
      id: 'smithery-stdio',
      label: 'Local package',
      description: `npx -y ${serverId}`,
      type: 'stdio',
      command: 'npx',
      args: ['-y', serverId],
      inputFields: [],
    },
  ]

  const remoteRecipe = await smitheryClient.getRemoteInstallRecipe(serverId)
  if (remoteRecipe) {
    options.push({
      id: 'smithery-remote',
      label: remoteRecipe.type === 'sse' ? 'Hosted (SSE)' : 'Hosted (HTTP)',
      type: remoteRecipe.type,
      command: 'fetch',
      args: [],
      url: remoteRecipe.url,
      inputFields: [],
    })
  }

  return {
    provider: 'smithery',
    serverId,
    displayName: deriveServerName(serverId),
    description: '',
    options,
    ...(options.length === 1 && options[0] !== undefined ? { defaultOptionId: options[0].id } : {}),
  }
}

const findOption = (plan: RegistryInstallPlan, optionId: string): RegistryInstallOption => {
  const option = plan.options.find((candidate) => candidate.id === optionId)
  if (!option) {
    throw new Error(`Unknown install option "${optionId}" for "${plan.serverId}"`)
  }
  return option
}

const resolveInputValues = (
  fields: readonly RegistryInstallInputField[],
  provided: Readonly<Record<string, string>>,
): Record<string, string> => {
  const values: Record<string, string> = {}
  for (const field of fields) {
    const fromUser = provided[field.key]
    const candidate = normalizeText(fromUser) || normalizeText(field.defaultValue)
    if (field.required && candidate.length === 0) {
      throw new Error(`Missing required input: ${field.label}`)
    }
    if (candidate.length > 0) {
      values[field.key] = candidate
    }
  }
  return values
}

const resolveSecretTemplateMap = (
  templates: Readonly<Record<string, string>>,
  values: Readonly<Record<string, string>>,
  fieldByKey: Readonly<Map<string, RegistryInstallInputField>>,
  target: RegistryInstallInputField['target'],
): {
  plain: Record<string, string>
  secretValues: Record<string, string>
  secretKeys: string[]
} => {
  const plain: Record<string, string> = {}
  const secretValues: Record<string, string> = {}
  const secretKeys: string[] = []

  for (const [name, template] of Object.entries(templates)) {
    const placeholders = extractPlaceholders(template)
    const touchesSecret = placeholders.some((token) => {
      const field = fieldByKey.get(token)
      return field?.target === target && field.secret
    })

    const value = resolveTemplate(template, values).trim()
    if (!value) continue

    if (touchesSecret) {
      secretValues[name] = value
      secretKeys.push(name)
    } else {
      plain[name] = value
    }
  }

  return { plain, secretValues, secretKeys }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolves install metadata for one registry entry into wizard-ready options.
 */
export const prepareRegistryInstall = async (
  provider: RegistryProvider,
  serverId: string,
): Promise<RegistryInstallPlan> => {
  if (provider === 'official') {
    return buildOfficialPlan(serverId)
  }
  return buildSmitheryPlan(serverId)
}

/**
 * Resolves a confirmed install request into final server-create payload and
 * secret values that must be persisted in keytar.
 */
export const resolveRegistryInstallRequest = (
  plan: RegistryInstallPlan,
  request: RegistryInstallRequest,
): ResolvedRegistryInstall => {
  if (!request.confirmed) {
    throw new Error('Install confirmation required before proceeding.')
  }

  const option = findOption(plan, request.optionId)
  const fields = option.inputFields
  const fieldByKey = new Map(fields.map((field) => [field.key, field] as const))
  const provided = request.inputs ?? {}
  const inputValues = resolveInputValues(fields, provided)

  const command = resolveTemplate(option.command, inputValues).trim() || option.command
  const args = option.args
    .map((arg) => resolveTemplate(arg, inputValues).trim())
    .filter((arg) => arg.length > 0)
  const url = normalizeText(option.url) ? resolveTemplate(option.url!, inputValues).trim() : ''
  const envTemplates = option.env ?? {}
  const headerTemplates = option.headers ?? {}

  const envResolution = resolveSecretTemplateMap(envTemplates, inputValues, fieldByKey, 'env')
  const headerResolution = resolveSecretTemplateMap(
    headerTemplates,
    inputValues,
    fieldByKey,
    'header',
  )

  const serverName = normalizeText(request.serverName) || deriveServerName(plan.serverId)

  const createInput: CreateServerInput = {
    name: serverName,
    type: option.type,
    command,
    args,
    env: envResolution.plain,
    secretEnvKeys: envResolution.secretKeys,
    headers: headerResolution.plain,
    secretHeaderKeys: headerResolution.secretKeys,
    ...(url.length > 0 ? { url } : {}),
    tags: ['registry', plan.provider],
    notes: `Installed from ${plan.provider} registry: ${plan.serverId}`,
  }

  return {
    createInput,
    secretEnvValues: envResolution.secretValues,
    secretHeaderValues: headerResolution.secretValues,
  }
}
