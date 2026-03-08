import { useCallback, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { toast } from 'sonner'
import { serversService } from '@/services/servers.service'
import type { McpServer } from '@shared/types'

interface UseServersActionsOptions {
  readonly onImported?: () => Promise<void>
  readonly t: TFunction
}

export type ServerTestPhase = 'starting_process' | 'sending_initialize' | 'waiting_response'
export type ServerTestStatus = 'success' | 'failure' | 'not_tested'

export const useServersActions = ({ onImported, t }: UseServersActionsOptions) => {
  const [syncingAll, setSyncingAll] = useState(false)
  const [importingFromClients, setImportingFromClients] = useState(false)
  const [testingPhases, setTestingPhases] = useState<Record<string, ServerTestPhase>>({})
  const [testStatuses, setTestStatuses] = useState<
    Record<string, Exclude<ServerTestStatus, 'not_tested'>>
  >({})
  const inFlightTestsRef = useRef(new Set<string>())

  const isTestingServer = useCallback(
    (serverId: string) => testingPhases[serverId] !== undefined,
    [testingPhases],
  )
  const getTestingPhase = useCallback(
    (serverId: string): ServerTestPhase | null => testingPhases[serverId] ?? null,
    [testingPhases],
  )
  const getTestStatus = useCallback(
    (serverId: string): ServerTestStatus => testStatuses[serverId] ?? 'not_tested',
    [testStatuses],
  )

  const handleTest = useCallback(
    async (server: McpServer) => {
      if (inFlightTestsRef.current.has(server.id)) return
      inFlightTestsRef.current.add(server.id)

      setTestingPhases((prev) => ({ ...prev, [server.id]: 'starting_process' }))
      const stepInitializeTimer = setTimeout(() => {
        setTestingPhases((prev) =>
          prev[server.id] === undefined ? prev : { ...prev, [server.id]: 'sending_initialize' },
        )
      }, 350)
      const stepWaitingTimer = setTimeout(() => {
        setTestingPhases((prev) =>
          prev[server.id] === undefined ? prev : { ...prev, [server.id]: 'waiting_response' },
        )
      }, 1200)
      try {
        const result = await serversService.test(server.id)
        setTestStatuses((prev) => ({
          ...prev,
          [server.id]: result.success ? 'success' : 'failure',
        }))
        const descriptionParts = [result.details, result.hint].filter(
          (part): part is string => typeof part === 'string' && part.trim().length > 0,
        )
        const toastOptions =
          descriptionParts.length > 0 ? { description: descriptionParts.join('\n\n') } : undefined
        if (result.success) toast.success(result.message, toastOptions)
        else toast.error(result.message, toastOptions)
      } catch {
        toast.error(t('servers.testFailed', { name: server.name }))
        setTestStatuses((prev) => ({ ...prev, [server.id]: 'failure' }))
      } finally {
        clearTimeout(stepInitializeTimer)
        clearTimeout(stepWaitingTimer)
        setTestingPhases((prev) => {
          if (prev[server.id] === undefined) return prev
          const next = { ...prev }
          delete next[server.id]
          return next
        })
        inFlightTestsRef.current.delete(server.id)
      }
    },
    [t],
  )

  const handleSyncAll = useCallback(async () => {
    setSyncingAll(true)
    try {
      const results = await serversService.syncAllClients()
      const succeeded = results.filter((r) => r.success).length
      toast.success(
        t('servers.syncSummary', { succeeded, total: results.length, count: results.length }),
      )
    } catch {
      toast.error(t('servers.syncFailedGeneric'))
    } finally {
      setSyncingAll(false)
    }
  }, [t])

  const handleImportFromClients = useCallback(async () => {
    setImportingFromClients(true)
    try {
      const result = await serversService.importFromClients()
      if (onImported) await onImported()

      if (result.errors.length > 0) {
        toast.info(
          t('servers.importSuccessErrors', {
            imported: result.imported,
            skipped: result.skipped,
            count: result.errors.length,
          }),
          { description: result.errors.slice(0, 3).join(' ') },
        )
      } else {
        toast.success(
          t('servers.importSuccess', { imported: result.imported, skipped: result.skipped }),
        )
      }
    } catch {
      toast.error(t('common.error'))
    } finally {
      setImportingFromClients(false)
    }
  }, [onImported, t])

  return {
    syncingAll,
    importingFromClients,
    getTestingPhase,
    isTestingServer,
    getTestStatus,
    handleTest,
    handleSyncAll,
    handleImportFromClients,
  }
}
