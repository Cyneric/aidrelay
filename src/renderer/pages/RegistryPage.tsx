/**
 * @file src/renderer/pages/RegistryPage.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Registry browser page. Allows users to search the Smithery MCP
 * server registry and install servers directly into aidrelay. One-click
 * install is a Pro feature; browsing is available to all tiers.
 */

import { useTranslation } from 'react-i18next'
import { RegistryBrowser } from '@/components/registry/RegistryBrowser'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Top-level registry page that wraps the RegistryBrowser component.
 */
const RegistryPage = () => {
  const { t } = useTranslation()
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
      </header>

      <RegistryBrowser />
    </section>
  )
}

export { RegistryPage }
