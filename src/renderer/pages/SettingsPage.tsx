/**
 * @file src/renderer/pages/SettingsPage.tsx
 *
 * @created 07.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Application settings page with sections for general preferences,
 * licensing, Git sync remote configuration, and app information. Persists all
 * settings via the `settings:get` / `settings:set` IPC channels backed by
 * the SQLite key-value store.
 */

import { useState, useEffect, useCallback, useMemo, type ElementType, type ReactNode } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Save,
  RotateCcw,
  Key,
  Globe,
  Github,
  Info,
  Download,
  Upload,
  Unplug,
  AlertTriangle,
  BookOpen,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PathWithActions } from '@/components/common/PathWithActions'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLicense } from '@/lib/useLicense'
import { useFeatureGate } from '@/lib/useFeatureGate'
import { useTheme, type Theme } from '@/lib/useTheme'
import { useSettingsSections } from '@/hooks/useSettingsSections'
import { DEFAULT_LANGUAGE, normalizeLanguage, type SupportedLanguage } from '@/i18n/language'
import { appService } from '@/services/app.service'
import { settingsService } from '@/services/settings.service'
import { UpgradePrompt } from '@/components/common/UpgradePrompt'
import type { OssAttribution } from '@shared/types'

// ─── Validation Schemas ───────────────────────────────────────────────────────

type GitRemoteAuthMethod = 'ssh' | 'https-token'
type ParsedRemoteUrlKind = 'empty' | 'ssh' | 'https' | 'invalid' | 'invalid-ssh-missing-user'
type GitSyncPhase =
  | 'idle'
  | 'connecting'
  | 'testing'
  | 'pulling'
  | 'pushing'
  | 'disconnecting'
  | 'connected'
  | 'error'
type GitSyncStatusMode = 'sync' | 'test'

interface GitRemoteForm {
  remoteUrl: string
  authMethod: GitRemoteAuthMethod
  httpsToken?: string | undefined
}

interface GitRemoteSettings {
  remoteUrl: string
  authMethod: GitRemoteAuthMethod
}

interface ParsedRemoteUrl {
  kind: ParsedRemoteUrlKind
  normalized: string
}

const SSH_SCP_REMOTE_RE = /^([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+):(.+)$/
const SSH_SCP_MISSING_USER_RE = /^([a-zA-Z0-9.-]+):(.+)$/

const parseGitRemoteUrl = (value: string): ParsedRemoteUrl => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return { kind: 'empty', normalized: '' }
  }

  const scpMatch = trimmed.match(SSH_SCP_REMOTE_RE)
  if (scpMatch) {
    const user = scpMatch[1] ?? ''
    const host = scpMatch[2] ?? ''
    const rawPath = scpMatch[3] ?? ''
    const path = rawPath.replace(/^\/+/, '')
    if (path.length === 0) {
      return { kind: 'invalid', normalized: trimmed }
    }

    return { kind: 'ssh', normalized: `ssh://${user}@${host}/${path}` }
  }

  const missingUserSshMatch = trimmed.match(SSH_SCP_MISSING_USER_RE)
  if (missingUserSshMatch && !trimmed.includes('://')) {
    return { kind: 'invalid-ssh-missing-user', normalized: trimmed }
  }

  try {
    const parsed = new URL(trimmed)
    const protocol = parsed.protocol.toLowerCase()

    if (protocol === 'https:') {
      return { kind: 'https', normalized: trimmed }
    }

    if (protocol === 'ssh:') {
      const host = parsed.hostname
      const path = parsed.pathname.replace(/^\/+/, '')
      if (host.length === 0 || path.length === 0) {
        return { kind: 'invalid', normalized: trimmed }
      }

      const usernameSegment = parsed.username.length > 0 ? `${parsed.username}@` : ''
      const portSegment = parsed.port.length > 0 ? `:${parsed.port}` : ''
      return { kind: 'ssh', normalized: `ssh://${usernameSegment}${host}${portSegment}/${path}` }
    }
  } catch {
    return { kind: 'invalid', normalized: trimmed }
  }

  return { kind: 'invalid', normalized: trimmed }
}

const createGitRemoteSchema = (t: (key: string) => string) =>
  z
    .object({
      remoteUrl: z.string(),
      authMethod: z.enum(['ssh', 'https-token']),
      httpsToken: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const parsed = parseGitRemoteUrl(data.remoteUrl)

      if (parsed.kind === 'empty') return

      if (parsed.kind === 'invalid') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['remoteUrl'],
          message: t('settings.remoteUrlErrorInvalid'),
        })
        return
      }

      if (parsed.kind === 'invalid-ssh-missing-user') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['remoteUrl'],
          message:
            data.authMethod === 'ssh'
              ? t('settings.remoteUrlErrorSshMissingUser')
              : t('settings.remoteUrlErrorInvalid'),
        })
        return
      }

      if (data.authMethod === 'ssh' && parsed.kind !== 'ssh') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['remoteUrl'],
          message: t('settings.remoteUrlErrorNeedSsh'),
        })
        return
      }

      if (data.authMethod === 'https-token' && parsed.kind !== 'https') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['remoteUrl'],
          message: t('settings.remoteUrlErrorNeedHttps'),
        })
        return
      }

      if (data.authMethod === 'https-token' && (data.httpsToken ?? '').trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['httpsToken'],
          message: t('settings.patRequired'),
        })
      }
    })

