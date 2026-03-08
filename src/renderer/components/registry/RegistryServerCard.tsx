/**
 * @file src/renderer/components/registry/RegistryServerCard.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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

  let installTooltip: string
  if (!canInstall) {
    installTooltip = 'Upgrade to Pro to install from registry'
  } else if (server.remote) {
    installTooltip = 'Remote SSE/HTTP servers cannot be installed automatically'
  } else {
    installTooltip = `Install ${server.displayName}`
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
            <Tooltip>
              <TooltipTrigger asChild>
                <BadgeCheck
                  size={14}
                  className="shrink-0 text-primary"
                  aria-label="Verified"
                  data-testid={`registry-verified-${server.id}`}
                />
              </TooltipTrigger>
              <TooltipContent>Verified by Smithery</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {server.remote && (
            <Badge
              variant="secondary"
              className="font-mono text-[11px] gap-0.5"
              data-testid={`registry-remote-badge-${server.id}`}
            >
              <Wifi size={10} className="inline" aria-hidden="true" />
              remote
            </Badge>
          )}
          <Badge variant="secondary" className="font-mono text-[11px] capitalize">
            {server.source}
          </Badge>
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleInstall()}
              disabled={installDisabled}
              className="ml-auto gap-1.5"
              aria-label={installTooltip}
              data-testid={`registry-install-${server.id}`}
            >
              <Download size={12} aria-hidden="true" />
              {installing ? 'Installing…' : 'Install'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{installTooltip}</TooltipContent>
        </Tooltip>
      </div>
    </article>
  )
}

export { RegistryServerCard }
