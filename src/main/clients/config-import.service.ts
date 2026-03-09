import type {
  ClientId,
  ConfigChangedPayload,
  ConfigImportPreviewItem,
  ConfigImportPreviewResult,
  ConfigImportResult,
  McpServer,
  McpServerConfig,
  McpServerMap,
} from '@shared/types'
import type { CreateServerInput, UpdateServerInput } from '@shared/channels'
import type { ClientAdapter } from './types'
import type { ServersRepo } from '@main/db/servers.repo'

const normalizeConfig = (config: McpServerConfig | null): McpServerConfig | null => {
  if (config === null) return null

  const type = config.type ?? 'stdio'
  const normalized: McpServerConfig = {
    command: config.command,
    ...(config.args !== undefined && config.args.length > 0 ? { args: [...config.args] } : {}),
    ...(config.env !== undefined && Object.keys(config.env).length > 0 ? { env: config.env } : {}),
    ...(config.headers !== undefined && Object.keys(config.headers).length > 0
      ? { headers: config.headers }
      : {}),
    ...(type !== 'stdio' ? { type } : {}),
    ...(type !== 'stdio' && config.url ? { url: config.url } : {}),
  }
  return normalized
}

const projectRegistryServer = (server: McpServer | undefined): McpServerConfig | null => {
  if (!server) return null
  return normalizeConfig({
    command: server.command,
    ...(server.args.length > 0 ? { args: server.args } : {}),
    ...(Object.keys(server.env).length > 0 ? { env: server.env } : {}),
    ...(Object.keys(server.headers).length > 0 ? { headers: server.headers } : {}),
    ...(server.type !== 'stdio' ? { type: server.type } : {}),
    ...(server.type !== 'stdio' && server.url ? { url: server.url } : {}),
  })
}

const getSourceForName = (
  payload: ConfigChangedPayload,
  name: string,
): ConfigImportPreviewItem['source'] => {
  if (payload.added.includes(name)) return 'added'
  if (payload.removed.includes(name)) return 'removed'
  return 'modified'
}

const isSameConfig = (a: McpServerConfig | null, b: McpServerConfig | null): boolean =>
  JSON.stringify(normalizeConfig(a)) === JSON.stringify(normalizeConfig(b))

const toCreateInput = (name: string, external: McpServerConfig): CreateServerInput | null => {
  const type = external.type ?? 'stdio'
  const command = external.command?.trim() ?? ''
  const url = external.url?.trim() ?? ''

  if (type === 'stdio' && command.length === 0) return null
  if ((type === 'sse' || type === 'http') && url.length === 0) return null

  return {
    name,
    type,
    command: command.length > 0 ? command : 'fetch',
    args: external.args ?? [],
    env: external.env ?? {},
    headers: external.headers ?? {},
    secretEnvKeys: [],
    secretHeaderKeys: [],
    tags: ['imported'],
    notes: 'Imported from external client config',
    ...(url.length > 0 ? { url } : {}),
  }
}

const toUpdateInput = (
  existing: McpServer,
  external: McpServerConfig,
): UpdateServerInput | null => {
  const type = external.type ?? 'stdio'
  const command = external.command?.trim() ?? ''
  const url = external.url?.trim() ?? ''

  if (type === 'stdio' && command.length === 0) return null
  if ((type === 'sse' || type === 'http') && url.length === 0) return null

  return {
    type,
    command: command.length > 0 ? command : existing.command || 'fetch',
    args: external.args ?? [],
    env: external.env ?? {},
    headers: external.headers ?? {},
    url: type === 'stdio' ? '' : url,
  }
}

const buildPreviewItems = (
  payload: ConfigChangedPayload,
  externalMap: McpServerMap,
  registryServers: readonly McpServer[],
): ConfigImportPreviewItem[] => {
  const byName = new Map(registryServers.map((server) => [server.name, server]))
  const names = new Set<string>([...payload.added, ...payload.removed, ...payload.modified])
  const items: ConfigImportPreviewItem[] = []

  for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
    const before = projectRegistryServer(byName.get(name))
    const after = normalizeConfig(externalMap[name] ?? null)
    const source = getSourceForName(payload, name)

    let action: ConfigImportPreviewItem['action']
    if (source === 'removed') {
      action = 'removed_external'
    } else if (before === null && after !== null) {
      action = 'create'
    } else if (before !== null && after !== null) {
      action = isSameConfig(before, after) ? 'no-op' : 'overwrite'
    } else {
      action = 'no-op'
    }

    items.push({ name, source, action, before, after })
  }

  return items
}

export const previewExternalConfigImport = async (
  adapter: ClientAdapter,
  payload: ConfigChangedPayload,
  serversRepo: ServersRepo,
): Promise<ConfigImportPreviewResult> => {
  const externalMap = await adapter.read(payload.configPath)
  const registryServers = serversRepo.findAll()
  const items = buildPreviewItems(payload, externalMap, registryServers)

  return {
    clientId: payload.clientId,
    configPath: payload.configPath,
    items,
  }
}

export const importExternalConfigChanges = async (
  adapter: ClientAdapter,
  payload: ConfigChangedPayload,
  serversRepo: ServersRepo,
): Promise<ConfigImportResult> => {
  const preview = await previewExternalConfigImport(adapter, payload, serversRepo)
  const byName = new Map(serversRepo.findAll().map((server) => [server.name, server]))

  let created = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (const item of preview.items) {
    if (item.action === 'no-op' || item.action === 'removed_external') {
      skipped += 1
      continue
    }

    if (!item.after) {
      skipped += 1
      continue
    }

    try {
      if (item.action === 'create') {
        const createInput = toCreateInput(item.name, item.after)
        if (!createInput) {
          errors.push(`"${item.name}": invalid external config`)
          skipped += 1
          continue
        }
        serversRepo.create(createInput)
        created += 1
        continue
      }

      const existing = byName.get(item.name)
      if (!existing) {
        const createInput = toCreateInput(item.name, item.after)
        if (!createInput) {
          errors.push(`"${item.name}": invalid external config`)
          skipped += 1
          continue
        }
        serversRepo.create(createInput)
        created += 1
        continue
      }

      const updateInput = toUpdateInput(existing, item.after)
      if (!updateInput) {
        errors.push(`"${item.name}": invalid external config`)
        skipped += 1
        continue
      }
      serversRepo.update(existing.id, updateInput)
      updated += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`"${item.name}": ${message}`)
    }
  }

  return {
    clientId: payload.clientId,
    configPath: payload.configPath,
    created,
    updated,
    skipped,
    errors,
  }
}

export const resolveAdapterForPayload = (
  payload: Pick<ConfigChangedPayload, 'clientId'>,
  adapters: Readonly<Map<ClientId, ClientAdapter>>,
): ClientAdapter | null => adapters.get(payload.clientId) ?? null
