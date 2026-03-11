/**
 * @file src/renderer/pages/StacksPage.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Stacks page for importing and exporting portable MCP server +
 * AI rule bundles.
 */

import { useTranslation } from 'react-i18next'
import { StackExporter } from '@/components/stacks/StackExporter'
import { StackImporter } from '@/components/stacks/StackImporter'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Top-level stacks page with export and import sections.
 */
const StacksPage = () => {
  const { t } = useTranslation()
  return (
    <section
      aria-labelledby="stacks-heading"
      className="flex flex-col gap-8"
      data-testid="stacks-page"
    >
      <header>
        <h1 id="stacks-heading" className="text-2xl font-bold tracking-tight">
          {t('stacks.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('stacks.subtitle')}</p>
      </header>

      <div className="rounded-md border border-border px-6 py-5">
        <StackExporter />
      </div>

      <div className="rounded-md border border-border px-6 py-5">
        <StackImporter />
      </div>
    </section>
  )
}

export { StacksPage }
