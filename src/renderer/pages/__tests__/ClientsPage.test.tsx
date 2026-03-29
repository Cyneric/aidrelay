import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { ClientsPage } from '../ClientsPage'
import type {
  ClientInstallResult,
  ClientStatus,
  McpServer,
  SyncPlanResult,
  SyncPlanScope,
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
const syncPreviewOutgoingMock = vi.fn<(scope: SyncPlanScope) => Promise<SyncPlanResult>>()
const syncAllMock = vi.fn<() => Promise<SyncResult[]>>()
const showOpenDialogMock = vi.fn<() => Promise<{ canceled: boolean; filePaths: string[] }>>()
const setManualPathMock =
  vi.fn<(id: string, path: string) => Promise<{ valid: boolean; errors: string[] }>>()
const clearManualPathMock = vi.fn<(id: string) => Promise<void>>()
const serversListMock = vi.fn<() => Promise<McpServer[]>>()
const serversUpdateMock = vi.fn<(id: string, updates: unknown) => Promise<McpServer>>()
const onInstallProgressMock =
  vi.fn<(handler: (payload: ClientInstallProgressPayload) => void) => () => void>()
let installProgressHandler: ((payload: ClientInstallProgressPayload) => void) | null = null

let clientsFixture: ClientStatus[] = []
const makeMockServer = (overrides: Partial<McpServer> = {}): McpServer => ({
  id: 'server-1',
  name: 'filesystem',
  type: 'stdio',
  command: 'npx',
  args: [],
  env: {},
  secretEnvKeys: [],
  headers: {},
  secretHeaderKeys: [],
  enabled: true,
  clientOverrides: {} as McpServer['clientOverrides'],
  tags: [],
  notes: '',
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  recipeId: '',
  recipeVersion: '',
  setupStatus: 'ready',
  lastInstallResult: {},
  lastInstallTimestamp: '',
  installPolicy: 'manual',
  normalizedLaunchConfig: {},
  ...overrides,
})

const toastSuccessMock = vi.fn<(message?: unknown) => void>()
const toastWarningMock = vi.fn<(message?: unknown) => void>()
const toastErrorMock = vi.fn<(message?: unknown) => void>()

const makeSyncPlan = (
  scope: SyncPlanScope,
  overrides: Partial<SyncPlanResult> = {},
): SyncPlanResult => ({
  scope,
  generatedAt: '2026-03-29T12:00:00.000Z',
  entries: [
    {
      id: 'entry-1',
      path: 'C:\\Users\\tester\\.cursor\\mcp.json',
      feature: 'mcp-config',
      origin: 'client-sync',
      action: 'create',
      clientId: 'cursor',
      clientName: 'Cursor',
      detail: {
        kind: 'mcp',
        items: [
          {
            name: 'server-a',
            source: 'added',
            action: 'create',
            before: null,
            after: { command: 'npx', args: ['-y', '@scope/server-a'] },
          },
        ],
      },
    },
  ],
  blockers: [],
  totalFiles: 1,
  createCount: 1,
  modifyCount: 0,
  removeCount: 0,
  confirmable: true,
  ...overrides,
})

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

/**
 * Helper to open a RowActions dropdown for a given client and click a menu item.
 *
 * @param user - The userEvent instance.
 * @param clientId - The client identifier (e.g. "cursor", "vscode").
 * @param itemSlug - The slugified menu item label (e.g. "validate-config").
 */
const clickDropdownItem = async (
  user: ReturnType<typeof userEvent.setup>,
  clientId: string,
  itemSlug: string,
) => {
  const trigger = screen.getByTestId(`client-actions-${clientId}-menu-trigger`)
  await user.click(trigger)
  const item = await screen.findByTestId(`client-actions-${clientId}-item-${itemSlug}`)
  await user.click(item)
}

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
    serversListMock.mockResolvedValue([makeMockServer()])
    serversUpdateMock.mockImplementation((id, updates) => {
      const rawOverrides = (updates as { clientOverrides?: Record<string, { enabled: boolean }> })
        .clientOverrides
      return Promise.resolve(
        makeMockServer({
          id,
          clientOverrides:
            (rawOverrides as McpServer['clientOverrides'] | undefined) ??
            ({ cursor: { enabled: false } } as McpServer['clientOverrides']),
        }),
      )
    })

    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        clientsValidateConfig: validateConfigMock,
        clientsValidateAllConfigs: validateAllConfigsMock,
        clientsInstall: installClientMock,
        syncPreviewOutgoing: syncPreviewOutgoingMock,
        clientsSyncAll: syncAllMock,
        showOpenDialog: showOpenDialogMock,
        clientsSetManualConfigPath: setManualPathMock,
        clientsClearManualConfigPath: clearManualPathMock,
        serversList: serversListMock,
        serversUpdate: serversUpdateMock,
        onClientInstallProgress: onInstallProgressMock,
      },
      writable: true,
      configurable: true,
    })
    validateConfigMock.mockResolvedValue({ valid: true, errors: [] })
    validateAllConfigsMock.mockResolvedValue({})
    syncPreviewOutgoingMock.mockImplementation((scope) =>
      Promise.resolve(
        makeSyncPlan(scope, {
          entries: [
            {
              id: 'entry-1',
              path: 'C:\\Users\\tester\\.cursor\\mcp.json',
              feature: 'mcp-config',
              origin: 'client-sync',
              action: 'create',
              clientId: 'cursor',
              clientName: 'Cursor',
              detail: {
                kind: 'mcp',
                items: [
                  {
                    name: 'server-a',
                    source: 'added',
                    action: 'create',
                    before: null,
                    after: { command: 'npx', args: ['-y', '@scope/server-a'] },
                  },
                ],
              },
            },
          ],
        }),
      ),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens the sync-all preview dialog and runs sync after confirmation', async () => {
    syncPreviewOutgoingMock.mockResolvedValue(
      makeSyncPlan(
        {
          kind: 'actionable-clients',
          clientIds: ['cursor', 'vscode'],
          allowCreateConfigIfMissing: true,
        },
        {
          entries: [
            {
              id: 'entry-cursor',
              path: 'C:\\Users\\tester\\.cursor\\mcp.json',
              feature: 'mcp-config',
              origin: 'client-sync',
              action: 'create',
              clientId: 'cursor',
              clientName: 'Cursor',
              detail: {
                kind: 'mcp',
                items: [
                  {
                    name: 'server-a',
                    source: 'added',
                    action: 'create',
                    before: null,
                    after: { command: 'npx', args: ['-y', '@scope/server-a'] },
                  },
                ],
              },
            },
            {
              id: 'entry-vscode',
              path: 'C:\\Users\\tester\\AppData\\Roaming\\Code\\User\\mcp.json',
              feature: 'mcp-config',
              origin: 'client-sync',
              action: 'modify',
              clientId: 'vscode',
              clientName: 'VS Code',
              detail: {
                kind: 'mcp',
                items: [
                  {
                    name: 'server-b',
                    source: 'modified',
                    action: 'overwrite',
                    before: { command: 'old' },
                    after: { command: 'new' },
                  },
                ],
              },
            },
          ],
          totalFiles: 2,
          createCount: 1,
          modifyCount: 1,
        },
      ),
    )
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

    await waitFor(() =>
      expect(syncPreviewOutgoingMock).toHaveBeenCalledWith({
        kind: 'actionable-clients',
        clientIds: ['cursor', 'vscode'],
        allowCreateConfigIfMissing: true,
      }),
    )
    expect(screen.getByTestId('sync-center-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('sync-plan-view')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('sync-plan-confirm'))

    await waitFor(() => {
      expect(syncAllMock).toHaveBeenCalledTimes(1)
      expect(detectAllMock).toHaveBeenCalledTimes(2)
    })
  })

  it('renders only one folder icon for config paths in table rows', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    expect(screen.getByTestId('clients-config-path-vscode-0-reveal')).toBeInTheDocument()
    expect(screen.getByTestId('clients-config-path-vscode-0-edit')).toBeInTheDocument()

    // Discover is now in the dropdown menu
    const trigger = screen.getByTestId('client-actions-vscode-menu-trigger')
    await user.click(trigger)
    expect(
      await screen.findByTestId('client-actions-vscode-item-discover-config-path'),
    ).toBeInTheDocument()
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

    const syncButton = screen.getByTestId('client-actions-cursor-primary')
    const createConfigButton = screen.getByTestId('btn-create-config-cursor')
    expect(syncButton).toBeDisabled()
    expect(createConfigButton).toHaveAccessibleName('Create configuration for Cursor')

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
      expect(syncPreviewOutgoingMock).toHaveBeenCalledWith({
        kind: 'client',
        clientId: 'cursor',
        options: {
          allowCreateConfigIfMissing: true,
        },
      }),
    )
    expect(syncClientMock).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByTestId('sync-plan-confirm'))
    await waitFor(() =>
      expect(syncClientMock).toHaveBeenCalledWith('cursor', {
        allowCreateConfigIfMissing: true,
      }),
    )
  })

  it('shows sync plan blockers and disables confirmation when preview is blocked', async () => {
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

    syncPreviewOutgoingMock.mockResolvedValue(
      makeSyncPlan(
        {
          kind: 'client',
          clientId: 'cursor',
        },
        {
          entries: [],
          blockers: [
            {
              id: 'cursor-json-invalid',
              title: 'Invalid configuration file',
              description: 'The current config contains invalid JSON and cannot be merged safely.',
              clientId: 'cursor',
              clientName: 'Cursor',
              path: 'C:\\Users\\tester\\.cursor\\mcp.json',
            },
          ],
          totalFiles: 0,
          createCount: 0,
          modifyCount: 0,
          removeCount: 0,
          confirmable: false,
        },
      ),
    )

    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await user.click(screen.getByTestId('client-actions-cursor-primary'))

    expect(await screen.findByTestId('sync-center-dialog')).toBeInTheDocument()
    expect(await screen.findByTestId('sync-plan-blockers')).toBeInTheDocument()
    expect(screen.getByTestId('sync-plan-confirm')).toBeDisabled()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('shows green check indicator when validation succeeds', async () => {
    validateConfigMock.mockResolvedValue({ valid: true, errors: [] })
    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await clickDropdownItem(user, 'vscode', 'validate-config')

    expect(await screen.findByTestId('validation-status-vscode-success')).toBeInTheDocument()
    expect(screen.queryByTestId('validation-status-vscode-failure')).not.toBeInTheDocument()
  })

  it('shows red cross indicator when validation returns schema issues', async () => {
    validateConfigMock.mockResolvedValue({ valid: false, errors: ['bad schema'] })
    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await clickDropdownItem(user, 'vscode', 'validate-config')

    expect(await screen.findByTestId('validation-status-vscode-failure')).toBeInTheDocument()
    expect(screen.queryByTestId('validation-status-vscode-success')).not.toBeInTheDocument()
  })

  it('shows red cross indicator when validation request throws', async () => {
    validateConfigMock.mockRejectedValue(new Error('IPC unavailable'))
    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await clickDropdownItem(user, 'vscode', 'validate-config')

    expect(await screen.findByTestId('validation-status-vscode-failure')).toBeInTheDocument()
    expect(screen.queryByTestId('validation-status-vscode-success')).not.toBeInTheDocument()
  })

  it('keeps validation indicator scoped to the validated row', async () => {
    validateConfigMock.mockResolvedValue({ valid: true, errors: [] })
    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await clickDropdownItem(user, 'vscode', 'validate-config')

    expect(await screen.findByTestId('validation-status-vscode-success')).toBeInTheDocument()
    expect(screen.queryByTestId('validation-status-cursor-success')).not.toBeInTheDocument()
    expect(screen.queryByTestId('validation-status-cursor-failure')).not.toBeInTheDocument()
  })

  it('replaces validation indicator when the same row is re-validated with a different result', async () => {
    validateConfigMock
      .mockResolvedValueOnce({ valid: true, errors: [] })
      .mockResolvedValueOnce({ valid: false, errors: ['now broken'] })
    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await clickDropdownItem(user, 'vscode', 'validate-config')
    expect(await screen.findByTestId('validation-status-vscode-success')).toBeInTheDocument()

    await clickDropdownItem(user, 'vscode', 'validate-config')
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

    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await clickDropdownItem(user, 'cursor', 'install-client')
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

    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await clickDropdownItem(user, 'cursor', 'install-client')
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

    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await clickDropdownItem(user, 'cursor', 'install-client')
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

  it('opens manage sync items dialog and updates per-client ignore toggle', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await clickDropdownItem(user, 'cursor', 'manage-sync-items')

    expect(await screen.findByTestId('manage-sync-items-dialog')).toBeInTheDocument()
    await waitFor(() => expect(serversListMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByTestId('manage-sync-toggle-server-1'))

    await waitFor(() =>
      expect(serversUpdateMock).toHaveBeenCalledWith('server-1', {
        clientOverrides: { cursor: { enabled: false } },
      }),
    )
  })

  it('runs discover flow with file picker and saves manual path', async () => {
    showOpenDialogMock.mockResolvedValue({
      canceled: false,
      filePaths: ['C:\\custom\\cursor\\mcp.json'],
    })

    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    await clickDropdownItem(user, 'cursor', 'discover-config-path')

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
