import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { DashboardPage } from '../DashboardPage'
import type * as ClientsStoreModule from '@/stores/clients.store'
import type { ClientStatus } from '@shared/types'

const detectAllMock = vi.fn<() => Promise<void>>()
const syncClientMock =
  vi.fn<(id: string, options?: { allowCreateConfigIfMissing?: boolean }) => Promise<unknown>>()

const toastErrorMock = vi.fn<(message?: unknown) => void>()
const toastInfoMock = vi.fn<(message?: unknown, options?: unknown) => void>()
const toastSuccessMock = vi.fn<(message?: unknown) => void>()

let mockClients: ClientStatus[] = []

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
    detectAllMock.mockResolvedValue()
    syncClientMock.mockResolvedValue({})
    HTMLElement.prototype.scrollIntoView = vi.fn()

    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        onConfigChanged: () => () => {},
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
    expect(screen.getByTestId('dashboard-kpi-total-servers')).toHaveTextContent('7')
  })

  it('renders a two-row toolbar layout', () => {
    renderWithProviders(<DashboardPage />)

    expect(screen.getByTestId('dashboard-toolbar')).toHaveAttribute('role', 'toolbar')
    expect(screen.getByTestId('dashboard-toolbar-row1')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-toolbar-row2')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-toolbar-actions')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-search-container')).toHaveClass('min-w-[280px]')
    expect(screen.getByTestId('dashboard-toolbar-row2')).toHaveClass('overflow-x-auto')
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

  it('shows sync error and resets syncing state when sync fails', async () => {
    syncClientMock.mockRejectedValue(new Error('sync exploded'))
    renderWithProviders(<DashboardPage />)

    fireEvent.click(screen.getByTestId('client-sync-button-codex-cli'))

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('sync exploded'))
    expect(screen.getByTestId('client-sync-button-codex-cli')).toHaveTextContent('Sync')
    expect(screen.getByTestId('client-sync-button-codex-cli')).not.toHaveTextContent('Syncing')
  })

  it('prompts to create config from dedicated action and syncs on confirm', async () => {
    renderWithProviders(<DashboardPage />)

    expect(screen.getByTestId('client-sync-button-cursor')).toBeDisabled()
    expect(screen.getByTestId('client-create-config-button-cursor')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('client-create-config-button-cursor'))

    expect(await screen.findByText('Create new configuration?')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('create-config-confirm'))

    await waitFor(() =>
      expect(syncClientMock).toHaveBeenCalledWith('cursor', {
        allowCreateConfigIfMissing: true,
      }),
    )
  })
})
