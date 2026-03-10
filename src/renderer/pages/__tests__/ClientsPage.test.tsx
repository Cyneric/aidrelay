import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { ClientsPage } from '../ClientsPage'
import type {
  ClientInstallResult,
  ClientStatus,
  SyncAllPreviewResult,
  SyncResult,
} from '@shared/types'
import type { ClientInstallProgressPayload } from '@shared/channels'
import type * as ClientsStoreModule from '@/stores/clients.store'

const detectAllMock = vi.fn<() => Promise<void>>()
const syncClientMock =
  vi.fn<(id: string, options?: { allowCreateConfigIfMissing?: boolean }) => Promise<SyncResult>>()
const validateConfigMock = vi.fn<() => Promise<{ valid: boolean; errors: string[] }>>()
const validateAllConfigsMock =
  vi.fn<() => Promise<Record<string, { valid: boolean; errors: string[]; validatedAt: string }>>>()
const installClientMock = vi.fn<(id: string) => Promise<ClientInstallResult>>()
const previewSyncAllMock = vi.fn<() => Promise<SyncAllPreviewResult>>()
const syncAllMock = vi.fn<() => Promise<SyncResult[]>>()
const showOpenDialogMock = vi.fn<() => Promise<{ canceled: boolean; filePaths: string[] }>>()
const setManualPathMock =
  vi.fn<(id: string, path: string) => Promise<{ valid: boolean; errors: string[] }>>()
const clearManualPathMock = vi.fn<(id: string) => Promise<void>>()
const onInstallProgressMock =
  vi.fn<(handler: (payload: ClientInstallProgressPayload) => void) => () => void>()
