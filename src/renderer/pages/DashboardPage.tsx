/**
 * @file src/renderer/pages/DashboardPage.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Dashboard page — the home screen of the application. Detects
 * all registered clients on mount and renders a card grid showing their status.
 * A loading skeleton and error state are shown while detection is in flight.
 */

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CardGrid } from '@/components/ui/card-grid'
import { ClientCard } from '@/components/clients/ClientCard'
import { CreateConfigConfirmDialog } from '@/components/clients/CreateConfigConfirmDialog'
import { useClientsStore } from '@/stores/clients.store'
import type { ClientStatus, ConfigChangedPayload, SyncClientOptions } from '@shared/types'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Home dashboard. Detects all clients on mount, then presents a card for each.
 * Users can trigger an individual sync from each card.
 */
const DashboardPage = () => {
  const { clients, loading, error, detectAll, syncClient } = useClientsStore()
  const { t } = useTranslation()
  const [syncingId, setSyncingId] = useState<ClientStatus['id'] | null>(null)
  const [createConfigClientId, setCreateConfigClientId] = useState<ClientStatus['id'] | null>(null)

  // Detect all clients when the page first mounts
  useEffect(() => {
    void detectAll()
  }, [detectAll])

  // Listen for external config changes detected by the file watcher
  useEffect(() => {
    const unsubscribe = window.api.onConfigChanged((payload: ConfigChangedPayload) => {
      toast.info(t('dashboard.configChangedTitle'), {
        description: t('dashboard.configChangedDescription', { clientId: payload.clientId }),
        action: {
          label: t('dashboard.importChanges'),
          onClick: () => void syncClient(payload.clientId),
        },
        duration: 8000,
      })
    })
    return unsubscribe
  }, [syncClient, t])

  const handleSync = async (
    clientId: ClientStatus['id'],
    options?: SyncClientOptions,
    interactive = true,
  ) => {
    setSyncingId(clientId)
    try {
      await syncClient(clientId, options)
    } catch (err) {
      if (interactive && isConfigCreationRequiredError(err)) {
        setCreateConfigClientId(clientId)
        return
      }
      const message = err instanceof Error ? err.message : t('common.error')
      toast.error(message)
    } finally {
      setSyncingId(null)
    }
  }

  const createConfigClient = clients.find((client) => client.id === createConfigClientId) ?? null

  return (
    <section aria-labelledby="dashboard-heading" data-testid="dashboard-page">
      <CreateConfigConfirmDialog
        open={createConfigClient !== null}
        clientName={createConfigClient?.displayName ?? ''}
        submitting={createConfigClient !== null && syncingId === createConfigClient.id}
        onCancel={() => setCreateConfigClientId(null)}
        onConfirm={() => {
          if (!createConfigClient) return
          setCreateConfigClientId(null)
          void handleSync(createConfigClient.id, { allowCreateConfigIfMissing: true }, false)
        }}
      />

      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 id="dashboard-heading" className="text-2xl font-bold tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void detectAll()}
          disabled={loading}
          className="gap-1.5"
          aria-label={t('dashboard.refresh')}
          data-testid="detect-all-button"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {loading ? t('common.loading') : t('dashboard.refresh')}
        </Button>
      </header>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          data-testid="detection-error"
        >
          {t('dashboard.detectionFailed', { error })}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && clients.length === 0 && (
        <CardGrid aria-busy="true" aria-label="Loading clients" data-testid="clients-skeleton">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-36 animate-pulse bg-muted" aria-hidden="true" />
          ))}
        </CardGrid>
      )}

      {/* Client cards */}
      {!loading || clients.length > 0 ? (
        <CardGrid data-testid="clients-grid">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onSync={(id) => void handleSync(id)}
              syncing={syncingId === client.id}
            />
          ))}
        </CardGrid>
      ) : null}
    </section>
  )
}

export { DashboardPage }
const isConfigCreationRequiredError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code?: string }).code === 'config_creation_required'
