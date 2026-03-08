/**
 * @file src/renderer/pages/SettingsPage.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
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
import { Save, RotateCcw, Key, Globe, Info, Download, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useTheme, type Theme } from '@/lib/useTheme'
import { useSettingsSections } from '@/hooks/useSettingsSections'
import { appService } from '@/services/app.service'
import { settingsService } from '@/services/settings.service'

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
    void settingsService.get('git-remote').then((stored) => {
      if (stored && typeof stored === 'object') {
        reset(stored as GitRemoteForm)
      }
    })
  }, [reset])

  const onSave = handleSubmit(async (data) => {
    await settingsService.set('git-remote', data)
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
    void settingsService.get('language').then((lang) => {
      if (typeof lang === 'string') setLanguage(lang)
    })
  }, [])

  const saveLanguage = useCallback(
    async (lang: string) => {
      setLanguage(lang)
      await settingsService.set('language', lang)
      toast.success(t('settings.languageSaved'))
    },
    [t],
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

// ─── About Section ────────────────────────────────────────────────────────────

const AboutSection = () => {
  const { t } = useTranslation()
  const [version, setVersion] = useState('—')
  const [checking, setChecking] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloaded, setDownloaded] = useState(false)

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