let installProgressHandler: ((payload: ClientInstallProgressPayload) => void) | null = null

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
  const windowOpenMock =
    vi.fn<(url?: string | URL, target?: string, features?: string) => Window | null>()

  beforeEach(() => {
    vi.clearAllMocks()
    windowOpenMock.mockReset()
    windowOpenMock.mockReturnValue(null)
    vi.spyOn(window, 'open').mockImplementation(windowOpenMock)

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
    onInstallProgressMock.mockImplementation((handler) => {
      installProgressHandler = handler
      return () => {
        if (installProgressHandler === handler) installProgressHandler = null
      }
    })
    showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] })
    setManualPathMock.mockResolvedValue({ valid: true, errors: [] })
    clearManualPathMock.mockResolvedValue()

    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        clientsValidateConfig: validateConfigMock,
        clientsValidateAllConfigs: validateAllConfigsMock,
        clientsInstall: installClientMock,
        clientsPreviewSyncAll: previewSyncAllMock,
        clientsSyncAll: syncAllMock,
        showOpenDialog: showOpenDialogMock,
        clientsSetManualConfigPath: setManualPathMock,
        clientsClearManualConfigPath: clearManualPathMock,
        onClientInstallProgress: onInstallProgressMock,
      },
      writable: true,
      configurable: true,
    })
    validateConfigMock.mockResolvedValue({ valid: true, errors: [] })
    validateAllConfigsMock.mockResolvedValue({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens the sync-all preview dialog and runs sync after confirmation', async () => {
    previewSyncAllMock.mockResolvedValue({
      previews: {
        cursor: {
          clientId: 'cursor',
          configPath: 'C:\\Users\\tester\\.cursor\\mcp.json',
          items: [
            {
              name: 'server-a',
              source: 'added',
              action: 'create',
              before: null,
              after: null,
            },
          ],
        },
        vscode: {
          clientId: 'vscode',
          configPath: 'C:\\Users\\tester\\AppData\\Roaming\\Code\\User\\mcp.json',
          items: [
            {
              name: 'server-b',
              source: 'modified',
              action: 'overwrite',
              before: null,
              after: null,
            },
          ],
        },
      },
    })
    syncAllMock.mockResolvedValue([
      {
        clientId: 'cursor',
        success: true,
        serversWritten: 1,
        syncedAt: '2026-03-08T12:00:00.000Z',
      },
      {
        clientId: 'vscode',
        success: false,
        serversWritten: 0,
        syncedAt: '2026-03-08T12:00:00.000Z',
      },
    ])

    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-sync-all'))

    await waitFor(() => {
      expect(previewSyncAllMock).toHaveBeenCalled()
      expect(screen.getByTestId('sync-all-diff-dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByTestId('sync-all-diff-dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sync all' }))

    await waitFor(() => {
      expect(syncAllMock).toHaveBeenCalledTimes(1)
      expect(detectAllMock).toHaveBeenCalledTimes(2)
    })
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

  it('shows create-config dialog when preview sync rejects with errorCode', async () => {
    clientsFixture = [
      {
        id: 'cursor',
        displayName: 'Cursor',
        installed: true,
        configPaths: ['C:\\Users\\tester\\.cursor\\mcp.json'],
        serverCount: 1,
        syncStatus: 'out-of-sync',
      },
    ]

    const previewError = Object.assign(new Error('needs config'), {
      errorCode: 'config_creation_required' as const,
    })

    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        clientsPreviewSync: vi.fn().mockRejectedValue(previewError),
      },
      writable: true,
      configurable: true,
    })

    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-sync-cursor'))

    expect(await screen.findByText('Create new configuration?')).toBeInTheDocument()
    expect(toastErrorMock).not.toHaveBeenCalledWith('needs config')
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

  it('shows persisted validation indicators on initial render', async () => {
    clientsFixture = [
      {
        id: 'cursor',
        displayName: 'Cursor',
        installed: true,
        configPaths: ['C:\\Users\\tester\\.cursor\\mcp.json'],
        serverCount: 1,
        syncStatus: 'never-synced',
        lastValidation: {
          valid: false,
          errors: ['bad schema'],
          validatedAt: '2026-03-09T12:00:00.000Z',
        },
      },
      {
        id: 'vscode',
        displayName: 'VS Code',
        installed: true,
        configPaths: ['C:\\Users\\tester\\AppData\\Roaming\\Code\\User\\mcp.json'],
        serverCount: 1,
        syncStatus: 'never-synced',
        lastValidation: {
          valid: true,
          errors: [],
          validatedAt: '2026-03-09T12:30:00.000Z',
        },
      },
    ]

    renderWithProviders(<ClientsPage />)

    expect(await screen.findByTestId('validation-status-vscode-success')).toBeInTheDocument()
    expect(await screen.findByTestId('validation-status-cursor-failure')).toBeInTheDocument()
  })

  it('runs validate-all and shows summary toast', async () => {
    validateAllConfigsMock.mockResolvedValue({
      cursor: { valid: false, errors: ['bad schema'], validatedAt: '2026-03-09T12:00:00.000Z' },
      vscode: { valid: true, errors: [], validatedAt: '2026-03-09T12:30:00.000Z' },
    })

    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-validate-all'))

    await waitFor(() => expect(validateAllConfigsMock).toHaveBeenCalledTimes(1))
    expect(toastWarningMock).toHaveBeenCalledWith('Validated 1 of 2 clients (1 failed).')
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
    fireEvent.click(screen.getByTestId('install-dialog-confirm'))

    await waitFor(() => expect(installClientMock).toHaveBeenCalledWith('cursor'))
    expect(await screen.findByTestId('install-dialog-done')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('install-dialog-done'))
    await waitFor(() =>
      expect(screen.queryByTestId('install-client-dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(detectAllMock).toHaveBeenCalledTimes(2))
  })

  it('opens official provider download when selected and skips automatic install', async () => {
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

    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-install-cursor'))
    expect(await screen.findByText('Install client?')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('install-dialog-official'))

    expect(windowOpenMock).toHaveBeenCalledWith(
      'https://www.cursor.com/downloads',
      '_blank',
      'noopener,noreferrer',
    )
    expect(installClientMock).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByTestId('install-client-dialog')).not.toBeInTheDocument(),
    )
  })

  it('shows install progress step text and timeline updates while running', async () => {
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

    let resolveInstall: ((value: ClientInstallResult) => void) | null = null
    installClientMock.mockImplementation(
      () =>
        new Promise<ClientInstallResult>((resolve) => {
          resolveInstall = resolve
        }),
    )

    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-install-cursor'))
    fireEvent.click(await screen.findByTestId('install-dialog-confirm'))

    expect(await screen.findByTestId('install-progress-panel')).toBeInTheDocument()
    expect(screen.getByTestId('install-dialog-running')).toBeInTheDocument()

    act(() => {
      installProgressHandler?.({
        clientId: 'cursor',
        phase: 'manager_running',
        progress: 30,
        attemptIndex: 1,
        attemptCount: 2,
        manager: 'winget',
      })
    })
    expect(await screen.findByText('Running winget install command (1/2)')).toBeInTheDocument()
    expect(screen.getByTestId('install-progress-attempt-1')).toHaveTextContent('Running')

    act(() => {
      installProgressHandler?.({
        clientId: 'cursor',
        phase: 'manager_failed',
        progress: 50,
        attemptIndex: 1,
        attemptCount: 2,
        manager: 'winget',
      })
      installProgressHandler?.({
        clientId: 'cursor',
        phase: 'manager_running',
        progress: 70,
        attemptIndex: 2,
        attemptCount: 2,
        manager: 'choco',
      })
    })
    expect(screen.getByTestId('install-progress-attempt-1')).toHaveTextContent('Failed')
    expect(screen.getByTestId('install-progress-attempt-2')).toHaveTextContent('Running')

    act(() => {
      resolveInstall?.({
        clientId: 'cursor',
        success: true,
        attempts: [],
        installedWith: 'choco',
        message: 'Installed via choco.',
      })
    })

    expect(await screen.findByTestId('install-dialog-done')).toBeInTheDocument()
    expect(screen.getByTestId('install-client-dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('install-dialog-done'))
    await waitFor(() =>
      expect(screen.queryByTestId('install-client-dialog')).not.toBeInTheDocument(),
    )
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
