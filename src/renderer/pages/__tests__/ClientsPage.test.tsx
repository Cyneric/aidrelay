import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { ClientsPage } from '../ClientsPage'
import type { ClientInstallResult, ClientStatus, SyncResult } from '@shared/types'
import type * as ClientsStoreModule from '@/stores/clients.store'

const detectAllMock = vi.fn<() => Promise<void>>()
const syncClientMock =
  vi.fn<(id: string, options?: { allowCreateConfigIfMissing?: boolean }) => Promise<SyncResult>>()
const validateConfigMock = vi.fn<() => Promise<{ valid: boolean; errors: string[] }>>()
const installClientMock = vi.fn<(id: string) => Promise<ClientInstallResult>>()
const showOpenDialogMock = vi.fn<() => Promise<{ canceled: boolean; filePaths: string[] }>>()
const setManualPathMock =
  vi.fn<(id: string, path: string) => Promise<{ valid: boolean; errors: string[] }>>()
const clearManualPathMock = vi.fn<(id: string) => Promise<void>>()

let clientsFixture: ClientStatus[] = []

const toastSuccessMock = vi.fn<(message?: unknown) => void>()
const toastWarningMock = vi.fn<(message?: unknown) => void>()
const toastErrorMock = vi.fn<(message?: unknown) => void>()

vi.mock('sonner', () => ({
  toast: {
    success: (message?: unknown) => toastSuccessMock(message),
    warning: (message?: unknown) => toastWarningMock(message),
    error: (message?: unknown) => toastErrorMock(message),
  },
}))

vi.mock('@/stores/clients.store', async (importOriginal) => {
  const actual: typeof ClientsStoreModule = await importOriginal()
  return {
    ...actual,
    useClientsStore: () => ({
      clients: clientsFixture,
      loading: false,
      error: null,
      detectAll: detectAllMock,
      syncClient: syncClientMock,
    }),
  }
})

