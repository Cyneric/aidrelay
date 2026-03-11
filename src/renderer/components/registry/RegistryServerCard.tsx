/**
 * @file src/renderer/components/registry/RegistryServerCard.tsx
 *
 * @created 07.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Card component for a single Smithery registry search result.
 * Shows the server display name, description, source badge, verified status,
 * use count, and an Install button that is gated behind the Pro feature flag.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, Download } from 'lucide-react'
import { toast } from 'sonner'
import { InstallLocalWizard } from '@/components/installer/InstallLocalWizard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useServersStore } from '@/stores/servers.store'
import type { RegistryProvider, RegistryServer } from '@shared/channels'

// ─── Props ────────────────────────────────────────────────────────────────────

interface RegistryServerCardProps {
  readonly server: RegistryServer
  /** Whether the Pro registryInstall feature gate is enabled. */
  readonly canInstall: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays a single registry server result with install functionality.
 * The Install button is disabled when the feature gate is not active or while
 * an installation request is in-flight.
 */
const RegistryServerCard = ({ server, canInstall }: RegistryServerCardProps) => {
  const { t } = useTranslation()
  const { load } = useServersStore()
  const [installing, setInstalling] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [installedServerId, setInstalledServerId] = useState<string | null>(null)

  const handleInstall = async () => {
    setInstalling(true)
    try {
      const provider: RegistryProvider = server.source === 'official' ? 'official' : 'smithery'
      const plan = await window.api.registryPrepareInstall(provider, server.id)
      const option =
        (plan.defaultOptionId !== undefined
          ? plan.options.find((o) => o.id === plan.defaultOptionId)
          : undefined) ?? plan.options[0]
      if (!option) throw new Error('No install option available')
      const installedServer = await window.api.registryInstall({
        provider,
        serverId: server.id,
        optionId: option.id,
        confirmed: true,
      })
      await load()
      // For remote (hosted) servers, installation is complete
      if (server.remote) {
        toast.success(`"${server.displayName}" installed`)
      } else {
        // Deployable local server: open installation wizard
        setInstalledServerId(installedServer.id)
        setWizardOpen(true)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Installation failed'
      toast.error(message)
    } finally {
      setInstalling(false)
    }
  }

  const installDisabled = !canInstall || installing

  let installTooltip: string
  if (!canInstall) {
    installTooltip = 'Upgrade to Pro to install from registry'
  } else {
    installTooltip = `Install ${server.displayName}`
  }

  let infoUrl: string | null = null
  if (server.source === 'smithery') {
    infoUrl = `https://smithery.ai/server/${encodeURIComponent(server.id)}`
  } else if (server.source === 'official') {
    infoUrl = `https://registry.modelcontextprotocol.io/servers/${encodeURIComponent(server.id)}`
  }

  return (
    <>
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
            <Badge
              variant="secondary"
              className="font-mono text-[11px]"
              data-testid={`registry-availability-badge-${server.id}`}
            >
              {server.remote ? t('registry.badges.hosted') : t('registry.badges.deployable')}
            </Badge>
            <Badge variant="secondary" className="font-mono text-[11px] capitalize">
              {server.source}
            </Badge>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-3 flex-1">{server.description}</p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <div className="flex items-center gap-3 min-w-0">
            {server.useCount !== undefined && (
              <span className="text-xs text-muted-foreground">
                {server.useCount.toLocaleString()} installs
              </span>
            )}
            {infoUrl && (
              <a
                href={infoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
                data-testid={`registry-more-info-${server.id}`}
              >
                {t('registry.moreInfo')}
              </a>
            )}
          </div>

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

      {installedServerId && (
        <InstallLocalWizard
          open={wizardOpen}
          serverId={installedServerId}
          serverName={server.displayName}
          onClose={() => {
            setWizardOpen(false)
            setInstalledServerId(null)
          }}
          onSuccess={() => {
            toast.success(`"${server.displayName}" installed and configured`)
          }}
        />
      )}
    </>
  )
}

export { RegistryServerCard }
