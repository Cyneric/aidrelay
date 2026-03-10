/**
 * @file src/renderer/pages/__tests__/SettingsPage.test.tsx
 *
 * @description Renderer tests for Settings page danger-zone reset flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { renderWithProviders } from '@/test-utils'
import { SettingsPage } from '../SettingsPage'

const settingsGetMock = vi.fn<(key: string) => Promise<unknown>>()
const settingsSetMock = vi.fn<(key: string, value: unknown) => Promise<void>>()
const gitSyncStatusMock = vi.fn<() => Promise<{ connected: boolean }>>()
const gitSyncConnectManualMock = vi.fn<(input: unknown) => Promise<{ connected: boolean }>>()
const gitSyncTestRemoteMock = vi.fn<() => Promise<{ success: boolean; error?: string }>>()
const gitSyncPullMock = vi.fn<
  () => Promise<{
    success: boolean
    serversImported: number
    rulesImported: number
    profilesImported: number
    installIntentsImported: number
    skillsImported: number
    userSkillsImported: number
    projectSkillsImported: number
    conflicts: number
    skillConflicts: number
    skillMappingsRequired: number
    skillConflictItems: []
    projectSkillMappings: []
    error?: string
  }>
>()
const appOssAttributionsMock = vi.fn<
  () => Promise<
    Array<{
      packageName: string
      version: string
      license: string
      repositoryUrl: string
      licenseFile: string
      licenseText: string
    }>
  >
>()
const settingsResetMock =
  vi.fn<
    (input: {
      scope: 'partial' | 'factory'
      uiPreferences: boolean
      gitRemoteForm: boolean
      gitSyncConnection: boolean
    }) => Promise<unknown>
  >()

const toastSuccessMock = vi.fn<(message?: unknown, ...rest: unknown[]) => void>()
const toastErrorMock = vi.fn<(message?: unknown, ...rest: unknown[]) => void>()
const toastInfoMock = vi.fn<(message?: unknown, ...rest: unknown[]) => void>()

vi.mock('sonner', () => ({
  toast: {
    success: (...args: Parameters<typeof toastSuccessMock>) => {
      toastSuccessMock(...args)
    },
    error: (...args: Parameters<typeof toastErrorMock>) => {
      toastErrorMock(...args)
    },
    info: (...args: Parameters<typeof toastInfoMock>) => {
      toastInfoMock(...args)
    },
  },
}))

vi.mock('@/lib/useTheme', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: vi.fn(),
    effectiveTheme: 'light',
  }),
}))

vi.mock('@/lib/useLicense', () => ({
  useLicense: () => ({
    status: { tier: 'free', valid: false, lastValidatedAt: new Date().toISOString() },
    activating: false,
    activate: vi.fn(),
    deactivate: vi.fn(),
  }),
}))

beforeEach(async () => {
  vi.clearAllMocks()
  localStorage.removeItem('language')
  await i18n.changeLanguage('en')

  settingsGetMock.mockResolvedValue(undefined)
  settingsSetMock.mockResolvedValue()
  gitSyncStatusMock.mockResolvedValue({ connected: false })
  gitSyncConnectManualMock.mockResolvedValue({ connected: true })
  gitSyncTestRemoteMock.mockResolvedValue({ success: true })
  gitSyncPullMock.mockResolvedValue({
    success: true,
    serversImported: 0,
    rulesImported: 0,
    profilesImported: 0,
    installIntentsImported: 0,
    skillsImported: 0,
    userSkillsImported: 0,
    projectSkillsImported: 0,
    conflicts: 0,
    skillConflicts: 0,
    skillMappingsRequired: 0,
    skillConflictItems: [],
    projectSkillMappings: [],
  })
  appOssAttributionsMock.mockResolvedValue([
    {
      packageName: 'react',
      version: '19.1.0',
      license: 'MIT',
      repositoryUrl: 'https://github.com/facebook/react',
      licenseFile: 'node_modules/react/LICENSE',
      licenseText: 'Permission is hereby granted...',
    },
    {
      packageName: 'zod',
      version: '4.3.6',
      license: 'MIT',
      repositoryUrl: 'https://github.com/colinhacks/zod',
      licenseFile: 'node_modules/zod/LICENSE',
      licenseText: 'THE SOFTWARE IS PROVIDED "AS IS"...',
    },
  ])
  settingsResetMock.mockResolvedValue({
    resetKeys: ['theme', 'language'],
    disconnectedGitSync: false,
    clearedAllSecrets: false,
    clearedLicenseCache: false,
    databaseReset: false,
    deletedPaths: [],
    restartTriggered: false,
  })

  Object.defineProperty(window, 'api', {
    value: {
      settingsGet: settingsGetMock,
      settingsSet: settingsSetMock,
      settingsReset: settingsResetMock,
      gitSyncStatus: gitSyncStatusMock,
      gitSyncConnectManual: gitSyncConnectManualMock,
      gitSyncTestRemote: gitSyncTestRemoteMock,
      gitSyncPull: gitSyncPullMock,
      appVersion: () => Promise.resolve('1.0.0'),
      appOssAttributions: appOssAttributionsMock,
      updaterCheck: () => Promise.resolve(),
      updaterInstall: () => Promise.resolve(),
      onUpdateAvailable: () => () => {},
      onUpdateDownloaded: () => () => {},
    },
    writable: true,
    configurable: true,
  })
})

describe('SettingsPage language preference', () => {
  it('reflects active i18n language in the selector when no saved language exists', async () => {
    await i18n.changeLanguage('de')

    renderWithProviders(<SettingsPage />)

    await screen.findByRole('heading', { level: 1, name: 'Einstellungen' })
    expect(screen.getByTestId('select-language')).toHaveTextContent('Deutsch')
  })

  it('switches language immediately and persists the new setting', async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage('de')

    renderWithProviders(<SettingsPage />)
    await screen.findByRole('heading', { level: 1, name: 'Einstellungen' })

    await user.click(screen.getByTestId('select-language'))
    await user.click(await screen.findByRole('option', { name: 'English' }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument(),
    )
    expect(settingsSetMock).toHaveBeenCalledWith('language', 'en')
    expect(localStorage.getItem('language')).toBe('en')
  })

  it('applies saved language from settings on mount', async () => {
    await i18n.changeLanguage('de')
    settingsGetMock.mockImplementation((key: string) =>
      Promise.resolve(key === 'language' ? 'en' : undefined),
    )

    renderWithProviders(<SettingsPage />)

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument(),
    )
    expect(screen.getByTestId('select-language')).toHaveTextContent('English')
  })
})

describe('SettingsPage OSS attributions', () => {
  it('opens OSS modal and renders attribution entries with license text', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.click(screen.getByTestId('btn-open-oss-attributions'))

    await screen.findByTestId('oss-attributions-list')
    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('zod')).toBeInTheDocument()
    expect(screen.getAllByTestId('oss-attribution-license-text').length).toBeGreaterThan(0)
  })

  it('filters OSS list by search query', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.click(screen.getByTestId('btn-open-oss-attributions'))
    await screen.findByTestId('oss-attributions-list')

    await user.type(screen.getByTestId('input-oss-search'), 'zod')

    expect(screen.getByText('zod')).toBeInTheDocument()
    expect(screen.queryByText('react')).not.toBeInTheDocument()
  })

  it('shows error state when OSS attribution loading fails', async () => {
    appOssAttributionsMock.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.click(screen.getByTestId('btn-open-oss-attributions'))

    await screen.findByTestId('oss-attributions-error')
    expect(screen.getByText('Failed to load open source attributions.')).toBeInTheDocument()
  })

  it('shows loading state while OSS attributions are being fetched', async () => {
    let resolveFetch:
      | ((
          value: Array<{
            packageName: string
            version: string
            license: string
            repositoryUrl: string
            licenseFile: string
            licenseText: string
          }>,
        ) => void)
      | undefined
    const pendingPromise = new Promise<
      Array<{
        packageName: string
        version: string
        license: string
        repositoryUrl: string
        licenseFile: string
        licenseText: string
      }>
    >((resolve) => {
      resolveFetch = resolve
    })
    appOssAttributionsMock.mockImplementation(() => pendingPromise)

    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.click(screen.getByTestId('btn-open-oss-attributions'))
    await screen.findByTestId('oss-attributions-loading')

    resolveFetch?.([])
    await screen.findByTestId('oss-attributions-empty')
  })
})

describe('SettingsPage danger zone', () => {
  it('renders reset button in danger zone', async () => {
    renderWithProviders(<SettingsPage />)
    await screen.findByText('1.0.0')
    expect(screen.getByTestId('settings-danger-zone')).toBeInTheDocument()
    expect(screen.getByTestId('btn-open-reset-settings')).toBeInTheDocument()
  })

  it('opens dialog with expected default checkbox selections', async () => {
    renderWithProviders(<SettingsPage />)
    fireEvent.click(screen.getByTestId('btn-open-reset-settings'))

    await screen.findByTestId('reset-options')

    expect(screen.getByTestId('reset-option-ui-preferences')).toHaveAttribute(
      'data-state',
      'checked',
    )
    expect(screen.getByTestId('reset-option-git-remote')).toHaveAttribute('data-state', 'checked')
    expect(screen.getByTestId('reset-option-git-sync')).toHaveAttribute('data-state', 'unchecked')
    expect(screen.getByTestId('btn-open-factory-reset').className).toContain('whitespace-normal')
    expect(screen.getByTestId('btn-confirm-reset-settings').className).toContain(
      'whitespace-normal',
    )
  })

  it('submits selected reset payload and shows success toast', async () => {
    renderWithProviders(<SettingsPage />)
    fireEvent.click(screen.getByTestId('btn-open-reset-settings'))
    await screen.findByTestId('reset-options')

    fireEvent.click(screen.getByTestId('btn-confirm-reset-settings'))

    await waitFor(() =>
      expect(settingsResetMock).toHaveBeenCalledWith({
        scope: 'partial',
        uiPreferences: true,
        gitRemoteForm: true,
        gitSyncConnection: false,
      }),
    )
    expect(toastSuccessMock).toHaveBeenCalled()
  })

  it('opens factory reset confirm and submits factory scope', async () => {
    renderWithProviders(<SettingsPage />)
    fireEvent.click(screen.getByTestId('btn-open-reset-settings'))
    await screen.findByTestId('reset-options')

    fireEvent.click(screen.getByTestId('btn-open-factory-reset'))
    await screen.findByTestId('factory-reset-warning')
    expect(screen.getByTestId('btn-confirm-factory-reset').className).toContain('whitespace-normal')
    fireEvent.click(screen.getByTestId('btn-confirm-factory-reset'))

    await waitFor(() =>
      expect(settingsResetMock).toHaveBeenCalledWith({
        scope: 'factory',
        uiPreferences: false,
        gitRemoteForm: false,
        gitSyncConnection: false,
      }),
    )
    expect(toastInfoMock).toHaveBeenCalled()
  })

  it('shows error toast when reset fails', async () => {
    settingsResetMock.mockRejectedValueOnce(new Error('boom'))

    renderWithProviders(<SettingsPage />)
    fireEvent.click(screen.getByTestId('btn-open-reset-settings'))
    await screen.findByTestId('reset-options')

    fireEvent.click(screen.getByTestId('btn-confirm-reset-settings'))

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled())
  })
})

describe('SettingsPage git sync guide', () => {
  it('opens the git sync setup guide modal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.click(screen.getByTestId('btn-open-git-sync-guide'))

    expect(await screen.findByTestId('git-sync-guide-dialog')).toBeInTheDocument()
    expect(screen.getByText('How to set up Git Sync')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'GitHub personal access token documentation' }),
    ).toBeInTheDocument()
  })
})

describe('SettingsPage git remote URL handling', () => {
  it('normalizes SSH scp-style URLs on save and runs connect + pull', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    const remoteInput = screen.getByTestId('input-remote-url')
    await user.clear(remoteInput)
    await user.type(remoteInput, '  git@github.com:owner/repo.git  ')
    await user.click(screen.getByTestId('btn-save-git-remote'))

    await waitFor(() =>
      expect(settingsSetMock).toHaveBeenCalledWith('git-remote', {
        remoteUrl: 'ssh://git@github.com/owner/repo.git',
        authMethod: 'ssh',
      }),
    )
    expect(gitSyncConnectManualMock).toHaveBeenCalledWith({
      remoteUrl: 'ssh://git@github.com/owner/repo.git',
      authMethod: 'ssh',
    })
    expect(gitSyncPullMock).toHaveBeenCalled()
    const normalizedInput = screen.getByTestId('input-remote-url')
    expect(normalizedInput).toHaveValue('ssh://git@github.com/owner/repo.git')
    expect(await screen.findByText('Connected and synced.')).toBeInTheDocument()
  })

  it('shows a specific validation error for malformed SSH scp-style input', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.type(screen.getByTestId('input-remote-url'), 'github.com:owner/repo.git')
    await user.click(screen.getByTestId('btn-save-git-remote'))

    expect(
      await screen.findByText(
        'SSH scp-style URL must include the git user, for example git@github.com:owner/repo.git.',
      ),
    ).toBeInTheDocument()
    expect(settingsSetMock).not.toHaveBeenCalled()
    expect(gitSyncConnectManualMock).not.toHaveBeenCalled()
  })

  it('requires token input when HTTPS token auth is selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.click(screen.getByText('HTTPS Token'))
    await user.type(screen.getByTestId('input-remote-url'), 'https://github.com/owner/repo.git')
    await user.click(screen.getByTestId('btn-save-git-remote'))

    expect(
      await screen.findByText('Enter a personal access token to continue.'),
    ).toBeInTheDocument()
    expect(settingsSetMock).not.toHaveBeenCalled()
  })

  it('blocks SSH URL when HTTPS token auth is selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.click(screen.getByText('HTTPS Token'))
    await user.type(screen.getByTestId('input-remote-url'), 'git@github.com:owner/repo.git')
    await user.click(screen.getByTestId('btn-save-git-remote'))

    expect(
      await screen.findByText('Remote URL must use https:// when HTTPS Token auth is selected.'),
    ).toBeInTheDocument()
    expect(settingsSetMock).not.toHaveBeenCalled()
  })

  it('blocks HTTPS URL when SSH auth is selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.type(screen.getByTestId('input-remote-url'), 'https://github.com/owner/repo.git')
    await user.click(screen.getByTestId('btn-save-git-remote'))

    expect(
      await screen.findByText('Remote URL must use SSH format when SSH Key auth is selected.'),
    ).toBeInTheDocument()
    expect(settingsSetMock).not.toHaveBeenCalled()
  })

  it('keeps canonical SSH URLs unchanged when valid', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.type(screen.getByTestId('input-remote-url'), 'ssh://git@github.com/owner/repo.git')
    await user.click(screen.getByTestId('btn-save-git-remote'))

    await waitFor(() =>
      expect(settingsSetMock).toHaveBeenCalledWith('git-remote', {
        remoteUrl: 'ssh://git@github.com/owner/repo.git',
        authMethod: 'ssh',
      }),
    )
    expect(gitSyncConnectManualMock).toHaveBeenCalledWith({
      remoteUrl: 'ssh://git@github.com/owner/repo.git',
      authMethod: 'ssh',
    })
  })

  it('keeps HTTPS URLs unchanged when HTTPS token auth is selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.click(screen.getByText('HTTPS Token'))
    await user.type(screen.getByTestId('input-remote-url'), 'https://github.com/owner/repo.git')
    await user.type(screen.getByTestId('input-https-token'), 'ghp_secret')
    await user.click(screen.getByTestId('btn-save-git-remote'))

    await waitFor(() =>
      expect(settingsSetMock).toHaveBeenCalledWith('git-remote', {
        remoteUrl: 'https://github.com/owner/repo.git',
        authMethod: 'https-token',
        httpsToken: 'ghp_secret',
      }),
    )
    expect(gitSyncConnectManualMock).toHaveBeenCalledWith({
      remoteUrl: 'https://github.com/owner/repo.git',
      authMethod: 'https-token',
      authToken: 'ghp_secret',
    })
  })

  it('keeps saved settings and allows retry when connection fails', async () => {
    const user = userEvent.setup()
    gitSyncConnectManualMock
      .mockRejectedValueOnce(new Error('Host key verification failed'))
      .mockResolvedValueOnce({ connected: true })

    renderWithProviders(<SettingsPage />)

    await user.type(screen.getByTestId('input-remote-url'), 'git@github.com:owner/repo.git')
    await user.click(screen.getByTestId('btn-save-git-remote'))

    await waitFor(() => expect(settingsSetMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Connection or sync failed.')).toBeInTheDocument()
    expect(await screen.findByText('Host key verification failed')).toBeInTheDocument()
    expect(gitSyncPullMock).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('btn-retry-git-sync'))

    await waitFor(() => expect(gitSyncConnectManualMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(gitSyncPullMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Connected and synced.')).toBeInTheDocument()
  })

  it('runs a read-only SSH test without saving or syncing', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await user.type(screen.getByTestId('input-remote-url'), 'git@github.com:owner/repo.git')
    await user.click(screen.getByTestId('btn-test-git-ssh'))

    await waitFor(() =>
      expect(gitSyncTestRemoteMock).toHaveBeenCalledWith({
        remoteUrl: 'ssh://git@github.com/owner/repo.git',
        authMethod: 'ssh',
      }),
    )
    expect(settingsSetMock).not.toHaveBeenCalled()
    expect(gitSyncConnectManualMock).not.toHaveBeenCalled()
    expect(gitSyncPullMock).not.toHaveBeenCalled()
    expect(await screen.findByText('SSH access verified.')).toBeInTheDocument()
  })

  it('shows actionable publickey guidance and guide link when SSH test fails', async () => {
    const user = userEvent.setup()
    gitSyncTestRemoteMock.mockResolvedValueOnce({
      success: false,
      error:
        'SSH authentication failed (publickey). Ensure your SSH key is loaded in your SSH agent.',
    })

    renderWithProviders(<SettingsPage />)

    await user.type(screen.getByTestId('input-remote-url'), 'git@github.com:owner/repo.git')
    await user.click(screen.getByTestId('btn-test-git-ssh'))

    expect(await screen.findByText('SSH test failed.')).toBeInTheDocument()
    expect(await screen.findByTestId('git-sync-status-error')).toHaveTextContent('publickey')
    expect(await screen.findByTestId('git-sync-publickey-help')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open setup guide' }))
    expect(await screen.findByTestId('git-sync-guide-dialog')).toBeInTheDocument()
  })
})