describe('ClientsPage sync-all reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clientsFixture = [
      {
        id: 'cursor',
        displayName: 'Cursor',
        installed: true,
        configPaths: [],
        serverCount: 1,
        syncStatus: 'never-synced',
      },
      {
        id: 'vscode',
        displayName: 'VS Code',
        installed: true,
        configPaths: ['C:\\Users\\tester\\AppData\\Roaming\\Code\\User\\mcp.json'],
        serverCount: 1,
        syncStatus: 'never-synced',
      },
    ]
    detectAllMock.mockResolvedValue()
    syncClientMock.mockImplementation((clientId: string) => {
      if (clientId === 'cursor') {
        return Promise.resolve({
          clientId: 'cursor',
          success: true,
          serversWritten: 1,
          syncedAt: '2026-03-08T12:00:00.000Z',
        })
      }
      return Promise.reject(new Error('sync failed'))
    })
    installClientMock.mockResolvedValue({
      clientId: 'cursor',
      success: true,
      attempts: [],
      installedWith: 'winget',
      message: 'ok',
    })
    showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] })
    setManualPathMock.mockResolvedValue({ valid: true, errors: [] })
    clearManualPathMock.mockResolvedValue()

    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        clientsValidateConfig: validateConfigMock,
        clientsInstall: installClientMock,
        showOpenDialog: showOpenDialogMock,
        clientsSetManualConfigPath: setManualPathMock,
        clientsClearManualConfigPath: clearManualPathMock,
      },
      writable: true,
      configurable: true,
    })
    validateConfigMock.mockResolvedValue({ valid: true, errors: [] })
  })

  it('shows mixed-result summary when sync-all has failures', async () => {
    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-sync-all'))

    await waitFor(() => {
      expect(syncClientMock).toHaveBeenCalledTimes(2)
      expect(toastWarningMock).toHaveBeenCalled()
    })

    expect(toastWarningMock.mock.calls[0]?.[0]).toContain('Synced 1 of 2 clients (1 failed).')
    expect(toastSuccessMock).not.toHaveBeenCalledWith('All clients synced.')
  })

  it('renders only one folder icon for config paths in table rows', () => {
    renderWithProviders(<ClientsPage />)

    expect(screen.getByTestId('clients-config-path-vscode-0-reveal')).toBeInTheDocument()
    expect(screen.getByTestId('clients-config-path-vscode-0-edit')).toBeInTheDocument()
    expect(screen.getByTestId('btn-discover-vscode')).toBeInTheDocument()
  })

  it('shows missing-config indicator in config path cell and prompts from dedicated create-config action', async () => {
    syncClientMock.mockImplementation((_clientId, options) => {
      if (options?.allowCreateConfigIfMissing) {
        return Promise.resolve({
          clientId: 'cursor',
          success: true,
          serversWritten: 1,
          syncedAt: '2026-03-08T13:00:00.000Z',
        })
      }
      const error = new Error('needs config')
      ;(error as Error & { code?: string }).code = 'config_creation_required'
      return Promise.reject(error)
    })

    renderWithProviders(<ClientsPage />)

    const syncButton = screen.getByTestId('btn-sync-cursor')
    const createConfigButton = screen.getByTestId('btn-create-config-cursor')
    const validateButton = screen.getByTestId('btn-validate-cursor')
    expect(syncButton).toHaveAccessibleName('Write current profile config to Cursor')
    expect(syncButton).toBeDisabled()
    expect(createConfigButton).toHaveAccessibleName('Create configuration for Cursor')
    expect(validateButton).toBeDisabled()

    expect(screen.queryByTestId('client-missing-config-badge-cursor')).not.toBeInTheDocument()
    const missingConfigPath = screen.getByTestId('client-missing-config-path-cursor')
    expect(missingConfigPath).toBeInTheDocument()
    expect(missingConfigPath).toHaveTextContent('No configuration file yet')
    const cursorRow = screen.getByTestId('client-row-cursor')
    expect(cursorRow).toHaveTextContent('No configuration file yet')

    fireEvent.click(screen.getByTestId('btn-create-config-cursor'))

    expect(await screen.findByText('Create new configuration?')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('create-config-confirm'))

    await waitFor(() =>
      expect(syncClientMock).toHaveBeenCalledWith('cursor', {
        allowCreateConfigIfMissing: true,
      }),
    )
  })

  it('shows green check indicator when validation succeeds', async () => {
    validateConfigMock.mockResolvedValue({ valid: true, errors: [] })
    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-validate-vscode'))

    expect(await screen.findByTestId('validation-status-vscode-success')).toBeInTheDocument()
    expect(screen.queryByTestId('validation-status-vscode-failure')).not.toBeInTheDocument()
  })

  it('shows red cross indicator when validation returns schema issues', async () => {
    validateConfigMock.mockResolvedValue({ valid: false, errors: ['bad schema'] })
    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-validate-vscode'))

    expect(await screen.findByTestId('validation-status-vscode-failure')).toBeInTheDocument()
    expect(screen.queryByTestId('validation-status-vscode-success')).not.toBeInTheDocument()
  })

  it('shows red cross indicator when validation request throws', async () => {
    validateConfigMock.mockRejectedValue(new Error('IPC unavailable'))
    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-validate-vscode'))

    expect(await screen.findByTestId('validation-status-vscode-failure')).toBeInTheDocument()
    expect(screen.queryByTestId('validation-status-vscode-success')).not.toBeInTheDocument()
  })

  it('keeps validation indicator scoped to the validated row', async () => {
    validateConfigMock.mockResolvedValue({ valid: true, errors: [] })
    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-validate-vscode'))

    expect(await screen.findByTestId('validation-status-vscode-success')).toBeInTheDocument()
    expect(screen.queryByTestId('validation-status-cursor-success')).not.toBeInTheDocument()
    expect(screen.queryByTestId('validation-status-cursor-failure')).not.toBeInTheDocument()
  })

  it('replaces validation indicator when the same row is re-validated with a different result', async () => {
    validateConfigMock
      .mockResolvedValueOnce({ valid: true, errors: [] })
      .mockResolvedValueOnce({ valid: false, errors: ['now broken'] })
    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-validate-vscode'))
    expect(await screen.findByTestId('validation-status-vscode-success')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-validate-vscode'))
    expect(await screen.findByTestId('validation-status-vscode-failure')).toBeInTheDocument()
    expect(screen.queryByTestId('validation-status-vscode-success')).not.toBeInTheDocument()
  })

  it('runs install flow after confirmation and refreshes detection', async () => {
    clientsFixture = [
      {
        id: 'cursor',
        displayName: 'Cursor',
        installed: false,
        configPaths: [],
        serverCount: 0,
        syncStatus: 'never-synced',
      },
    ]
    installClientMock.mockResolvedValue({
      clientId: 'cursor',
      success: true,
      attempts: [],
      installedWith: 'winget',
      message: 'Installed via winget.',
    })

    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-install-cursor'))
    expect(await screen.findByText('Install client?')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-action-submit'))

    await waitFor(() => expect(installClientMock).toHaveBeenCalledWith('cursor'))
    await waitFor(() => expect(detectAllMock).toHaveBeenCalledTimes(2))
  })

  it('runs discover flow with file picker and saves manual path', async () => {
    showOpenDialogMock.mockResolvedValue({
      canceled: false,
      filePaths: ['C:\\custom\\cursor\\mcp.json'],
    })

    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-discover-cursor'))

    await waitFor(() =>
      expect(showOpenDialogMock).toHaveBeenCalledWith({
        properties: ['openFile'],
        title: 'Choose a config file for Cursor',
      }),
    )
    await waitFor(() =>
      expect(setManualPathMock).toHaveBeenCalledWith('cursor', 'C:\\custom\\cursor\\mcp.json'),
    )
    await waitFor(() => expect(detectAllMock).toHaveBeenCalledTimes(2))
  })

  it('clears discovered path override and refreshes detection', async () => {
    clientsFixture = [
      {
        id: 'cursor',
        displayName: 'Cursor',
        installed: true,
        configPaths: ['C:\\custom\\cursor\\mcp.json'],
        manualConfigPath: 'C:\\custom\\cursor\\mcp.json',
        serverCount: 1,
        syncStatus: 'never-synced',
      },
    ]

    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-clear-manual-path-cursor'))

    await waitFor(() => expect(clearManualPathMock).toHaveBeenCalledWith('cursor'))
    await waitFor(() => expect(detectAllMock).toHaveBeenCalledTimes(2))
  })
})
