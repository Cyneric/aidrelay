/**
 * @file src/renderer/components/installer/InstallLocalWizard.tsx
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Wizard for local MCP server installation. Extends the registry
 * install flow with preflight checks, command preview, secret binding, and live
 * installation logs. Works with both registry deployable entries and existing
 * servers that need repair.
 */

import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle2, XCircle, AlertCircle, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { InstallPlan, PreflightReport, InstallStep } from '@shared/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface InstallLocalWizardProps {
  /** Whether the wizard dialog is open. */
  readonly open: boolean
  /** The server ID to install. For registry entries, this is the registry server ID. */
  readonly serverId: string
  /** Display name of the server (for UI). */
  readonly serverName: string
  /** Callback when the wizard closes (success or cancellation). */
  readonly onClose: () => void
  /** Callback when installation completes successfully. */
  readonly onSuccess?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Multi‑step wizard that guides the user through local MCP server installation.
 * Steps:
 * 1. Preflight check (runtime detection, command availability)
 * 2. Command preview (expanded commands, copyable)
 * 3. Secret binding (missing environment variables)
 * 4. Installation (live logs, progress)
 * 5. Completion (success/failure)
 */
const InstallLocalWizard = ({
  open,
  serverId,
  serverName,
  onClose,
  onSuccess,
}: InstallLocalWizardProps) => {
  const { t } = useTranslation()
  const [step, setStep] = useState<
    'preflight' | 'commands' | 'secrets' | 'installing' | 'complete'
  >('preflight')
  const [plan, setPlan] = useState<InstallPlan | null>(null)
  const [report, setReport] = useState<PreflightReport | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<readonly string[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadInstallData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [planResult, reportResult] = await Promise.all([
        window.api.installerPrepare(serverId),
        window.api.installerPreflight(serverId),
      ])
      setPlan(planResult)
      setReport(reportResult)
      // If preflight successful, advance to command preview
      if (reportResult.success) {
        setStep('commands')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load installation data'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [serverId, setLoading, setError, setPlan, setReport, setStep])

  const handleRetry = () => {
    void loadInstallData()
  }

  // Load install plan and preflight report on open
  useEffect(() => {
    if (!open) return
    void loadInstallData()
  }, [open, loadInstallData])

  // Poll logs when installation is in progress
  useEffect(() => {
    if (step !== 'installing') return

    const poll = async () => {
      try {
        const status = await window.api.installerStatus(serverId)
        if (status?.logs) {
          // Convert logs to strings
          const logLines = status.logs.map(
            (entry) => `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`,
          )
          setLogs(logLines)
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        // ignore errors, keep existing logs
      }
    }

    // Poll immediately, then every second
    void poll()
    const interval = setInterval(() => {
      void poll()
    }, 1000)
    intervalRef.current = interval

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [step, serverId])

  const handleStartInstall = async () => {
    if (!plan) return
    setStep('installing')
    setLogs([])
    try {
      await window.api.installerRun(serverId)
      // Installation completed successfully
      setStep('complete')
      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Installation failed'
      setError(message)
      setStep('complete')
    }
  }

  const handleCancel = () => {
    if (step === 'installing') {
      void window.api.installerCancel(serverId)
    }
    onClose()
  }

  const title =
    step === 'preflight'
      ? t('installer.wizard.step.preflight', { name: serverName })
      : step === 'commands'
        ? t('installer.wizard.step.commands', { name: serverName })
        : step === 'secrets'
          ? t('installer.wizard.step.secrets', { name: serverName })
          : step === 'installing'
            ? t('installer.wizard.step.installing', { name: serverName })
            : t('installer.wizard.step.complete', { name: serverName })

  const description =
    step === 'preflight'
      ? t('installer.wizard.description.preflight')
      : step === 'commands'
        ? t('installer.wizard.description.commands')
        : step === 'secrets'
          ? t('installer.wizard.description.secrets')
          : step === 'installing'
            ? t('installer.wizard.description.installing')
            : t('installer.wizard.description.complete')

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) void handleCancel()
      }}
    >
      <DialogContent className="max-w-2xl" data-testid="install-local-wizard">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center justify-between gap-2 text-sm">
            {(['preflight', 'commands', 'secrets', 'installing', 'complete'] as const).map(
              (s, idx) => (
                <div
                  key={s}
                  className={cn(
                    'flex items-center gap-1.5',
                    idx > 0 && 'flex-1 border-t-2',
                    step === s
                      ? 'text-primary border-primary'
                      : step === 'complete' && s === 'complete'
                        ? 'text-primary border-primary'
                        : 'text-muted-foreground border-muted',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border',
                      step === s
                        ? 'border-primary bg-primary text-primary-foreground'
                        : step === 'complete' && s === 'complete'
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground bg-transparent',
                    )}
                  >
                    {idx + 1}
                  </div>
                  <span className="hidden sm:inline">{t(`installer.wizard.step.${s}`)}</span>
                </div>
              ),
            )}
          </div>

          {/* Content area */}
          <div className="min-h-[200px] rounded-md border border-border/70 bg-muted/30 p-4">
            {loading && (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">
                  {t('installer.wizard.loading')}
                </span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && step === 'preflight' && report && (
              <PreflightStep report={report} onRetry={handleRetry} />
            )}

            {!loading && !error && step === 'commands' && plan && (
              <CommandPreviewStep plan={plan} />
            )}

            {!loading && !error && step === 'secrets' && <SecretBindingStep serverId={serverId} />}

            {!loading && !error && step === 'installing' && (
              <InstallationStep serverId={serverId} logs={logs} />
            )}

            {!loading && !error && step === 'complete' && (
              <CompletionStep success={!error} serverName={serverName} />
            )}
          </div>
        </div>

        <DialogFooter>
          {step === 'preflight' && (
            <>
              <Button type="button" variant="outline" onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={() => setStep('commands')} disabled={!report?.success}>
                {t('installer.wizard.continue')}
              </Button>
            </>
          )}
          {step === 'commands' && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('preflight')}>
                {t('common.back')}
              </Button>
              <Button type="button" onClick={() => setStep('secrets')}>
                {t('installer.wizard.continue')}
              </Button>
            </>
          )}
          {step === 'secrets' && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('commands')}>
                {t('common.back')}
              </Button>
              <Button type="button" onClick={() => void handleStartInstall()}>
                {t('installer.wizard.startInstall')}
              </Button>
            </>
          )}
          {step === 'installing' && (
            <>
              <Button type="button" variant="outline" disabled>
                {t('common.cancel')}
              </Button>
              <Button type="button" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('installer.wizard.installing')}
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button type="button" onClick={handleCancel}>
              {t('common.done')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Sub‑components ───────────────────────────────────────────────────────────

interface PreflightStepProps {
  readonly report: PreflightReport
  readonly onRetry?: () => void
}

const PreflightStep = ({ report, onRetry }: PreflightStepProps) => {
  const { t } = useTranslation()
  const [copiedRuntimeIndex, setCopiedRuntimeIndex] = useState<number | null>(null)
  const [copiedSuggestionIndex, setCopiedSuggestionIndex] = useState<number | null>(null)

  const failedChecks = report.checks.filter((c) => !c.success)
  const successfulChecks = report.checks.filter((c) => c.success)

  const copyToClipboard = (
    text: string,
    setter: Dispatch<SetStateAction<number | null>>,
    idx: number,
  ) => {
    void navigator.clipboard.writeText(text)
    setter(idx)
    setTimeout(() => setter(null), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{t('installer.preflight.title')}</h4>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            data-testid="preflight-retry"
          >
            {t('installer.preflight.retry')}
          </Button>
        )}
      </div>

      {/* Issues to fix */}
      {failedChecks.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-destructive">
            {t('installer.preflight.issues', { count: failedChecks.length })}
          </h5>
          <div className="space-y-2">
            {failedChecks.map((check) => (
              <div
                key={check.id}
                className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{check.description}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                  {check.hint && <p className="mt-1 text-xs text-muted-foreground">{check.hint}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ready checks (collapsible) */}
      {successfulChecks.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-green-700 dark:text-green-400">
            {t('installer.preflight.ready', { count: successfulChecks.length })}
          </h5>
          <div className="space-y-2">
            {successfulChecks.map((check) => (
              <div
                key={check.id}
                className="flex items-start gap-2 rounded-md border border-border/70 bg-background p-3"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{check.description}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing runtimes */}
      {report.missingRuntimes.length > 0 && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3">
          <h5 className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            {t('installer.preflight.missingRuntimes')}
          </h5>
          <div className="space-y-2">
            {report.missingRuntimes.map((rt, idx) => {
              const command = rt.installHint || rt.hint
              const copied = copiedRuntimeIndex === idx
              return (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-amber-700 dark:text-amber-400">{rt.hint}</p>
                    {rt.installHint && (
                      <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-500 font-mono">
                        {rt.installHint}
                      </p>
                    )}
                  </div>
                  {command && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="shrink-0"
                      onClick={() => copyToClipboard(command, setCopiedRuntimeIndex, idx)}
                    >
                      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {report.suggestions.length > 0 && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3">
          <h5 className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-300">
            {t('installer.preflight.suggestions')}
          </h5>
          <div className="space-y-2">
            {report.suggestions.map((suggestion, idx) => {
              const copied = copiedSuggestionIndex === idx
              // If suggestion looks like a command (starts with common prefixes), make it copyable
              const isCommand = /^(winget|npm|pip|pipx|uvx|cargo|docker|\.\\|\.\/)/i.test(
                suggestion,
              )
              return (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-blue-700 dark:text-blue-400">{suggestion}</p>
                  </div>
                  {isCommand && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="shrink-0"
                      onClick={() => copyToClipboard(suggestion, setCopiedSuggestionIndex, idx)}
                    >
                      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

interface CommandPreviewStepProps {
  readonly plan: InstallPlan
}

const CommandPreviewStep = ({ plan }: CommandPreviewStepProps) => {
  const { t } = useTranslation()
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null)

  const formatCommand = (step: InstallStep): string => {
    const parts: string[] = []
    if (step.env) {
      for (const [key, value] of Object.entries(step.env)) {
        parts.push(`${key}=${value}`)
      }
    }
    if (step.command) {
      parts.push(step.command)
    }
    if (step.args && step.args.length > 0) {
      parts.push(...step.args)
    }
    return parts.join(' ')
  }

  const copyCommand = (stepId: string, command: string) => {
    void navigator.clipboard.writeText(command)
    setCopiedStepId(stepId)
    setTimeout(() => setCopiedStepId(null), 2000)
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium">{t('installer.commands.title')}</h4>
      <p className="text-sm text-muted-foreground">{t('installer.commands.description')}</p>
      <div className="space-y-2">
        {plan.steps.map((step) => {
          const command = step.command ? formatCommand(step) : null
          return (
            <div key={step.id} className="rounded-md border border-border/70 bg-background p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{step.description}</span>
                <div className="flex items-center gap-2">
                  {step.adapterType && <Badge variant="secondary">{step.adapterType}</Badge>}
                  {command && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="shrink-0"
                      onClick={() => copyCommand(step.id, command)}
                      aria-label={t('installer.commands.copy')}
                    >
                      {copiedStepId === step.id ? (
                        <Check size={12} className="text-green-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              {command && (
                <div className="font-mono text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                  {command}
                </div>
              )}
              {step.env && Object.keys(step.env).length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">Environment variables:</span>
                  <ul className="mt-1 ml-2 space-y-0.5">
                    {Object.entries(step.env).map(([key, value]) => (
                      <li key={key}>
                        <span className="font-mono">{key}=</span>
                        <span className="font-mono text-amber-600 dark:text-amber-400">
                          {value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface SecretBindingStepProps {
  readonly serverId: string
}

interface MissingSecret {
  readonly key: string
  readonly type: 'env' | 'header'
  readonly value: string
  readonly saved: boolean
}

const HEADER_SECRET_PREFIX = '__aidrelay_header__:'

const SecretBindingStep = ({ serverId }: SecretBindingStepProps) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [serverName, setServerName] = useState<string | null>(null)
  const [missingSecrets, setMissingSecrets] = useState<MissingSecret[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadSecrets = async () => {
      setLoading(true)
      setError(null)
      try {
        // 1. Fetch server details
        const server = await window.api.serversGet(serverId)
        if (!server) {
          throw new Error(`Server ${serverId} not found`)
        }
        setServerName(server.name)

        // 2. Check for missing secrets
        const missing: MissingSecret[] = []

        // Environment variable secrets
        for (const key of server.secretEnvKeys ?? []) {
          const value = await window.api.secretsGet(server.name, key)
          if (value === null) {
            missing.push({ key, type: 'env', value: '', saved: false })
          }
        }

        // Header secrets
        for (const key of server.secretHeaderKeys ?? []) {
          const headerKey = `${HEADER_SECRET_PREFIX}${key}`
          const value = await window.api.secretsGet(server.name, headerKey)
          if (value === null) {
            missing.push({ key, type: 'header', value: '', saved: false })
          }
        }

        setMissingSecrets(missing)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load secrets'
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    void loadSecrets()
  }, [serverId])

  const handleSecretChange = (index: number, value: string) => {
    setMissingSecrets((prev) =>
      prev.map((secret, idx) => (idx === index ? { ...secret, value, saved: false } : secret)),
    )
  }

  const handleSaveSecret = async (index: number) => {
    const secret = missingSecrets[index]
    if (!secret || !secret.value.trim() || !serverName) return

    setSaving(true)
    try {
      const key = secret.type === 'header' ? `${HEADER_SECRET_PREFIX}${secret.key}` : secret.key
      await window.api.secretsSet(serverName, key, secret.value)
      setMissingSecrets((prev) => prev.map((s, idx) => (idx === index ? { ...s, saved: true } : s)))
      toast.success(t('installer.secrets.saved', { key: secret.key }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save secret'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAll = async () => {
    if (!serverName) return
    setSaving(true)
    try {
      for (const secret of missingSecrets) {
        if (secret.value.trim() && !secret.saved) {
          const key = secret.type === 'header' ? `${HEADER_SECRET_PREFIX}${secret.key}` : secret.key
          await window.api.secretsSet(serverName, key, secret.value)
        }
      }
      // Mark all as saved
      setMissingSecrets((prev) => prev.map((s) => ({ ...s, saved: true })))
      toast.success(t('installer.secrets.allSaved'))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save secrets'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">{t('installer.secrets.loading')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h4 className="font-medium">{t('installer.secrets.title')}</h4>
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  if (missingSecrets.length === 0) {
    return (
      <div className="space-y-3">
        <h4 className="font-medium">{t('installer.secrets.title')}</h4>
        <p className="text-sm text-muted-foreground">{t('installer.secrets.description')}</p>
        <div className="rounded-md border border-border/70 bg-background p-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-sm">{t('installer.secrets.noMissing')}</p>
          </div>
        </div>
      </div>
    )
  }

  const allSaved = missingSecrets.every((s) => s.saved)
  const hasUnsaved = missingSecrets.some((s) => !s.saved && s.value.trim())

  return (
    <div className="space-y-3">
      <h4 className="font-medium">{t('installer.secrets.title')}</h4>
      <p className="text-sm text-muted-foreground">{t('installer.secrets.description')}</p>

      <div className="space-y-3">
        {missingSecrets.map((secret, idx) => (
          <div
            key={`${secret.type}-${secret.key}`}
            className="rounded-md border border-border/70 bg-background p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{secret.key}</span>
                <Badge variant={secret.type === 'env' ? 'secondary' : 'outline'}>
                  {secret.type === 'env'
                    ? t('installer.secrets.envVar')
                    : t('installer.secrets.header')}
                </Badge>
              </div>
              {secret.saved && (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check size={12} />
                  <span>{t('installer.secrets.savedLabel')}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={secret.value}
                onChange={(e) => handleSecretChange(idx, e.target.value)}
                placeholder={t('installer.secrets.placeholder', { key: secret.key })}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={secret.saved || saving}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleSaveSecret(idx)}
                disabled={!secret.value.trim() || secret.saved || saving}
              >
                {secret.saved ? <Check size={14} /> : t('installer.secrets.save')}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          {t('installer.secrets.count', {
            total: missingSecrets.length,
            saved: missingSecrets.filter((s) => s.saved).length,
          })}
        </p>
        <Button
          type="button"
          onClick={() => void handleSaveAll()}
          disabled={!hasUnsaved || saving || allSaved}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('installer.secrets.saving')}
            </>
          ) : (
            t('installer.secrets.saveAll')
          )}
        </Button>
      </div>
    </div>
  )
}

interface InstallationStepProps {
  readonly serverId: string
  readonly logs: readonly string[]
}

const InstallationStep = ({ serverId, logs }: InstallationStepProps) => {
  const { t } = useTranslation()
  console.log(serverId) // placeholder to use serverId
  return (
    <div className="space-y-3">
      <h4 className="font-medium">{t('installer.installation.title')}</h4>
      <div className="h-48 overflow-y-auto rounded-md border border-border bg-background p-3 font-mono text-xs">
        {logs.length === 0 ? (
          <p className="text-muted-foreground">{t('installer.installation.waiting')}</p>
        ) : (
          logs.map((line, idx) => <div key={idx}>{line}</div>)
        )}
      </div>
    </div>
  )
}

interface CompletionStepProps {
  readonly success: boolean
  readonly serverName: string
}

const CompletionStep = ({ success, serverName }: CompletionStepProps) => {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {success ? (
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        ) : (
          <XCircle className="h-8 w-8 text-destructive" />
        )}
        <div>
          <h4 className="font-medium">
            {success
              ? t('installer.completion.success', { name: serverName })
              : t('installer.completion.failure', { name: serverName })}
          </h4>
          <p className="text-sm text-muted-foreground">
            {success
              ? t('installer.completion.successDescription')
              : t('installer.completion.failureDescription')}
          </p>
        </div>
      </div>
    </div>
  )
}

export { InstallLocalWizard }
