/**
 * @file src/renderer/pages/RegistryPage.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Registry browser page. Allows users to search the Smithery MCP
 * server registry and install servers directly into aidrelay.
 */

import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { RegistryBrowser } from '@/components/registry/RegistryBrowser'
import { useServersStore } from '@/stores/servers.store'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Top-level registry page that wraps the RegistryBrowser component.
 */
const RegistryPage = () => {
  const { t } = useTranslation()
  const { servers, load } = useServersStore()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section
      aria-labelledby="registry-heading"
      className="flex flex-col gap-6"
      data-testid="registry-page"
    >
      <header>
        <h1 id="registry-heading" className="text-2xl font-bold tracking-tight">
          {t('registry.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('registry.subtitle')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('registry.helperText')}</p>
      </header>

      <article
        className="rounded-lg border border-border bg-card p-4"
        data-testid="registry-local-panel"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t('registry.localPanel.title')}</h2>
            <p className="text-xs text-muted-foreground mt-1">{t('registry.localPanel.body')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('registry.localPanel.count', { count: servers.length })}
            </p>
          </div>
          <Button asChild type="button" variant="outline" size="sm">
            <Link to="/servers" data-testid="registry-manage-local-link">
              {t('registry.localPanel.cta')}
            </Link>
          </Button>
        </div>
      </article>

      <RegistryBrowser />
    </section>
  )
}

export { RegistryPage }
