import { useCallback, useState } from 'react'
import type { TFunction } from 'i18next'
import { toast } from 'sonner'
import { serversService } from '@/services/servers.service'
import type { McpServer } from '@shared/types'

interface UseServersActionsOptions {
  readonly onImported?: () => Promise<void>
  readonly t: TFunction
}

export const useServersActions = ({ onImported, t }: UseServersActionsOptions) => {
  const [syncingAll, setSyncingAll] = useState(false)
  const [importingFromClients, setImportingFromClients] = useState(false)
  const [testingServerId, setTestingServerId] = useState<string | null>(null)

  const handleTest = useCallback(
    async (server: McpServer) => {
      setTestingServerId(server.id)
      try {
        const result = await serversService.test(server.id)
        if (result.success) toast.success(result.message)
        else toast.error(result.message)
      } catch {
        toast.error(t('servers.testFailed', { name: server.name }))
      } finally {
        setTestingServerId(null)
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
    testingServerId,
    handleTest,
    handleSyncAll,
    handleImportFromClients,
  }
}
