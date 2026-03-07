/**
 * @file src/renderer/components/registry/RegistryServerCard.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Card component for a single Smithery registry search result.
 * Shows the server display name, description, source badge, verified status,
 * use count, and an Install button that is gated behind the Pro feature flag.
 */

import { useState } from 'react'
import { BadgeCheck, Download, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { useServersStore } from '@/stores/servers.store'
import type { RegistryServer } from '@shared/channels'

// ─── Props ────────────────────────────────────────────────────────────────────

interface RegistryServerCardProps {
  readonly server: RegistryServer
  /** Whether the Pro registryInstall feature gate is enabled. */
  readonly canInstall: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays a single registry server result with install functionality.
 * The Install button is disabled when the feature gate is not active or when
 * the server is a remote (SSE/HTTP) type.
 */
const RegistryServerCard = ({ server, canInstall }: RegistryServerCardProps) => {
  const { load } = useServersStore()
  const [installing, setInstalling] = useState(false)

  const handleInstall = async () => {
    setInstalling(true)
    try {
      await window.api.registryInstall(server.id)
      await load()
      toast.success(`"${server.displayName}" installed`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Installation failed'
      toast.error(message)
    } finally {
      setInstalling(false)
    }
  }

  const installDisabled = !canInstall || server.remote || installing

  let installTitle: string
  if (!canInstall) {
    installTitle = 'Upgrade to Pro to install from registry'
  } else if (server.remote) {
    installTitle = 'Remote SSE/HTTP servers cannot be installed automatically'
  } else {
    installTitle = `Install ${server.displayName}`
  }

  return (
    <article
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
      data-testid={`registry-card-${server.id}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-sm truncate">{server.displayName}</span>
          {server.verified && (
            <BadgeCheck
              size={14}
              className="shrink-0 text-primary"
              aria-label="Verified"
              data-testid={`registry-verified-${server.id}`}
            />
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {server.remote && (
            <span
              className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground"
              data-testid={`registry-remote-badge-${server.id}`}
            >
              <Wifi size={10} className="inline mr-0.5" aria-hidden="true" />
              remote
            </span>
          )}
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground capitalize">
            {server.source}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-3 flex-1">{server.description}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        {server.useCount !== undefined && (
          <span className="text-xs text-muted-foreground">
            {server.useCount.toLocaleString()} installs
          </span>
        )}

        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={installDisabled}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={installTitle}
          aria-label={installTitle}
          data-testid={`registry-install-${server.id}`}
        >
          <Download size={12} aria-hidden="true" />
          {installing ? 'Installing…' : 'Install'}
        </button>
      </div>
    </article>
  )
}

export { RegistryServerCard }
