import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { DashboardPage } from '../DashboardPage'
import type * as ClientsStoreModule from '@/stores/clients.store'
import type * as ServersStoreModule from '@/stores/servers.store'
import type { ClientStatus, McpServer, SyncPlanResult, SyncPlanScope } from '@shared/types'

const detectAllMock = vi.fn<() => Promise<void>>()
const loadServersMock = vi.fn<() => Promise<void>>()
const clientsReadConfigMock = vi.fn()
const syncClientMock =
  vi.fn<(id: string, options?: { allowCreateConfigIfMissing?: boolean }) => Promise<unknown>>()
const syncPreviewOutgoingMock = vi.fn<(scope: SyncPlanScope) => Promise<SyncPlanResult>>()
const clientsSyncMock = vi.fn()
const previewConfigImportMock = vi.fn()
const importConfigChangesMock = vi.fn()

const toastErrorMock = vi.fn<(message?: unknown) => void>()
const toastInfoMock = vi.fn<(message?: unknown, options?: unknown) => void>()
const toastSuccessMock = vi.fn<(message?: unknown) => void>()

let mockClients: ClientStatus[] = []
let mockServers: McpServer[] = []

const makeSyncPlan = (
  scope: SyncPlanScope,
  overrides: Partial<SyncPlanResult> = {},
): SyncPlanResult => ({
  scope,
  generatedAt: '2026-03-29T12:00:00.000Z',
  entries: [
    {
      id: 'entry-1',
      path: 'C:\\Users\\tester\\.codex\\mcp.json',
      feature: 'mcp-config',
      origin: 'client-sync',
      action: 'modify',
      clientId: 'codex-cli',
      clientName: 'Codex CLI',
      detail: {
        kind: 'mcp',
        items: [
          {
            name: 'filesystem',
            source: 'modified',
            action: 'overwrite',
            before: { command: 'old' },
            after: { command: 'new' },
          },
        ],
      },
    },
  ],
  blockers: [],
  totalFiles: 1,
  createCount: 0,
  modifyCount: 1,
  removeCount: 0,
  confirmable: true,
  ...overrides,
})

vi.mock('sonner', () => ({
  toast: {
    error: (message?: unknown) => toastErrorMock(message),
    info: (message?: unknown, options?: unknown) => toastInfoMock(message, options),
    success: (message?: unknown) => toastSuccessMock(message),
  },
}))

vi.mock('@/stores/clients.store', async (importOriginal) => {
  const actual: typeof ClientsStoreModule = await importOriginal()
  return {
    ...actual,
    useClientsStore: () => ({
      clients: mockClients,
      loading: false,
      error: null,
      detectAll: detectAllMock,
      syncClient: syncClientMock,
    }),
  }
})

vi.mock('@/stores/servers.store', async (importOriginal) => {
  const actual: typeof ServersStoreModule = await importOriginal()
  return {
    ...actual,
    useServersStore: () => ({
      servers: mockServers,
      loading: false,
      error: null,
      load: loadServersMock,
    }),
  }
})

vi.mock('@/components/sync/SyncStatusWidget', () => ({
  SyncStatusWidget: () => <div data-testid="sync-status-widget" />,
}))

const createServer = (id: string, name: string): McpServer => ({
  id,
  name,
  type: 'stdio',
  command: 'npx',
  args: [],
  env: {},
  secretEnvKeys: [],
  headers: {},
  secretHeaderKeys: [],
  enabled: true,
  clientOverrides: {
    'claude-desktop': { enabled: true },
    'claude-code': { enabled: true },
    cline: { enabled: true },
    'roo-code': { enabled: true },
    cursor: { enabled: true },
    'gemini-cli': { enabled: true },
    'kilo-cli': { enabled: true },
    vscode: { enabled: true },
    'vscode-insiders': { enabled: true },
    windsurf: { enabled: true },
    zed: { enabled: true },
    jetbrains: { enabled: true },
    'codex-cli': { enabled: true },
    'codex-gui': { enabled: true },
    opencode: { enabled: true },
    'visual-studio': { enabled: true },
  },
  tags: [],
  notes: '',
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
  recipeId: '',
  recipeVersion: '',
  setupStatus: 'ready',
  lastInstallResult: {},
  lastInstallTimestamp: '',
  installPolicy: 'manual',
  normalizedLaunchConfig: {},
})

