/**
 * @file src/renderer/components/stacks/StackExporter.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Stack export UI. Lets users select servers and rules by
 * checkbox, provide a bundle name, and download a portable .json file. The
 * export action is gated behind the Pro stackExport feature flag.
 */

import { useState, useEffect, useCallback } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { useServersStore } from '@/stores/servers.store'
import { useRulesStore } from '@/stores/rules.store'
import { useFeatureGate } from '@/lib/useFeatureGate'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Export form that builds a McpStack JSON bundle from selected servers and rules.
 */
const StackExporter = () => {
  const canExport = useFeatureGate('stackExport')
  const { servers, load: loadServers } = useServersStore()
  const { rules, load: loadRules } = useRulesStore()

  const [name, setName] = useState('')
  const [selectedServers, setSelectedServers] = useState<Set<string>>(new Set())
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    void loadServers()
    void loadRules()
  }, [loadServers, loadRules])

  const toggleServer = useCallback((id: string) => {
    setSelectedServers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleRule = useCallback((id: string) => {
    setSelectedRules((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleExport = useCallback(async () => {
    if (!name.trim()) {
      toast.error('Please enter a name for the stack')
      return
    }
    setExporting(true)
    try {
      const json = await window.api.stacksExport(
        Array.from(selectedServers),
        Array.from(selectedRules),
        name.trim(),
      )
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${name.trim().replace(/\s+/g, '-').toLowerCase()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success(`Stack "${name.trim()}" exported`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      toast.error(message)
    } finally {
      setExporting(false)
    }
  }, [name, selectedServers, selectedRules])

  const exportDisabled = !canExport || exporting || name.trim().length === 0

  return (
    <div className="flex flex-col gap-5" data-testid="stack-exporter">
      <h2 className="text-base font-semibold">Export Stack</h2>

      {!canExport && (
        <p className="text-sm text-muted-foreground rounded-md border border-border bg-muted/40 px-4 py-3">
          Stack export is a Pro feature. Upgrade to create portable server + rule bundles.
        </p>
      )}

      {/* Stack name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stack-name" className="text-sm font-medium">
          Stack name{' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <input
          id="stack-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Dev Setup"
          disabled={!canExport}
          className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          data-testid="stack-name-input"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Servers */}
        <fieldset>
          <legend className="text-sm font-medium mb-2">
            Servers ({selectedServers.size} selected)
          </legend>
          <div className="rounded-md border border-border divide-y divide-border max-h-64 overflow-y-auto">
            {servers.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No servers</p>
            ) : (
              servers.map((server) => (
                <label
                  key={server.id}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedServers.has(server.id)}
                    onChange={() => toggleServer(server.id)}
                    disabled={!canExport}
                    className="accent-primary"
                    data-testid={`export-server-${server.id}`}
                  />
                  <span className="font-mono truncate">{server.name}</span>
                </label>
              ))
            )}
          </div>
        </fieldset>

        {/* Rules */}
        <fieldset>
          <legend className="text-sm font-medium mb-2">
            Rules ({selectedRules.size} selected)
          </legend>
          <div className="rounded-md border border-border divide-y divide-border max-h-64 overflow-y-auto">
            {rules.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No rules</p>
            ) : (
              rules.map((rule) => (
                <label
                  key={rule.id}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedRules.has(rule.id)}
                    onChange={() => toggleRule(rule.id)}
                    disabled={!canExport}
                    className="accent-primary"
                    data-testid={`export-rule-${rule.id}`}
                  />
                  <span className="truncate">{rule.name}</span>
                </label>
              ))
            )}
          </div>
        </fieldset>
      </div>

      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exportDisabled}
        title={!canExport ? 'Upgrade to Pro to export stacks' : undefined}
        className="inline-flex items-center gap-1.5 self-start rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="stack-export-button"
      >
        <Download size={14} aria-hidden="true" />
        {exporting ? 'Exporting…' : 'Export'}
      </button>
    </div>
  )
}

export { StackExporter }