const licenseSchema = z.object({
  licenseKey: z.string().min(1, 'License key is required'),
})

type LicenseForm = z.infer<typeof licenseSchema>
const VISUAL_STUDIO_CONFIG_SETTING_KEY = 'clients.visualStudio.configPath'

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Section wrapper with a heading and description.
 */
const Section = ({
  title,
  description,
  icon: Icon,
  children,
}: Readonly<{
  title: string
  description: string
  icon: ElementType
  children: ReactNode
}>) => (
  <Card aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
    <CardHeader className="pb-2">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-muted-foreground" aria-hidden="true" />
        <h2
          id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
          className="text-base font-semibold"
        >
          {title}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)

// ─── Licensing Section ────────────────────────────────────────────────────────

const LicensingSection = () => {
  const { t } = useTranslation()
  const { status, activating, activate, deactivate } = useLicense()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LicenseForm>({ resolver: zodResolver(licenseSchema) })

  const onActivate = handleSubmit(async ({ licenseKey }) => {
    await activate(licenseKey)
    reset()
  })

  return (
    <Section
      title={t('settings.licensingTitle')}
      description={t('settings.licensingDescription')}
      icon={Key}
    >
      {status.valid && status.tier === 'pro' ? (
        <div className="space-y-3" data-testid="license-active">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
              {t('license.proActive')}
            </span>
            {status.expiresAt && (
              <span className="text-xs text-muted-foreground">
                {t('license.expires', { date: new Date(status.expiresAt).toLocaleDateString() })}
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="link"
            onClick={() => void deactivate()}
            className="h-auto p-0 text-sm text-destructive underline hover:no-underline"
            data-testid="btn-deactivate-license"
          >
            {t('license.deactivateButton')}
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => void onActivate(e)}
          className="flex gap-2"
          data-testid="license-form"
        >
          <div className="flex-1">
            <Input
              {...register('licenseKey')}
              type="text"
              placeholder={t('license.keyPlaceholder')}
              aria-label={t('license.keyLabel')}
              data-testid="input-license-key"
            />
            {errors.licenseKey && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {errors.licenseKey.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={activating} data-testid="btn-activate-license">
            {activating ? t('license.activating') : t('license.activate')}
          </Button>
        </form>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {t('license.freeTierNote')}{' '}
        <a
          href="https://aidrelay.dev/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline"
        >
          {t('license.viewProFeatures')}
        </a>
      </p>
    </Section>
  )
}

// ─── Git Remote Section ───────────────────────────────────────────────────────

const GitRemoteSection = () => {
  const { t } = useTranslation()
  const canGitSync = useFeatureGate('gitSync')
  const [guideOpen, setGuideOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [syncPhase, setSyncPhase] = useState<GitSyncPhase>('idle')
  const [syncStatusMode, setSyncStatusMode] = useState<GitSyncStatusMode>('sync')
  const [syncError, setSyncError] = useState<string | null>(null)
  const gitRemoteSchema = useMemo(() => createGitRemoteSchema(t), [t])
  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GitRemoteForm>({
    resolver: zodResolver(gitRemoteSchema),
    defaultValues: { remoteUrl: '', authMethod: 'ssh', httpsToken: '' },
  })

  const authMethod = watch('authMethod')
  const remoteUrl = watch('remoteUrl')
  const operationInProgress =
    syncPhase === 'connecting' ||
    syncPhase === 'testing' ||
    syncPhase === 'pulling' ||
    syncPhase === 'pushing' ||
    syncPhase === 'disconnecting'
  const hasRemoteUrlValue = parseGitRemoteUrl(remoteUrl ?? '').normalized.trim().length > 0

  const normalizeFormData = useCallback((data: GitRemoteForm): GitRemoteForm => {
    const normalizedRemoteUrl = parseGitRemoteUrl(data.remoteUrl).normalized
    if (data.authMethod === 'https-token') {
      return {
        remoteUrl: normalizedRemoteUrl,
        authMethod: 'https-token',
        httpsToken: (data.httpsToken ?? '').trim(),
      }
    }

    return {
      remoteUrl: normalizedRemoteUrl,
      authMethod: 'ssh',
    }
  }, [])

  const toPersistedSettings = useCallback((config: GitRemoteForm): GitRemoteSettings => {
    return {
      remoteUrl: config.remoteUrl,
      authMethod: config.authMethod,
    }
  }, [])

  const applyPull = useCallback(async (): Promise<void> => {
    setSyncStatusMode('sync')
    setSyncError(null)
    setSyncPhase('pulling')
    const pullResult = await window.api.gitSyncPull()
    if (!pullResult.success) {
      throw new Error(pullResult.error ?? t('settings.gitSyncStatusErrorUnknown'))
    }

    const totalImported =
      pullResult.serversImported +
      pullResult.rulesImported +
      pullResult.profilesImported +
      pullResult.installIntentsImported +
      pullResult.skillsImported

    if (totalImported === 0 && pullResult.conflicts === 0 && pullResult.skillConflicts === 0) {
      toast.success(t('settings.gitSyncPullSuccessNoChanges'))
    } else {
      toast.success(
        t('settings.gitSyncPullSuccessSummary', {
          servers: pullResult.serversImported,
          rules: pullResult.rulesImported,
          profiles: pullResult.profilesImported,
          conflicts: pullResult.conflicts,
        }),
      )
    }

    setIsConnected(true)
    setSyncPhase('connected')
    setSyncError(null)
  }, [t])

  const handleSyncFailure = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    setSyncPhase('error')
    setSyncError(message)
  }, [])

  const runManualConnectAndPull = useCallback(
    async (config: GitRemoteForm): Promise<void> => {
      if (config.remoteUrl.trim().length === 0) {
        setSyncPhase('idle')
        setSyncError(null)
        setIsConnected(false)
        return
      }

      setSyncError(null)
      setSyncStatusMode('sync')
      setSyncPhase('connecting')
      await window.api.gitSyncConnectManual({
        remoteUrl: config.remoteUrl,
        authMethod: config.authMethod,
        ...(config.authMethod === 'https-token' ? { authToken: config.httpsToken ?? '' } : {}),
      })
      setIsConnected(true)
      await applyPull()
    },
    [applyPull],
  )

  const runOAuthConnectAndPull = useCallback(async (): Promise<void> => {
    setSyncStatusMode('sync')
    setSyncError(null)
    setSyncPhase('connecting')
    await window.api.gitSyncConnectGitHub()
    setIsConnected(true)
    await applyPull()
    toast.success(t('settings.gitSyncConnectedViaGitHub'))
  }, [applyPull, t])

  useEffect(() => {
    let mounted = true

    void Promise.all([
      settingsService.get('git-remote'),
      window.api.gitSyncStatus().catch(() => null),
    ]).then(([stored, status]) => {
      if (!mounted) return

      if (stored && typeof stored === 'object') {
        const typed = stored as Partial<GitRemoteForm>
        const normalizedRemoteUrl =
          typeof typed.remoteUrl === 'string'
            ? parseGitRemoteUrl(typed.remoteUrl).normalized || typed.remoteUrl.trim()
            : ''

        const normalized: GitRemoteForm = {
          remoteUrl: normalizedRemoteUrl,
          authMethod: typed.authMethod === 'https-token' ? 'https-token' : 'ssh',
          // Backward compatibility: legacy persisted tokens are ignored and stripped on next save.
          httpsToken: '',
        }

        reset(normalized)
      }

      if (status) {
        setIsConnected(status.connected)
        setSyncPhase(status.connected ? 'connected' : 'idle')
      }
    })

    return () => {
      mounted = false
    }
  }, [reset])

  const onSaveManual = handleSubmit(async (data) => {
    if (!canGitSync) return

    const normalized = normalizeFormData(data)
    const persisted = toPersistedSettings(normalized)

    await settingsService.set('git-remote', persisted)

    try {
      await runManualConnectAndPull(normalized)
      if (normalized.authMethod === 'https-token') {
        setValue('httpsToken', '', { shouldDirty: false })
      }
      reset({ ...persisted, httpsToken: '' })
    } catch (error) {
      handleSyncFailure(error)
    }
  })

  const onTestSsh = handleSubmit(async (data) => {
    if (!canGitSync) return

    const normalized = normalizeFormData(data)
    if (normalized.authMethod !== 'ssh' || normalized.remoteUrl.trim().length === 0) return

    try {
      setSyncStatusMode('test')
      setSyncError(null)
      setSyncPhase('testing')

      const result = await window.api.gitSyncTestRemote({
        remoteUrl: normalized.remoteUrl,
        authMethod: 'ssh',
      })

      if (!result.success) {
        throw new Error(result.error ?? t('settings.gitSyncStatusErrorUnknown'))
      }

      setSyncPhase('connected')
      setSyncError(null)
      toast.success(t('settings.gitSyncStatusTestPassed'))
    } catch (error) {
      handleSyncFailure(error)
    }
  })

  const onConnectGitHub = useCallback(() => {
    if (!canGitSync || operationInProgress) return
    void runOAuthConnectAndPull().catch((error) => {
      handleSyncFailure(error)
    })
  }, [canGitSync, handleSyncFailure, operationInProgress, runOAuthConnectAndPull])

  const onPull = useCallback(() => {
    if (!canGitSync || operationInProgress || !isConnected) return
    void applyPull().catch((error) => {
      handleSyncFailure(error)
    })
  }, [applyPull, canGitSync, handleSyncFailure, isConnected, operationInProgress])

  const onPush = useCallback(() => {
    if (!canGitSync || operationInProgress || !isConnected) return
    void (async () => {
      try {
        setSyncStatusMode('sync')
        setSyncError(null)
        setSyncPhase('pushing')
        const pushResult = await window.api.gitSyncPush()
        if (!pushResult.success) {
          throw new Error(pushResult.error ?? t('settings.gitSyncStatusErrorUnknown'))
        }
        setSyncPhase('connected')
        setSyncError(null)
        if (pushResult.commitHash) {
          toast.success(
            t('settings.gitSyncPushSuccessSummary', { commitHash: pushResult.commitHash }),
          )
        } else {
          toast.success(t('settings.gitSyncPushSuccessNoChanges'))
        }
      } catch (error) {
        handleSyncFailure(error)
      }
    })()
  }, [canGitSync, handleSyncFailure, isConnected, operationInProgress, t])

  const onDisconnect = useCallback(() => {
    if (!canGitSync || operationInProgress || !isConnected) return
    void (async () => {
      try {
        setSyncStatusMode('sync')
        setSyncError(null)
        setSyncPhase('disconnecting')
        await window.api.gitSyncDisconnect()
        setIsConnected(false)
        setSyncPhase('idle')
        setSyncError(null)
        toast.success(t('settings.gitSyncDisconnected'))
      } catch (error) {
        handleSyncFailure(error)
      }
    })()
  }, [canGitSync, handleSyncFailure, isConnected, operationInProgress, t])

  const syncStatusLabel = useMemo(() => {
    switch (syncPhase) {
      case 'connecting':
        return t('settings.gitSyncStatusConnecting')
      case 'testing':
        return t('settings.gitSyncStatusTesting')
      case 'pulling':
        return t('settings.gitSyncStatusPulling')
      case 'pushing':
        return t('settings.gitSyncStatusPushing')
      case 'disconnecting':
        return t('settings.gitSyncStatusDisconnecting')
      case 'connected':
        return syncStatusMode === 'test'
          ? t('settings.gitSyncStatusTestPassed')
          : t('settings.gitSyncStatusConnected')
      case 'error':
        return syncStatusMode === 'test'
          ? t('settings.gitSyncStatusTestFailed')
          : t('settings.gitSyncStatusError')
      default:
        return t('settings.gitSyncStatusIdle')
    }
  }, [syncPhase, syncStatusMode, t])

  const isPublicKeyAuthError =
    syncPhase === 'error' && syncError !== null && /publickey/i.test(syncError)

  return (
    <Section
      title={t('settings.gitSyncTitle')}
      description={t('settings.gitSyncDescription')}
      icon={Globe}
    >
      {!canGitSync && (
        <div className="mb-3" data-testid="git-sync-upgrade-prompt">
          <UpgradePrompt
            feature={t('settings.gitSyncTitle')}
            description={t('settings.gitSyncReadOnlyDescription')}
          />
        </div>
      )}

      <Button
        type="button"
        variant="link"
        onClick={() => setGuideOpen(true)}
        className="h-auto p-0 text-sm"
        data-testid="btn-open-git-sync-guide"
      >
        {t('settings.gitSyncGuideLink')}
      </Button>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="sm:max-w-2xl" data-testid="git-sync-guide-dialog">
          <DialogHeader>
            <DialogTitle>{t('settings.gitSyncGuideTitle')}</DialogTitle>
            <DialogDescription>{t('settings.gitSyncGuideDescription')}</DialogDescription>
          </DialogHeader>

          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              <p className="font-medium">{t('settings.gitSyncGuideStepRepoTitle')}</p>
              <p className="text-muted-foreground">{t('settings.gitSyncGuideStepRepoBody')}</p>
            </li>
            <li>
              <p className="font-medium">{t('settings.gitSyncGuideStepOAuthTitle')}</p>
              <p className="text-muted-foreground">{t('settings.gitSyncGuideStepOAuthBody')}</p>
            </li>
            <li>
              <p className="font-medium">{t('settings.gitSyncGuideStepAuthTitle')}</p>
              <p className="text-muted-foreground">{t('settings.gitSyncGuideStepAuthBody')}</p>
            </li>
            <li>
              <p className="font-medium">{t('settings.gitSyncGuideStepSaveTitle')}</p>
              <p className="text-muted-foreground">{t('settings.gitSyncGuideStepSaveBody')}</p>
            </li>
          </ol>

          <div className="flex flex-col gap-1 text-sm">
            <a
              href="https://docs.github.com/en/authentication/connecting-to-github-with-ssh"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              {t('settings.gitSyncGuideSshDocsLink')}
            </a>
            <a
              href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              {t('settings.gitSyncGuidePatDocsLink')}
            </a>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGuideOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onConnectGitHub}
          disabled={!canGitSync || operationInProgress}
          className="gap-1.5"
          data-testid="btn-connect-github-oauth"
        >
          <Github size={14} aria-hidden="true" />
          {t('settings.connectGitHubButton')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onPull}
          disabled={!canGitSync || operationInProgress || !isConnected}
          className="gap-1.5"
          data-testid="btn-git-sync-pull"
        >
          <Download size={14} aria-hidden="true" />
          {t('settings.pullButton')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onPush}
          disabled={!canGitSync || operationInProgress || !isConnected}
          className="gap-1.5"
          data-testid="btn-git-sync-push"
        >
          <Upload size={14} aria-hidden="true" />
          {t('settings.pushButton')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onDisconnect}
          disabled={!canGitSync || operationInProgress || !isConnected}
          className="gap-1.5"
          data-testid="btn-git-sync-disconnect"
        >
          <Unplug size={14} aria-hidden="true" />
          {t('settings.disconnectButton')}
        </Button>
      </div>

      <details
        className="mt-4 rounded-md border border-border/70 p-3"
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen((event.currentTarget as HTMLDetailsElement).open)}
        data-testid="git-sync-advanced"
      >
        <summary
          className="cursor-pointer text-sm font-medium"
          data-testid="git-sync-advanced-summary"
        >
          {t('settings.gitSyncAdvancedTitle')}
        </summary>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('settings.gitSyncAdvancedDescription')}
        </p>

        <form
          onSubmit={(event) => void onSaveManual(event)}
          className="mt-3 space-y-3"
          data-testid="git-remote-form"
        >
          <div>
            <Label htmlFor="remote-url" className="block mb-1">
              {t('settings.remoteUrlLabel')}
            </Label>
            <Input
              id="remote-url"
              {...register('remoteUrl')}
              type="text"
              placeholder={t('settings.remoteUrlPlaceholder')}
              data-testid="input-remote-url"
              disabled={!canGitSync || operationInProgress}
            />
            {errors.remoteUrl && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {errors.remoteUrl.message}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground" data-testid="remote-url-help">
              {authMethod === 'ssh'
                ? t('settings.remoteUrlHelpSsh')
                : t('settings.remoteUrlHelpHttpsToken')}
            </p>
            {authMethod === 'ssh' && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                <li>{t('settings.sshChecklistKeyLoaded')}</li>
                <li>{t('settings.sshChecklistKeyRegistered')}</li>
                <li>{t('settings.sshChecklistRepoAccess')}</li>
              </ul>
            )}
          </div>

          <div>
            <span className="block text-sm font-medium mb-1">{t('settings.authMethodLabel')}</span>
            <Controller
              control={control}
              name="authMethod"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-4"
                  disabled={!canGitSync || operationInProgress}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="ssh" id="auth-ssh" />
                    <Label htmlFor="auth-ssh" className="cursor-pointer text-sm font-normal">
                      {t('settings.authSsh')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="https-token" id="auth-https-token" />
                    <Label
                      htmlFor="auth-https-token"
                      className="cursor-pointer text-sm font-normal"
                    >
                      {t('settings.authHttpsToken')}
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>

          {authMethod === 'https-token' && (
            <div>
              <Label htmlFor="https-token" className="block mb-1">
                {t('settings.patLabel')}
              </Label>
              <Input
                id="https-token"
                {...register('httpsToken')}
                type="password"
                placeholder={t('settings.patPlaceholder')}
                data-testid="input-https-token"
                disabled={!canGitSync || operationInProgress}
              />
              {errors.httpsToken && (
                <p className="mt-1 text-xs text-destructive" role="alert">
                  {errors.httpsToken.message}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={!canGitSync || isSubmitting || operationInProgress || !hasRemoteUrlValue}
              className="gap-1.5"
              data-testid="btn-save-git-remote"
            >
              <Save size={14} aria-hidden="true" />
              {t('settings.saveButton')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                !canGitSync ||
                authMethod !== 'ssh' ||
                isSubmitting ||
                operationInProgress ||
                !hasRemoteUrlValue
              }
              onClick={() => void onTestSsh()}
              className="gap-1.5"
              data-testid="btn-test-git-ssh"
            >
              <Globe size={14} aria-hidden="true" />
              {t('settings.testSshButton')}
            </Button>
          </div>
        </form>
      </details>

      <div
        className="mt-3 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm"
        data-testid="git-sync-status-row"
      >
        <div className="flex items-center gap-2" data-testid="git-sync-status-text">
          {syncPhase === 'connected' && <CheckCircle2 size={14} className="text-green-600" />}
          {operationInProgress && (
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
          )}
          {syncPhase === 'error' && <XCircle size={14} className="text-destructive" />}
          {syncPhase === 'idle' && <Info size={14} className="text-muted-foreground" />}
          <span>{syncStatusLabel}</span>
        </div>

        {syncPhase === 'error' && syncError && (
          <p className="mt-1 text-xs text-destructive" data-testid="git-sync-status-error">
            {syncError}
          </p>
        )}

        {isPublicKeyAuthError && (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="git-sync-publickey-help">
            {t('settings.gitSyncPublicKeyHelp')}{' '}
            <button
              type="button"
              className="underline hover:no-underline"
              onClick={() => setGuideOpen(true)}
            >
              {t('settings.gitSyncOpenGuideLink')}
            </button>
          </p>
        )}
      </div>
    </Section>
  )
}
// ─── General Section ──────────────────────────────────────────────────────────

const GeneralSection = () => {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    const current = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language)
    return current ?? DEFAULT_LANGUAGE
  })
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    let mounted = true

    void settingsService.get('language').then((lang) => {
      const savedLanguage = normalizeLanguage(lang)
      const activeLanguage =
        normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LANGUAGE

      if (!mounted) return

      if (savedLanguage) {
        setLanguage(savedLanguage)
        if (savedLanguage !== activeLanguage) {
          void i18n.changeLanguage(savedLanguage)
        }
        localStorage.setItem('language', savedLanguage)
        return
      }

      setLanguage(activeLanguage)
    })

    const handleLanguageChanged = (nextLanguage: string): void => {
      const normalized = normalizeLanguage(nextLanguage)
      if (normalized) {
        setLanguage(normalized)
      }
    }

    i18n.on('languageChanged', handleLanguageChanged)
    return () => {
      mounted = false
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [i18n])

  const saveLanguage = useCallback(
    async (lang: string) => {
      const normalized = normalizeLanguage(lang)
      if (!normalized) return

      setLanguage(normalized)
      await i18n.changeLanguage(normalized)
      localStorage.setItem('language', normalized)
      await settingsService.set('language', normalized)
      toast.success(t('settings.languageSaved'))
    },
    [i18n, t],
  )

  return (
    <Section
      title={t('settings.generalTitle')}
      description={t('settings.generalDescription')}
      icon={Globe}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="theme-select" className="block mb-1">
            {t('settings.themeLabel')}
          </Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <SelectTrigger id="theme-select" className="w-40" data-testid="select-theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t('theme.light')}</SelectItem>
              <SelectItem value="dark">{t('theme.dark')}</SelectItem>
              <SelectItem value="system">{t('theme.system')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="language-select" className="block mb-1">
            {t('settings.languageLabel')}
          </Label>
          <Select value={language} onValueChange={(v) => void saveLanguage(v)}>
            <SelectTrigger id="language-select" className="w-40" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t('settings.langEnglish')}</SelectItem>
              <SelectItem value="de">{t('settings.langGerman')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Section>
  )
}

// ─── Client Paths Section ────────────────────────────────────────────────────

const ClientPathsSection = () => {
  const { t } = useTranslation()
  const [visualStudioPath, setVisualStudioPath] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void settingsService.get(VISUAL_STUDIO_CONFIG_SETTING_KEY).then((value) => {
      if (typeof value === 'string') setVisualStudioPath(value)
    })
  }, [])

  const saveVisualStudioPath = async () => {
    setSaving(true)
    try {
      await settingsService.set(VISUAL_STUDIO_CONFIG_SETTING_KEY, visualStudioPath.trim())
      toast.success(t('settings.visualStudioPathSaved'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      title={t('settings.clientPathsTitle')}
      description={t('settings.clientPathsDescription')}
      icon={Info}
    >
      <div className="space-y-3">
        <div>
          <Label htmlFor="visual-studio-config-path" className="block mb-1">
            {t('settings.visualStudioPathLabel')}
          </Label>
          <Input
            id="visual-studio-config-path"
            type="text"
            value={visualStudioPath}
            onChange={(e) => setVisualStudioPath(e.target.value)}
            placeholder={t('settings.visualStudioPathPlaceholder')}
            data-testid="input-visual-studio-config-path"
          />
          {visualStudioPath.trim().length > 0 ? (
            <div className="mt-2 rounded-md border border-border/70 bg-muted/30 px-2 py-1">
              <PathWithActions
                path={visualStudioPath.trim()}
                className="flex items-center gap-1 min-w-0 text-xs"
                textClassName="font-mono truncate flex-1"
                testIdPrefix="settings-visual-studio-path"
              />
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={() => void saveVisualStudioPath()}
          disabled={saving}
          className="gap-1.5"
          data-testid="btn-save-visual-studio-path"
        >
          <Save size={14} aria-hidden="true" />
          {t('settings.saveButton')}
        </Button>
      </div>
    </Section>
  )
}

// ─── About Section ────────────────────────────────────────────────────────────

const AboutSection = () => {
  const { t } = useTranslation()
  const [version, setVersion] = useState('—')
  const [checking, setChecking] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const [ossDialogOpen, setOssDialogOpen] = useState(false)
  const [ossLoading, setOssLoading] = useState(false)
  const [ossLoaded, setOssLoaded] = useState(false)
  const [ossError, setOssError] = useState<string | null>(null)
  const [ossAttributions, setOssAttributions] = useState<OssAttribution[]>([])
  const [ossQuery, setOssQuery] = useState('')

  useEffect(() => {
    void appService.version().then(setVersion)
  }, [])

  useEffect(() => {
    const unsubAvailable = appService.onUpdateAvailable(({ version }) => {
      setUpdateAvailable(true)
      setUpdateVersion(version)
    })
    const unsubDownloaded = appService.onUpdateDownloaded(({ version }) => {
      setDownloaded(true)
      setUpdateVersion(version)
    })
    return () => {
      unsubAvailable()
      unsubDownloaded()
    }
  }, [])

  useEffect(() => {
    if (!ossDialogOpen || ossLoading || ossLoaded) return

    setOssLoading(true)
    setOssError(null)
    void appService
      .ossAttributions()
      .then((items) => {
        setOssAttributions(items)
        setOssLoaded(true)
      })
      .catch(() => {
        setOssError(t('settings.ossLoadError'))
        setOssLoaded(true)
      })
      .finally(() => {
        setOssLoading(false)
      })
  }, [ossDialogOpen, ossLoaded, ossLoading, t])

  const filteredAttributions = useMemo(() => {
    const query = ossQuery.trim().toLowerCase()
    if (!query) return ossAttributions

    return ossAttributions.filter((entry) => {
      return (
        entry.packageName.toLowerCase().includes(query) ||
        entry.license.toLowerCase().includes(query) ||
        entry.version.toLowerCase().includes(query)
      )
    })
  }, [ossAttributions, ossQuery])

  const handleCheckUpdates = async () => {
    setChecking(true)
    await appService.checkForUpdates()
    setTimeout(() => setChecking(false), 3000)
    toast.info(t('settings.checkingForUpdates'))
  }

  const handleInstall = async () => {
    await appService.installUpdate()
  }

  return (
    <Section
      title={t('settings.aboutTitle')}
      description={t('settings.aboutDescription')}
      icon={Info}
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">{t('settings.versionLabel')}</span>
          <span className="font-mono font-medium">{version}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">{t('settings.platformLabel')}</span>
          <span>{t('settings.platformWindows')}</span>
        </div>

        {updateAvailable && !downloaded && (
          <p className="text-amber-600 dark:text-amber-400">
            {t('settings.updateDownloading', { version: updateVersion })}
          </p>
        )}

        {downloaded && (
          <div className="flex items-center gap-3">
            <p className="text-green-600 dark:text-green-400">
              {t('settings.updateReady', { version: updateVersion })}
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleInstall()}
              className="gap-1.5"
              data-testid="btn-install-update"
            >
              <Download size={12} aria-hidden="true" />
              {t('settings.restartInstall')}
            </Button>
          </div>
        )}

        {!updateAvailable && !downloaded && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCheckUpdates()}
            disabled={checking}
            className="gap-1.5"
            data-testid="btn-check-updates"
          >
            <RotateCcw size={14} aria-hidden="true" />
            {checking ? t('settings.checkingUpdates') : t('settings.checkUpdates')}
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOssDialogOpen(true)}
          className="gap-1.5"
          data-testid="btn-open-oss-attributions"
        >
          <BookOpen size={14} aria-hidden="true" />
          {t('settings.openSourceAttributions')}
        </Button>

        <Dialog open={ossDialogOpen} onOpenChange={setOssDialogOpen}>
          <DialogContent className="sm:max-w-4xl" data-testid="oss-attributions-modal">
            <DialogHeader>
              <DialogTitle>{t('settings.ossDialogTitle')}</DialogTitle>
              <DialogDescription>{t('settings.ossDialogDescription')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                value={ossQuery}
                onChange={(event) => setOssQuery(event.target.value)}
                placeholder={t('settings.ossSearchPlaceholder')}
                data-testid="input-oss-search"
              />

              {ossLoading ? (
                <p data-testid="oss-attributions-loading">{t('settings.ossLoading')}</p>
              ) : null}
              {ossError ? (
                <p className="text-destructive" data-testid="oss-attributions-error">
                  {ossError}
                </p>
              ) : null}

              {!ossLoading && !ossError ? (
                filteredAttributions.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.ossCount', { count: filteredAttributions.length })}
                    </p>
                    <ScrollArea className="h-[26rem] rounded-md border p-3">
                      <div className="space-y-3" data-testid="oss-attributions-list">
                        {filteredAttributions.map((entry) => (
                          <article
                            key={`${entry.packageName}@${entry.version}`}
                            className="rounded-md border border-border/70 p-3"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="font-medium">
                                {entry.packageName}{' '}
                                <span className="font-mono text-xs text-muted-foreground">
                                  v{entry.version}
                                </span>
                              </p>
                              <span className="rounded-full border px-2 py-0.5 text-xs">
                                {entry.license}
                              </span>
                            </div>

                            {entry.repositoryUrl ? (
                              <a
                                href={entry.repositoryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-block text-xs underline hover:no-underline"
                              >
                                {t('settings.ossSourceLink')}
                              </a>
                            ) : null}

                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm">
                                {t('settings.ossViewLicenseText')}
                              </summary>
                              {entry.licenseFile ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {t('settings.ossLicenseFile', { path: entry.licenseFile })}
                                </p>
                              ) : null}
                              <pre
                                className="mt-2 max-h-52 overflow-auto rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap break-words"
                                data-testid="oss-attribution-license-text"
                              >
                                {entry.licenseText}
                              </pre>
                            </details>
                          </article>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="oss-attributions-empty">
                    {t('settings.ossEmpty')}
                  </p>
                )
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Section>
  )
}

// ─── Danger Zone Section ─────────────────────────────────────────────────────

interface ResetSelection {
  uiPreferences: boolean
  gitRemoteForm: boolean
  gitSyncConnection: boolean
}

const DEFAULT_RESET_SELECTION: ResetSelection = {
  uiPreferences: true,
  gitRemoteForm: true,
  gitSyncConnection: false,
}

const DangerZoneSection = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [factoryConfirmOpen, setFactoryConfirmOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [factoryResetting, setFactoryResetting] = useState(false)
  const [selection, setSelection] = useState<ResetSelection>(DEFAULT_RESET_SELECTION)

  const selectedCount = Object.values(selection).filter(Boolean).length

  const updateSelection = useCallback((key: keyof ResetSelection, checked: boolean) => {
    setSelection((prev) => ({ ...prev, [key]: checked }))
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setSelection(DEFAULT_RESET_SELECTION)
    }
  }

  const handlePartialConfirm = async () => {
    if (selectedCount === 0) return
    setResetting(true)
    try {
      await appService.resetSettings({
        scope: 'partial',
        ...selection,
      })
      if (selection.uiPreferences) {
        localStorage.removeItem('theme')
      }
      toast.success(t('settings.resetSuccess'))
      setOpen(false)
    } catch {
      toast.error(t('settings.resetError'))
    } finally {
      setResetting(false)
    }
  }

  const handleFactoryConfirm = async () => {
    setFactoryResetting(true)
    try {
      await appService.resetSettings({
        scope: 'factory',
        uiPreferences: false,
        gitRemoteForm: false,
        gitSyncConnection: false,
      })
      localStorage.removeItem('theme')
      toast.info(t('settings.factoryResetRestarting'))
      setFactoryConfirmOpen(false)
      setOpen(false)
    } catch {
      toast.error(t('settings.factoryResetError'))
    } finally {
      setFactoryResetting(false)
    }
  }

  return (
    <Section
      title={t('settings.dangerTitle')}
      description={t('settings.dangerDescription')}
      icon={AlertTriangle}
    >
      <div
        className="rounded-md border border-destructive/40 bg-destructive/5 p-4"
        data-testid="settings-danger-zone"
      >
        <p className="text-sm text-muted-foreground">{t('settings.resetWarning')}</p>
        <Button
          type="button"
          variant="destructive"
          className="mt-3"
          onClick={() => handleOpenChange(true)}
          data-testid="btn-open-reset-settings"
        >
          {t('settings.resetButton')}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={!resetting} className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('settings.resetDialogTitle')}</DialogTitle>
            <DialogDescription>{t('settings.resetDialogDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3" data-testid="reset-options">
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="reset-ui-preferences"
                checked={selection.uiPreferences}
                onCheckedChange={(checked) => updateSelection('uiPreferences', checked === true)}
                data-testid="reset-option-ui-preferences"
              />
              <div>
                <Label htmlFor="reset-ui-preferences">{t('settings.resetOptionUiTitle')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('settings.resetOptionUiDescription')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="reset-git-remote"
                checked={selection.gitRemoteForm}
                onCheckedChange={(checked) => updateSelection('gitRemoteForm', checked === true)}
                data-testid="reset-option-git-remote"
              />
              <div>
                <Label htmlFor="reset-git-remote">{t('settings.resetOptionGitRemoteTitle')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('settings.resetOptionGitRemoteDescription')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="reset-git-sync"
                checked={selection.gitSyncConnection}
                onCheckedChange={(checked) =>
                  updateSelection('gitSyncConnection', checked === true)
                }
                data-testid="reset-option-git-sync"
              />
              <div>
                <Label htmlFor="reset-git-sync">{t('settings.resetOptionGitSyncTitle')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('settings.resetOptionGitSyncDescription')}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={resetting}
              className="w-full whitespace-normal text-center sm:w-auto sm:max-w-[14rem]"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setFactoryConfirmOpen(true)}
              disabled={resetting || factoryResetting}
              data-testid="btn-open-factory-reset"
              className="w-full whitespace-normal text-center sm:w-auto sm:max-w-[18rem]"
            >
              {t('settings.factoryResetButton')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handlePartialConfirm()}
              disabled={resetting || selectedCount === 0}
              data-testid="btn-confirm-reset-settings"
              className="w-full whitespace-normal text-center sm:w-auto sm:max-w-[20rem]"
            >
              {resetting ? t('settings.resettingButton') : t('settings.resetConfirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={factoryConfirmOpen} onOpenChange={setFactoryConfirmOpen}>
        <DialogContent showCloseButton={!factoryResetting} className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('settings.factoryResetTitle')}</DialogTitle>
            <DialogDescription>{t('settings.factoryResetDescription')}</DialogDescription>
          </DialogHeader>
          <div
            className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-muted-foreground"
            data-testid="factory-reset-warning"
          >
            {t('settings.factoryResetWarning')}
          </div>
          <DialogFooter className="sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFactoryConfirmOpen(false)}
              disabled={factoryResetting}
              className="w-full whitespace-normal text-center sm:w-auto sm:max-w-[14rem]"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleFactoryConfirm()}
              disabled={factoryResetting}
              data-testid="btn-confirm-factory-reset"
              className="w-full whitespace-normal text-center sm:w-auto sm:max-w-[20rem]"
            >
              {factoryResetting
                ? t('settings.factoryResettingButton')
                : t('settings.factoryResetConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Full settings page grouping all preference sections into a scrollable layout.
 */
const SettingsPage = () => {
  const { t } = useTranslation()
  const sections = useSettingsSections([
    GeneralSection,
    ClientPathsSection,
    LicensingSection,
    GitRemoteSection,
    AboutSection,
    DangerZoneSection,
  ])

  return (
    <main className="flex flex-col gap-6 max-w-2xl" data-testid="settings-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('nav.settings')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      {sections.map((SectionComponent, index) => (
        <SectionComponent key={index} />
      ))}
    </main>
  )
}

export { SettingsPage }
