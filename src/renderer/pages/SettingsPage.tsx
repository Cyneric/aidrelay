/**
 * @file src/renderer/pages/SettingsPage.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
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
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Save, RotateCcw, Key, Globe, Info, Download } from 'lucide-react'
import { useLicense } from '@/lib/useLicense'

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
  <section
    className="rounded-lg border bg-card p-6"
    aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
  >
    <div className="flex items-center gap-2 mb-1">
      <Icon size={18} className="text-muted-foreground" aria-hidden="true" />
      <h2
        id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
        className="text-base font-semibold"
      >
        {title}
      </h2>
    </div>
    <p className="text-sm text-muted-foreground mb-4">{description}</p>
    {children}
  </section>
)

// ─── Licensing Section ────────────────────────────────────────────────────────

const LicensingSection = () => {
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
    <Section title="Licensing" description="Manage your aidrelay Pro license." icon={Key}>
      {status.valid && status.tier === 'pro' ? (
        <div className="space-y-3" data-testid="license-active">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
              Pro — Active
            </span>
            {status.expiresAt && (
              <span className="text-xs text-muted-foreground">
                Expires {new Date(status.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void deactivate()}
            className="text-sm text-destructive underline hover:no-underline"
            data-testid="btn-deactivate-license"
          >
            Deactivate license
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => void onActivate(e)}
          className="flex gap-2"
          data-testid="license-form"
        >
          <div className="flex-1">
            <input
              {...register('licenseKey')}
              type="text"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="License key"
              data-testid="input-license-key"
            />
            {errors.licenseKey && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {errors.licenseKey.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={activating}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-activate-license"
          >
            {activating ? 'Activating…' : 'Activate'}
          </button>
        </form>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Free tier includes up to 5 servers, 5 rules, and 3 profiles.{' '}
        <a
          href="https://aidrelay.dev/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline"
        >
          View Pro features
        </a>
      </p>
    </Section>
  )
}

// ─── Git Remote Section ───────────────────────────────────────────────────────

const GitRemoteSection = () => {
  const {
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
    toast.success('Git remote settings saved.')
  })

  return (
    <Section
      title="Git Sync"
      description="Configure the remote Git repository for cross-machine config sync."
      icon={Globe}
    >
      <form onSubmit={(e) => void onSave(e)} className="space-y-3" data-testid="git-remote-form">
        <div>
          <label htmlFor="remote-url" className="block text-sm font-medium mb-1">
            Remote URL
          </label>
          <input
            id="remote-url"
            {...register('remoteUrl')}
            type="url"
            placeholder="https://github.com/you/aidrelay-sync.git"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="input-remote-url"
          />
          {errors.remoteUrl && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {errors.remoteUrl.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Auth Method</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input {...register('authMethod')} type="radio" value="ssh" />
              SSH Key (recommended)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input {...register('authMethod')} type="radio" value="https-token" />
              HTTPS Token
            </label>
          </div>
        </div>

        {authMethod === 'https-token' && (
          <div>
            <label htmlFor="https-token" className="block text-sm font-medium mb-1">
              Personal Access Token
            </label>
            <input
              id="https-token"
              {...register('httpsToken')}
              type="password"
              placeholder="ghp_…"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-https-token"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!isDirty}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-save-git-remote"
          >
            <Save size={14} aria-hidden="true" />
            Save
          </button>
        </div>
      </form>
    </Section>
  )
}

// ─── General Section ──────────────────────────────────────────────────────────

const GeneralSection = () => {
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    void window.api.settingsGet('language').then((lang) => {
      if (typeof lang === 'string') setLanguage(lang)
    })
  }, [])

  const saveLanguage = useCallback(async (lang: string) => {
    setLanguage(lang)
    await window.api.settingsSet('language', lang)
    toast.success('Language preference saved. Restart to apply.')
  }, [])

  return (
    <Section
      title="General"
      description="Interface language and other general preferences."
      icon={Globe}
    >
      <div>
        <label htmlFor="language-select" className="block text-sm font-medium mb-1">
          Interface language
        </label>
        <select
          id="language-select"
          value={language}
          onChange={(e) => void saveLanguage(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="select-language"
        >
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
      </div>
    </Section>
  )
}

// ─── About Section ────────────────────────────────────────────────────────────

const AboutSection = () => {
  const [checking, setChecking] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloaded, setDownloaded] = useState(false)

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
    toast.info('Checking for updates…')
  }

  const handleInstall = async () => {
    await window.api.updaterInstall()
  }

  return (
    <Section title="About" description="Version information and update management." icon={Info}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">Version</span>
          <span className="font-mono font-medium">0.1.0</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">Platform</span>
          <span>Windows</span>
        </div>

        {updateAvailable && !downloaded && (
          <p className="text-amber-600 dark:text-amber-400">
            Update v{updateVersion} is downloading…
          </p>
        )}

        {downloaded && (
          <div className="flex items-center gap-3">
            <p className="text-green-600 dark:text-green-400">
              Update v{updateVersion} ready to install
            </p>
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              data-testid="btn-install-update"
            >
              <Download size={12} aria-hidden="true" />
              Restart &amp; Install
            </button>
          </div>
        )}

        {!updateAvailable && !downloaded && (
          <button
            type="button"
            onClick={() => void handleCheckUpdates()}
            disabled={checking}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            data-testid="btn-check-updates"
          >
            <RotateCcw size={14} aria-hidden="true" />
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
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
        <p className="text-sm text-muted-foreground mt-1">
          Configure aidrelay preferences and integrations.
        </p>
      </div>

      <GeneralSection />
      <LicensingSection />
      <GitRemoteSection />
      <AboutSection />
    </main>
  )
}

export { SettingsPage }
