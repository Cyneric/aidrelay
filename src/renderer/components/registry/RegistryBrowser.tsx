/**
 * @file src/renderer/components/registry/RegistryBrowser.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Search browser for the Smithery MCP server registry. Renders a
 * debounced search input and a card grid of results. Loading, empty, and error
 * states are handled gracefully. Install actions are delegated to
 * RegistryServerCard which enforces the Pro feature gate.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { useFeatureGate } from '@/lib/useFeatureGate'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RegistryServerCard } from './RegistryServerCard'
import type { RegistryProvider, RegistryServer } from '@shared/channels'

type AvailabilityFilter = 'all' | 'deployable' | 'hosted'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full registry browser with search input, debounced query, and card grid.
 */
const RegistryBrowser = () => {
  const { t } = useTranslation()
  const canInstall = useFeatureGate('registryInstall')
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState<RegistryProvider>('smithery')
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all')
  const [results, setResults] = useState<RegistryServer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (currentProvider: RegistryProvider, q: string) => {
    setLoading(true)
    setError(null)
    try {
      const servers = await window.api.registrySearch(currentProvider, q)
      setResults(servers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registry search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      void search(provider, query)
    }, 300)

    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [provider, query, search])

  const filteredResults = results.filter((server) => {
    if (availabilityFilter === 'all') return true
    if (availabilityFilter === 'deployable') return !server.remote
    return server.remote
  })

  return (
    <div className="flex flex-col gap-4" data-testid="registry-browser">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative max-w-sm min-w-[14rem] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('registry.searchPlaceholder')}
            className="pl-8"
            aria-label={t('registry.searchAriaLabel')}
            data-testid="registry-search"
          />
        </div>

        <div
          className="inline-flex rounded-md border border-border p-1"
          data-testid="registry-provider"
        >
          {(['smithery', 'official'] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={provider === value ? 'default' : 'ghost'}
              className="h-7 px-3"
              onClick={() => setProvider(value)}
              data-testid={`registry-provider-${value}`}
            >
              {t(`registry.providers.${value}`)}
            </Button>
          ))}
        </div>

        <div
          className="inline-flex rounded-md border border-border p-1"
          data-testid="registry-availability"
        >
          {(['all', 'deployable', 'hosted'] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={availabilityFilter === value ? 'default' : 'ghost'}
              className="h-7 px-3"
              onClick={() => setAvailabilityFilter(value)}
              data-testid={`registry-availability-${value}`}
            >
              {t(`registry.availability.${value}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error !== null && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          data-testid="registry-error"
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p
          className="text-sm text-muted-foreground py-8 text-center"
          data-testid="registry-loading"
        >
          {t('registry.searching')}
        </p>
      )}

      {/* Empty state */}
      {!loading && !error && filteredResults.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center" data-testid="registry-empty">
          {query.trim().length === 0
            ? t('registry.startTyping')
            : t('registry.noResults', { query })}
        </p>
      )}

      {/* Results grid */}
      {!loading && filteredResults.length > 0 && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="registry-results"
        >
          {filteredResults.map((server) => (
            <RegistryServerCard key={server.id} server={server} canInstall={canInstall} />
          ))}
        </div>
      )}
    </div>
  )
}

export { RegistryBrowser }
