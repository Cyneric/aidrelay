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
import { useClientsStore } from '@/stores/clients.store'
import type { ClientStatus, ConfigChangedPayload } from '@shared/types'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Home dashboard. Detects all clients on mount, then presents a card for each.
 * Users can trigger an individual sync from each card.
 */
const DashboardPage = () => {
  const { clients, loading, error, detectAll, syncClient } = useClientsStore()
  const { t } = useTranslation()
  const [syncingId, setSyncingId] = useState<ClientStatus['id'] | null>(null)

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

  const handleSync = async (clientId: ClientStatus['id']) => {
    setSyncingId(clientId)
    await syncClient(clientId)
    setSyncingId(null)
  }

  return (
    <section aria-labelledby="dashboard-heading" data-testid="dashboard-page">
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
          aria-label="Refresh client detection"
          data-testid="detect-all-button"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {loading ? t('common.loading') : 'Refresh'}
        </Button>
      </header>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          data-testid="detection-error"
        >
          Detection failed: {error}
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
