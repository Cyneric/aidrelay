/**
 * @file src/renderer/pages/SettingsPage.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Application settings page with sections for general preferences,
 * licensing, Git sync remote configuration, and app information. Persists all
 * settings via the `settings:get` / `settings:set` IPC channels backed by
 * the SQLite key-value store.
 */

import { useState, useEffect, useCallback, type ElementType, type ReactNode } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Save, RotateCcw, Key, Globe, Info, Download } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLicense } from '@/lib/useLicense'
import { useTheme, type Theme } from '@/lib/useTheme'

// ─── Validation Schemas ───────────────────────────────────────────────────────

const gitRemoteSchema = z.object({
  remoteUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  authMethod: z.enum(['ssh', 'https-token']),
  httpsToken: z.string().optional(),
})

type GitRemoteForm = z.infer<typeof gitRemoteSchema>

const licenseSchema = z.object({
  licenseKey: z.string().min(1, 'License key is required'),
})

type LicenseForm = z.infer<typeof licenseSchema>

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
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<GitRemoteForm>({
    resolver: zodResolver(gitRemoteSchema),
    defaultValues: { remoteUrl: '', authMethod: 'ssh' },
  })

  const authMethod = watch('authMethod')

  useEffect(() => {
    void window.api.settingsGet('git-remote').then((stored) => {
      if (stored && typeof stored === 'object') {
        reset(stored as GitRemoteForm)
      }
    })
  }, [reset])

  const onSave = handleSubmit(async (data) => {
    await window.api.settingsSet('git-remote', data)
    reset(data)
    toast.success(t('settings.gitRemoteSaved'))
  })

  return (
    <Section
      title={t('settings.gitSyncTitle')}
      description={t('settings.gitSyncDescription')}
      icon={Globe}
    >
      <form onSubmit={(e) => void onSave(e)} className="space-y-3" data-testid="git-remote-form">
        <div>
          <Label htmlFor="remote-url" className="block mb-1">
            {t('settings.remoteUrlLabel')}
          </Label>
          <Input
            id="remote-url"
            {...register('remoteUrl')}
            type="url"
            placeholder={t('settings.remoteUrlPlaceholder')}
            data-testid="input-remote-url"
          />
          {errors.remoteUrl && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {errors.remoteUrl.message}
            </p>
          )}
        </div>

        <div>
          <span className="block text-sm font-medium mb-1">{t('settings.authMethodLabel')}</span>
          <Controller
            control={control}
            name="authMethod"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ssh" id="auth-ssh" />
                  <Label htmlFor="auth-ssh" className="cursor-pointer text-sm font-normal">
                    {t('settings.authSsh')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="https-token" id="auth-https-token" />
                  <Label htmlFor="auth-https-token" className="cursor-pointer text-sm font-normal">
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
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={!isDirty}
          className="gap-1.5"
          data-testid="btn-save-git-remote"
        >
          <Save size={14} aria-hidden="true" />
          {t('settings.saveButton')}
        </Button>
      </form>
    </Section>
  )
}

// ─── General Section ──────────────────────────────────────────────────────────

const GeneralSection = () => {
  const { t } = useTranslation()
  const [language, setLanguage] = useState('en')
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    void window.api.settingsGet('language').then((lang) => {
      if (typeof lang === 'string') setLanguage(lang)
    })
  }, [])

  const saveLanguage = useCallback(async (lang: string) => {
    setLanguage(lang)
    await window.api.settingsSet('language', lang)
    toast.success(t('settings.languageSaved'))
  }, [])

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

// ─── About Section ────────────────────────────────────────────────────────────

const AboutSection = () => {
  const { t } = useTranslation()
  const [version, setVersion] = useState('—')
  const [checking, setChecking] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    void window.api.appVersion().then(setVersion)
  }, [])

  useEffect(() => {
    const unsubAvailable = window.api.onUpdateAvailable(({ version }) => {
      setUpdateAvailable(true)
      setUpdateVersion(version)
    })
    const unsubDownloaded = window.api.onUpdateDownloaded(({ version }) => {
      setDownloaded(true)
      setUpdateVersion(version)
    })
    return () => {
      unsubAvailable()
      unsubDownloaded()
    }
  }, [])

  const handleCheckUpdates = async () => {
    setChecking(true)
    await window.api.updaterCheck()
    setTimeout(() => setChecking(false), 3000)
    toast.info(t('settings.checkingForUpdates'))
  }

  const handleInstall = async () => {
    await window.api.updaterInstall()
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
      </div>
    </Section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Full settings page grouping all preference sections into a scrollable layout.
 */
const SettingsPage = () => {
  const { t } = useTranslation()
  return (
    <main className="flex flex-col gap-6 max-w-2xl" data-testid="settings-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('nav.settings')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      <GeneralSection />
      <LicensingSection />
      <GitRemoteSection />
      <AboutSection />
    </main>
  )
}

export { SettingsPage }
