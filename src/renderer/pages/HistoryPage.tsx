/**
 * @file src/renderer/pages/HistoryPage.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Backup history page. Shows a per-client timeline of config
 * snapshots with one-click restore. Lets the user see exactly what aidrelay
 * wrote and roll back to any previous state.
 *
 * Clients are detected on mount; only installed clients are shown. Each client
 * section is collapsible to keep the page clean when many clients are installed.
 */

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { ClientStatus } from '@shared/types'
import { BackupTimeline } from '@/components/history/BackupTimeline'
import { clientsService } from '@/services/clients.service'

// ─── Client Section ───────────────────────────────────────────────────────────

/**
 * A collapsible section for one client's backup timeline.
 */
const ClientHistorySection = ({ client }: Readonly<{ client: ClientStatus }>) => {
  const [open, setOpen] = useState(true)

  return (
    <section
      className="rounded-lg border"
      aria-labelledby={`history-heading-${client.id}`}
      data-testid={`client-history-${client.id}`}
    >
      <Button
        type="button"
        variant="ghost"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium rounded-none rounded-t-lg"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`history-panel-${client.id}`}
      >
        <span id={`history-heading-${client.id}`}>{client.displayName}</span>
        {open ? (
          <ChevronDown size={16} aria-hidden="true" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" />
        )}
      </Button>

      {open && (
        <div id={`history-panel-${client.id}`} className="px-4 pb-4">
          <BackupTimeline clientId={client.id} />
        </div>
      )}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Backup history page listing all installed clients with their snapshot timelines.
 */
const HistoryPage = () => {
  const { t } = useTranslation()
  const [clients, setClients] = useState<ClientStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void clientsService.detectAll().then((all) => {
      setClients(all.filter((c) => c.installed))
      setLoading(false)
    })
  }, [])

  return (
    <main className="flex flex-col gap-6" data-testid="history-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('history.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('history.subtitle')}</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">{t('history.detecting')}</p>}

      {!loading && clients.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="no-clients">
          {t('history.noClients')}
        </p>
      )}

      {!loading && clients.length > 0 && (
        <div className="flex flex-col gap-3">
          {clients.map((client) => (
            <ClientHistorySection key={client.id} client={client} />
          ))}
        </div>
      )}
    </main>
  )
}

export { HistoryPage }
