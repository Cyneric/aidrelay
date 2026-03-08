/**
 * @file src/renderer/components/stacks/StackExporter.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Stack export UI. Lets users select servers and rules by
 * checkbox, provide a bundle name, and download a portable .json file. The
 * export action is gated behind the Pro stackExport feature flag.
 */

import { useState, useEffect, useCallback } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
        <Label htmlFor="stack-name">
          Stack name{' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </Label>
        <Input
          id="stack-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Dev Setup"
          disabled={!canExport}
          className="max-w-sm"
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

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={() => void handleExport()}
            disabled={exportDisabled}
            className="self-start gap-1.5"
            data-testid="stack-export-button"
          >
            <Download size={14} aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {!canExport ? 'Upgrade to Pro to export stacks' : 'Download as .json file'}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export { StackExporter }