const baseClients = (): ClientStatus[] => [
  {
    id: 'cursor',
    displayName: 'Cursor',
    installed: true,
    configPaths: [],
    serverCount: 1,
    syncStatus: 'out-of-sync',
  },
  {
    id: 'claude-desktop',
    displayName: 'Claude Desktop',
    installed: true,
    configPaths: ['C:\\Users\\tester\\.claude\\mcp.json'],
    serverCount: 3,
    syncStatus: 'synced',
  },
  {
    id: 'vscode',
    displayName: 'VS Code',
    installed: false,
    configPaths: [],
    serverCount: 0,
    syncStatus: 'never-synced',
  },
  {
    id: 'jetbrains',
    displayName: 'JetBrains',
    installed: true,
    configPaths: ['C:\\Users\\tester\\AppData\\Roaming\\JetBrains\\mcp.json'],
    serverCount: 2,
    syncStatus: 'error',
  },
  {
    id: 'codex-cli',
    displayName: 'Codex CLI',
    installed: true,
    configPaths: ['C:\\Users\\tester\\.codex\\mcp.json'],
    serverCount: 1,
    syncStatus: 'out-of-sync',
  },
]

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClients = baseClients()
    mockServers = [
      createServer('srv-1', 'alpha'),
      createServer('srv-2', 'beta'),
      createServer('srv-3', 'gamma'),
    ]
    detectAllMock.mockResolvedValue()
    loadServersMock.mockResolvedValue()
    clientsReadConfigMock.mockResolvedValue({})
    syncClientMock.mockResolvedValue({})
    syncPreviewOutgoingMock.mockImplementation((scope) =>
      Promise.resolve(
        makeSyncPlan(scope, {
          entries:
            scope.kind === 'actionable-clients'
              ? [
                  {
                    id: 'entry-jetbrains',
                    path: 'C:\\Users\\tester\\AppData\\Roaming\\JetBrains\\mcp.json',
                    feature: 'mcp-config',
                    origin: 'client-sync',
                    action: 'modify',
                    clientId: 'jetbrains',
                    clientName: 'JetBrains',
                    detail: {
                      kind: 'mcp',
                      items: [
                        {
                          name: 'filesystem',
                          source: 'modified',
                          action: 'overwrite',
                          before: { command: 'old' },
                          after: { command: 'new' },
                        },
                      ],
                    },
                  },
                  {
                    id: 'entry-codex',
                    path: 'C:\\Users\\tester\\.codex\\mcp.json',
                    feature: 'mcp-config',
                    origin: 'client-sync',
                    action: 'modify',
                    clientId: 'codex-cli',
                    clientName: 'Codex CLI',
                    detail: {
                      kind: 'mcp',
                      items: [
                        {
                          name: 'filesystem',
                          source: 'modified',
                          action: 'overwrite',
                          before: { command: 'old' },
                          after: { command: 'new' },
                        },
                      ],
                    },
                  },
                ]
              : [
                  {
                    id: 'entry-codex',
                    path: 'C:\\Users\\tester\\.codex\\mcp.json',
                    feature: 'mcp-config',
                    origin: 'client-sync',
                    action: 'modify',
                    clientId: 'codex-cli',
                    clientName: 'Codex CLI',
                    detail: {
                      kind: 'mcp',
                      items: [
                        {
                          name: 'filesystem',
                          source: 'modified',
                          action: 'overwrite',
                          before: { command: 'old' },
                          after: { command: 'new' },
                        },
                      ],
                    },
                  },
                ],
          totalFiles: scope.kind === 'actionable-clients' ? 2 : 1,
          modifyCount: scope.kind === 'actionable-clients' ? 2 : 1,
        }),
      ),
    )
    clientsSyncMock.mockResolvedValue({
      success: true,
      serversWritten: 0,
      syncedAt: '2026-03-11T00:00:00.000Z',
    })
    previewConfigImportMock.mockResolvedValue({
      clientId: 'codex-cli',
      configPath: 'C:\\Users\\tester\\.codex\\config.json',
      items: [],
    })
    importConfigChangesMock.mockResolvedValue({
      clientId: 'codex-cli',
      configPath: 'C:\\Users\\tester\\.codex\\config.json',
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    })
    HTMLElement.prototype.scrollIntoView = vi.fn()

    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        clientsReadConfig: clientsReadConfigMock,
        syncPreviewOutgoing: syncPreviewOutgoingMock,
        clientsSync: clientsSyncMock,
        clientsPreviewConfigImport: previewConfigImportMock,
        clientsImportConfigChanges: importConfigChangesMock,
        onConfigChanged: () => () => {},
        // SyncStatusWidget calls these on mount; return empty arrays so the widget
        // shows the "all synced" state without errors in DashboardPage tests.
        syncListPending: vi.fn().mockResolvedValue([]),
        syncListConflicts: vi.fn().mockResolvedValue([]),
        syncPushReview: vi.fn().mockResolvedValue([]),
      },
      writable: true,
      configurable: true,
    })
  })

  it('renders KPI strip counts', () => {
    renderWithProviders(<DashboardPage />)

    expect(screen.getByTestId('dashboard-kpi-installed')).toHaveTextContent('4')
    expect(screen.getByTestId('dashboard-kpi-out-of-sync')).toHaveTextContent('3')
    expect(screen.getByTestId('dashboard-kpi-missing-config')).toHaveTextContent('1')
    expect(screen.getByTestId('dashboard-kpi-total-servers')).toHaveTextContent('3')
  })

  it('keeps per-client server counts unchanged on cards', () => {
    renderWithProviders(<DashboardPage />)

    const claudeDesktopCard = screen.getByTestId('client-card-claude-desktop')
    expect(within(claudeDesktopCard).getByText('3 MCP Servers')).toBeInTheDocument()
  })

  it('falls back to deduplicated detected config servers when registry is empty', async () => {
    mockServers = []
    mockClients = [
      {
        id: 'cursor',
        displayName: 'Cursor',
        installed: true,
        configPaths: ['C:\\Users\\tester\\.cursor\\mcp.json'],
        serverCount: 2,
        syncStatus: 'synced',
      },
      {
        id: 'codex-cli',
        displayName: 'Codex CLI',
        installed: true,
        configPaths: ['C:\\Users\\tester\\.codex\\config.json'],
        serverCount: 2,
        syncStatus: 'synced',
      },
    ]

    clientsReadConfigMock.mockImplementation((clientId: string) => {
      if (clientId === 'cursor') {
        return {
          github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
          filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
        }
      }
      if (clientId === 'codex-cli') {
        return {
          github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
          filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
        }
      }
      return {}
    })

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-kpi-total-servers')).toHaveTextContent('2')
    })
  })

  it('refreshes both client detection and servers registry', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => expect(detectAllMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(loadServersMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByTestId('detect-all-button'))

    await waitFor(() => expect(detectAllMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(loadServersMock).toHaveBeenCalledTimes(2))
  })

  it('renders a two-row toolbar layout', () => {
    renderWithProviders(<DashboardPage />)

    const stickyToolbar = screen.getByTestId('dashboard-sticky-toolbar')
    expect(stickyToolbar).toHaveClass(
      'sticky',
      '-top-6',
      '-mx-6',
      '-mt-6',
      'mb-6',
      'border-b',
      'border-border/70',
      'px-6',
      'pb-4',
      'pt-8',
      'bg-background/95',
      'backdrop-blur',
    )
    expect(screen.queryByTestId('dashboard-sticky-top-guard')).not.toBeInTheDocument()

    expect(screen.getByTestId('dashboard-toolbar')).toHaveAttribute('role', 'toolbar')
    expect(screen.getByTestId('dashboard-toolbar-row1')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-toolbar-row2')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-toolbar-actions')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-search-container')).toHaveClass('min-w-[280px]')
    expect(screen.getByTestId('dashboard-toolbar-row2-filters')).toHaveClass('overflow-x-auto')
  })

  it('keeps search interactive with row-2 filters visible', () => {
    renderWithProviders(<DashboardPage />)

    const search = screen.getByRole('textbox', { name: 'Search tools...' })
    fireEvent.change(search, { target: { value: 'codex' } })

    expect(search).toHaveValue('codex')
    expect(screen.getByTestId('dashboard-filter-all')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-filter-needs-attention')).toBeInTheDocument()
    expect(screen.getByTestId('sync-all-actionable-button')).toBeInTheDocument()
  })

  it('shows warning sync indicator when only missing-config clients are blocking sync', () => {
    mockClients = [
      {
        id: 'cursor',
        displayName: 'Cursor',
        installed: true,
        configPaths: [],
        serverCount: 1,
        syncStatus: 'out-of-sync',
      },
      {
        id: 'claude-desktop',
        displayName: 'Claude Desktop',
        installed: true,
        configPaths: ['C:\\Users\\tester\\.claude\\mcp.json'],
        serverCount: 2,
        syncStatus: 'synced',
      },
    ]

    renderWithProviders(<DashboardPage />)

    expect(screen.getByTestId('sync-all-actionable-button')).toBeDisabled()
    expect(screen.getByTestId('dashboard-sync-indicator')).toHaveAttribute('data-state', 'warning')
    expect(screen.getByTestId('dashboard-sync-indicator')).toHaveTextContent('1 missing config')
    expect(screen.getByTestId('dashboard-sync-indicator-text')).toHaveClass('truncate')
    expect(screen.getByTestId('dashboard-toolbar-status')).toBeInTheDocument()
    expect(screen.getByTestId('sync-all-actionable-button')).toBeInTheDocument()
  })

  it('shows success sync indicator when all installed clients are in sync', () => {
    mockClients = [
      {
        id: 'claude-desktop',
        displayName: 'Claude Desktop',
        installed: true,
        configPaths: ['C:\\Users\\tester\\.claude\\mcp.json'],
        serverCount: 2,
        syncStatus: 'synced',
      },
      {
        id: 'codex-cli',
        displayName: 'Codex CLI',
        installed: true,
        configPaths: ['C:\\Users\\tester\\.codex\\mcp.json'],
        serverCount: 1,
        syncStatus: 'synced',
      },
    ]

    renderWithProviders(<DashboardPage />)

    expect(screen.getByTestId('sync-all-actionable-button')).toBeDisabled()
    expect(screen.getByTestId('dashboard-sync-indicator')).toHaveAttribute('data-state', 'success')
    expect(screen.getByTestId('dashboard-sync-indicator')).toHaveTextContent('All synced')
  })

  it('shows neutral sync indicator when no clients are installed', () => {
    mockClients = [
      {
        id: 'vscode',
        displayName: 'VS Code',
        installed: false,
        configPaths: [],
        serverCount: 0,
        syncStatus: 'never-synced',
      },
    ]

    renderWithProviders(<DashboardPage />)

    expect(screen.getByTestId('sync-all-actionable-button')).toBeDisabled()
    expect(screen.getByTestId('dashboard-sync-indicator')).toHaveAttribute('data-state', 'neutral')
    expect(screen.getByTestId('dashboard-sync-indicator')).toHaveTextContent('No installed clients')
  })

  it('hides sync indicator and enables bulk sync button when actionable targets exist', () => {
    renderWithProviders(<DashboardPage />)

    expect(screen.getByTestId('sync-all-actionable-button')).toBeEnabled()
    expect(screen.queryByTestId('dashboard-sync-indicator')).not.toBeInTheDocument()
  })

  it('shows the full indicator text in a tooltip on hover', async () => {
    const user = userEvent.setup()
    mockClients = [
      {
        id: 'cursor',
        displayName: 'Cursor',
        installed: true,
        configPaths: [],
        serverCount: 1,
        syncStatus: 'out-of-sync',
      },
      {
        id: 'claude-desktop',
        displayName: 'Claude Desktop',
        installed: true,
        configPaths: ['C:\\Users\\tester\\.claude\\mcp.json'],
        serverCount: 2,
        syncStatus: 'synced',
      },
    ]
    renderWithProviders(<DashboardPage />)

    await user.hover(screen.getByTestId('dashboard-sync-indicator'))

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'No syncable clients (1 missing config).',
    )
  })

  it('filters clients by needs attention', () => {
    renderWithProviders(<DashboardPage />)

    fireEvent.click(screen.getByTestId('dashboard-filter-needs-attention'))

    expect(screen.getByTestId('clients-grid-needs-attention')).toBeInTheDocument()
    expect(screen.getByText('No healthy tools match the current filters.')).toBeInTheDocument()
    expect(screen.queryByText('VS Code')).not.toBeInTheDocument()
  })

  it('shows not-installed section expanded by default and allows collapsing', () => {
    renderWithProviders(<DashboardPage />)

    expect(screen.getByTestId('clients-grid-not-installed')).toBeInTheDocument()
    expect(screen.getByText('VS Code')).toBeInTheDocument()

    const section = screen.getByTestId('dashboard-section-not-installed')
    const toggleButton = within(section).getByRole('button', { expanded: true })
    fireEvent.click(toggleButton)
    expect(screen.queryByTestId('clients-grid-not-installed')).not.toBeInTheDocument()
  })

  it('sorts by server count in descending order', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DashboardPage />)

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Server count'))

    const attentionGrid = screen.getByTestId('clients-grid-needs-attention')
    const cards = within(attentionGrid).getAllByTestId(/client-card-/)
    expect(cards[0]).toHaveAttribute('data-testid', 'client-card-jetbrains')
  })

  it('opens sync preview first and only syncs after confirm', async () => {
    renderWithProviders(<DashboardPage />)

    fireEvent.click(screen.getByTestId('client-sync-button-codex-cli'))

    await waitFor(() =>
      expect(syncPreviewOutgoingMock).toHaveBeenCalledWith({
        kind: 'client',
        clientId: 'codex-cli',
      }),
    )
    expect(syncClientMock).not.toHaveBeenCalled()
    expect(await screen.findByTestId('sync-center-dialog')).toBeInTheDocument()
    expect(screen.getByText('C:\\Users\\tester\\.codex\\mcp.json')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('sync-plan-confirm'))

    await waitFor(() => expect(syncClientMock).toHaveBeenCalledWith('codex-cli', undefined))
  })

  it('shows an empty sync plan and disables confirm when no file changes are needed', async () => {
    syncPreviewOutgoingMock.mockResolvedValue(
      makeSyncPlan(
        {
          kind: 'client',
          clientId: 'codex-cli',
        },
        {
          entries: [],
          totalFiles: 0,
          createCount: 0,
          modifyCount: 0,
          removeCount: 0,
          confirmable: false,
        },
      ),
    )
    renderWithProviders(<DashboardPage />)

    fireEvent.click(screen.getByTestId('client-sync-button-codex-cli'))

    await waitFor(() =>
      expect(syncPreviewOutgoingMock).toHaveBeenCalledWith({
        kind: 'client',
        clientId: 'codex-cli',
      }),
    )
    expect(await screen.findByTestId('sync-center-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('sync-plan-empty')).toBeInTheDocument()
    expect(screen.getByTestId('sync-plan-confirm')).toBeDisabled()
    expect(syncClientMock).not.toHaveBeenCalled()
    expect(toastInfoMock).not.toHaveBeenCalled()
  })

  it('shows sync error and resets syncing state when confirm sync fails', async () => {
    syncClientMock.mockRejectedValue(new Error('sync exploded'))
    renderWithProviders(<DashboardPage />)

    fireEvent.click(screen.getByTestId('client-sync-button-codex-cli'))
    await screen.findByTestId('sync-center-dialog')
    fireEvent.click(screen.getByTestId('sync-plan-confirm'))

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('sync exploded'))
    expect(screen.getByTestId('client-sync-button-codex-cli')).toHaveTextContent('Sync')
    expect(screen.getByTestId('client-sync-button-codex-cli')).not.toHaveTextContent('Syncing')
  })

  it('opens actionable bulk preview and syncs only actionable clients after confirm', async () => {
    renderWithProviders(<DashboardPage />)

    fireEvent.click(screen.getByTestId('sync-all-actionable-button'))
    await waitFor(() =>
      expect(syncPreviewOutgoingMock).toHaveBeenCalledWith({
        kind: 'actionable-clients',
        clientIds: ['jetbrains', 'codex-cli'],
        allowCreateConfigIfMissing: true,
      }),
    )
    expect(await screen.findByTestId('sync-center-dialog')).toBeInTheDocument()
    expect(screen.getByText('C:\\Users\\tester\\.codex\\mcp.json')).toBeInTheDocument()
    expect(
      screen.getByText('C:\\Users\\tester\\AppData\\Roaming\\JetBrains\\mcp.json'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('sync-plan-confirm'))

    await waitFor(() => {
      expect(clientsSyncMock).toHaveBeenCalledWith('codex-cli', undefined)
      expect(clientsSyncMock).toHaveBeenCalledWith('jetbrains', undefined)
      expect(clientsSyncMock).toHaveBeenCalledTimes(2)
    })
  })

  it('shows an empty bulk sync plan and disables confirm when nothing would be written', async () => {
    syncPreviewOutgoingMock.mockResolvedValue(
      makeSyncPlan(
        {
          kind: 'actionable-clients',
          clientIds: ['jetbrains', 'codex-cli'],
          allowCreateConfigIfMissing: true,
        },
        {
          entries: [],
          totalFiles: 0,
          createCount: 0,
          modifyCount: 0,
          removeCount: 0,
          confirmable: false,
        },
      ),
    )
    renderWithProviders(<DashboardPage />)

    fireEvent.click(screen.getByTestId('sync-all-actionable-button'))

    await waitFor(() =>
      expect(syncPreviewOutgoingMock).toHaveBeenCalledWith({
        kind: 'actionable-clients',
        clientIds: ['jetbrains', 'codex-cli'],
        allowCreateConfigIfMissing: true,
      }),
    )
    expect(await screen.findByTestId('sync-center-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('sync-plan-empty')).toBeInTheDocument()
    expect(screen.getByTestId('sync-plan-confirm')).toBeDisabled()
    expect(clientsSyncMock).not.toHaveBeenCalled()
    expect(toastInfoMock).not.toHaveBeenCalled()
  })

  it('shows only the files included in the bulk sync plan', async () => {
    syncPreviewOutgoingMock.mockResolvedValue(
      makeSyncPlan(
        {
          kind: 'actionable-clients',
          clientIds: ['jetbrains', 'codex-cli'],
          allowCreateConfigIfMissing: true,
        },
        {
          entries: [
            {
              id: 'entry-codex',
              path: 'C:\\Users\\tester\\.codex\\mcp.json',
              feature: 'mcp-config',
              origin: 'client-sync',
              action: 'modify',
              clientId: 'codex-cli',
              clientName: 'Codex CLI',
              detail: {
                kind: 'mcp',
                items: [
                  {
                    name: 'filesystem',
                    source: 'modified',
                    action: 'overwrite',
                    before: { command: 'old' },
                    after: { command: 'new' },
                  },
                ],
              },
            },
          ],
          totalFiles: 1,
          modifyCount: 1,
        },
      ),
    )
    renderWithProviders(<DashboardPage />)

    fireEvent.click(screen.getByTestId('sync-all-actionable-button'))

    await waitFor(() =>
      expect(syncPreviewOutgoingMock).toHaveBeenCalledWith({
        kind: 'actionable-clients',
        clientIds: ['jetbrains', 'codex-cli'],
        allowCreateConfigIfMissing: true,
      }),
    )
    expect(await screen.findByTestId('sync-center-dialog')).toBeInTheDocument()
    expect(screen.getByText('C:\\Users\\tester\\.codex\\mcp.json')).toBeInTheDocument()
    expect(
      screen.queryByText('C:\\Users\\tester\\AppData\\Roaming\\JetBrains\\mcp.json'),
    ).not.toBeInTheDocument()
  })

  it('prompts to create config from dedicated action, then previews before sync', async () => {
    syncPreviewOutgoingMock.mockResolvedValue(
      makeSyncPlan(
        {
          kind: 'client',
          clientId: 'cursor',
          options: { allowCreateConfigIfMissing: true },
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
                    name: 'filesystem',
                    source: 'added',
                    action: 'create',
                    before: null,
                    after: { command: 'new' },
                  },
                ],
              },
            },
          ],
          totalFiles: 1,
          createCount: 1,
          modifyCount: 0,
        },
      ),
    )
    renderWithProviders(<DashboardPage />)

    expect(screen.getByTestId('client-sync-button-cursor')).toBeDisabled()
    expect(screen.getByTestId('client-create-config-button-cursor')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('client-create-config-button-cursor'))

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

    fireEvent.click(screen.getByTestId('sync-plan-confirm'))
    await waitFor(() =>
      expect(syncClientMock).toHaveBeenCalledWith('cursor', {
        allowCreateConfigIfMissing: true,
      }),
    )
  })

  it('opens import diff from toast action and imports after confirm', async () => {
    const payload = {
      clientId: 'codex-cli',
      configPath: 'C:\\Users\\tester\\.codex\\config.json',
      added: ['beta'],
      removed: ['alpha'],
      modified: ['gamma'],
    } as const

    previewConfigImportMock.mockResolvedValue({
      clientId: payload.clientId,
      configPath: payload.configPath,
      items: [
        {
          name: 'beta',
          source: 'added',
          action: 'create',
          before: null,
          after: { command: 'npx', args: ['-y', '@scope/server-beta'] },
        },
      ],
    })
    importConfigChangesMock.mockResolvedValue({
      clientId: payload.clientId,
      configPath: payload.configPath,
      created: 1,
      updated: 0,
      skipped: 0,
      errors: [],
    })

    let configChangedHandler: ((event: typeof payload) => void) | null = null
    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        clientsPreviewConfigImport: previewConfigImportMock,
        clientsImportConfigChanges: importConfigChangesMock,
        onConfigChanged: (handler: (event: typeof payload) => void) => {
          configChangedHandler = handler
          return () => {}
        },
      },
      writable: true,
      configurable: true,
    })

    renderWithProviders(<DashboardPage />)
    expect(configChangedHandler).not.toBeNull()

    act(() => {
      configChangedHandler?.(payload)
    })
    const toastOptions = toastInfoMock.mock.calls.at(-1)?.[1] as
      | { action?: { onClick?: () => void } }
      | undefined
    act(() => {
      toastOptions?.action?.onClick?.()
    })

    await waitFor(() => expect(previewConfigImportMock).toHaveBeenCalledWith(payload))
    expect(await screen.findByTestId('config-import-diff-dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Import changes' }))
    await waitFor(() => expect(importConfigChangesMock).toHaveBeenCalledWith(payload))
    expect(toastSuccessMock).toHaveBeenCalled()
  })
})
