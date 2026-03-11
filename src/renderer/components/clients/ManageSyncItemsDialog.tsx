/**
 * @file src/renderer/components/clients/ManageSyncItemsDialog.tsx
 *
 * @created 11.03.2026
 * @modified 11.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Dialog for managing per-client sync ignore state per MCP
 * server. This surfaces client override toggles with explicit "Ignored"
 * wording for sync behavior.
 */

import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ClientId, McpServer } from '@shared/types'

interface ManageSyncItemsDialogProps {
  readonly open: boolean
  readonly clientId: ClientId
  readonly clientName: string
  readonly loading: boolean
  readonly servers: readonly McpServer[]
  readonly updatingServerId: string | null
  readonly onToggle: (serverId: string, enabled: boolean) => void
  readonly onClose: () => void
}

const ManageSyncItemsDialog = ({
  open,
  clientId,
  clientName,
  loading,
  servers,
  updatingServerId,
  onToggle,
  onClose,
}: ManageSyncItemsDialogProps) => {
  const { t } = useTranslation()

  const sorted = [...servers].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[80vh] flex flex-col"
        data-testid="manage-sync-items-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('clients.manageSyncItemsTitle', { name: clientName })}</DialogTitle>
          <DialogDescription>{t('clients.manageSyncItemsDescription')}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 rounded-md border">
          {loading ? (
            <p
              className="p-4 text-sm text-muted-foreground"
              data-testid="manage-sync-items-loading"
            >
              {t('clients.manageSyncItemsLoading')}
            </p>
          ) : sorted.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground" data-testid="manage-sync-items-empty">
              {t('clients.manageSyncItemsEmpty')}
            </p>
          ) : (
            <table className="w-full text-sm" data-testid="manage-sync-items-table">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium">
                    {t('clients.manageSyncItemsServer')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t('clients.manageSyncItemsState')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">{t('servers.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((server) => {
                  const ignored = server.clientOverrides[clientId]?.enabled === false
                  return (
                    <tr key={server.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-mono text-xs">{server.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant={ignored ? 'outline' : 'secondary'}>
                          {ignored
                            ? t('clients.manageSyncItemsIgnored')
                            : t('clients.manageSyncItemsEnabled')}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updatingServerId === server.id}
                          onClick={() => onToggle(server.id, ignored)}
                          data-testid={`manage-sync-toggle-${server.id}`}
                        >
                          {ignored
                            ? t('clients.manageSyncItemsEnabled')
                            : t('clients.manageSyncItemsIgnored')}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="manage-sync-items-close"
          >
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ManageSyncItemsDialog }
