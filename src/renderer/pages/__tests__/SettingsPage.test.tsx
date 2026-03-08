/**
 * @file src/renderer/pages/__tests__/SettingsPage.test.tsx
 *
 * @description Renderer tests for Settings page danger-zone reset flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { SettingsPage } from '../SettingsPage'

const settingsGetMock = vi.fn<(key: string) => Promise<unknown>>()
const settingsSetMock = vi.fn<(key: string, value: unknown) => Promise<void>>()
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

beforeEach(() => {
  vi.clearAllMocks()

  settingsGetMock.mockResolvedValue(undefined)
  settingsSetMock.mockResolvedValue()
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
      appVersion: () => Promise.resolve('1.0.0'),
      updaterCheck: () => Promise.resolve(),
      updaterInstall: () => Promise.resolve(),
      onUpdateAvailable: () => () => {},
      onUpdateDownloaded: () => () => {},
    },
    writable: true,
    configurable: true,
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
