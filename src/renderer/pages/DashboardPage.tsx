/**
 * @file src/renderer/pages/DashboardPage.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Dashboard page — the home screen of the application. Detects
 * all registered clients on mount and renders a card grid showing their status.
 * A loading skeleton and error state are shown while detection is in flight.
 */

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ClientCard } from '@/components/clients/ClientCard'
import { useClientsStore } from '@/stores/clients.store'
import type { ClientStatus } from '@shared/types'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Home dashboard. Detects all clients on mount, then presents a card for each.
 * Users can trigger an individual sync from each card.
 */
const DashboardPage = () => {
  const { clients, loading, error, detectAll, syncClient } = useClientsStore()
  const [syncingId, setSyncingId] = useState<ClientStatus['id'] | null>(null)

  // Detect all clients when the page first mounts
  useEffect(() => {
    void detectAll()
  }, [detectAll])

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
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of detected AI tool clients and their sync status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void detectAll()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border hover:bg-accent transition-colors disabled:opacity-50"
          aria-label="Refresh client detection"
          data-testid="detect-all-button"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {loading ? 'Detecting…' : 'Refresh'}
        </button>
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
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          aria-busy="true"
          aria-label="Loading clients"
          data-testid="clients-skeleton"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border bg-card p-5 h-36 animate-pulse bg-muted"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* Client cards */}
      {!loading || clients.length > 0 ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="clients-grid"
        >
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onSync={(id) => void handleSync(id)}
              syncing={syncingId === client.id}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export { DashboardPage }
