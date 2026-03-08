import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { ServersPage } from '../ServersPage'
import type { McpServer } from '@shared/types'

const loadMock = vi.fn<() => Promise<void>>()
const deleteMock = vi.fn<(id: string) => Promise<void>>()
const toggleEnabledMock = vi.fn<(id: string) => Promise<void>>()
const detectAllMock = vi.fn<() => Promise<void>>()
const handleTestMock = vi.fn<(server: McpServer) => Promise<void>>()
const handleSyncAllMock = vi.fn<() => Promise<void>>()
const handleImportFromClientsMock = vi.fn<() => Promise<void>>()

const toastSuccessMock = vi.fn<(message?: unknown) => void>()
const toastErrorMock = vi.fn<(message?: unknown) => void>()

const server: McpServer = {
  id: 'srv-1',
  name: 'devtools',
  type: 'stdio',
  command: 'npx',
  args: ['-y', 'chrome-devtools-mcp@latest', '--browser-url=http://localhost:9222'],
  env: {},
  secretEnvKeys: [],
  enabled: true,
  clientOverrides: {
    'claude-desktop': { enabled: true },
    'claude-code': { enabled: true },
    cursor: { enabled: true },
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
  tags: ['registry'],
  notes: '',
  createdAt: '2026-03-08T10:00:00.000Z',
  updatedAt: '2026-03-08T10:00:00.000Z',
}

const fullCommand = `${server.command} ${server.args.join(' ')}`

vi.mock('sonner', () => ({
  toast: {
    success: (message?: unknown) => toastSuccessMock(message),
    error: (message?: unknown) => toastErrorMock(message),
  },
}))

vi.mock('@/stores/servers.store', () => ({
  useServersStore: () => ({
    servers: [server],
    loading: false,
    error: null,
    load: loadMock,
    delete: deleteMock,
    toggleEnabled: toggleEnabledMock,
  }),
}))

vi.mock('@/stores/clients.store', () => ({
  useClientsStore: () => ({
    clients: [{ id: 'cursor', installed: true }],
    detectAll: detectAllMock,
  }),
}))

vi.mock('@/hooks/useServersActions', () => ({
  useServersActions: () => ({
    syncingAll: false,
    importingFromClients: false,
    testingServerId: null,
    handleTest: handleTestMock,
    handleSyncAll: handleSyncAllMock,
    handleImportFromClients: handleImportFromClientsMock,
  }),
}))

vi.mock('@/lib/useFeatureGate', () => ({
  useFeatureGate: () => true,
}))

describe('ServersPage command column', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadMock.mockResolvedValue()
    detectAllMock.mockResolvedValue()
    deleteMock.mockResolvedValue()
    toggleEnabledMock.mockResolvedValue()
    handleTestMock.mockResolvedValue()
    handleSyncAllMock.mockResolvedValue()
    handleImportFromClientsMock.mockResolvedValue()

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders truncated command text with tooltip trigger semantics', () => {
    renderWithProviders(<ServersPage />)

    const commandText = screen.getByTestId('server-command-text-srv-1')
    expect(commandText).toHaveClass('truncate')
    expect(commandText).toHaveAttribute('data-slot', 'tooltip-trigger')
    expect(commandText).toHaveTextContent(fullCommand)
  })

  it('copies full command and shows success toast', async () => {
    renderWithProviders(<ServersPage />)

    const copyButton = screen.getByTestId('server-command-copy-srv-1')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(fullCommand)
      expect(toastSuccessMock).toHaveBeenCalledWith('Command copied to clipboard')
    })
  })

  it('shows error toast when copy fails', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('no clipboard'))

    renderWithProviders(<ServersPage />)

    const copyButton = screen.getByTestId('server-command-copy-srv-1')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to copy command')
    })
  })

  it('keeps existing row actions available', () => {
    renderWithProviders(<ServersPage />)

    expect(screen.getByTestId('server-test-srv-1')).toBeInTheDocument()
    expect(screen.getByTestId('server-edit-srv-1')).toBeInTheDocument()
    expect(screen.getByTestId('server-delete-srv-1')).toBeInTheDocument()
  })
})
