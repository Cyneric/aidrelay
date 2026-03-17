import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { ServersPage } from '../ServersPage'
import type { McpServer } from '@shared/types'
import type { ServerTestPhase, ServerTestStatus } from '@/hooks/useServersActions'

const COMMAND_PREVIEW_MAX_CHARS = 72

const formatCommandPreview = (
  command: string,
  args: readonly string[],
  maxChars = COMMAND_PREVIEW_MAX_CHARS,
) => {
  const parts = [command, ...args].map((part) => part.trim()).filter((part) => part.length > 0)
  if (parts.length === 0) return ''

  const ellipsis = '...'
  const budget = Math.max(ellipsis.length + 1, maxChars)
  const reservedBudget = budget - ellipsis.length
  const firstPart = parts[0] ?? ''

  if (firstPart.length > reservedBudget) {
    return `${firstPart.slice(0, reservedBudget)}${ellipsis}`
  }

  const previewParts = [firstPart]
  let currentLength = firstPart.length
  let didTruncate = false

  for (const part of parts.slice(1)) {
    const nextLength = currentLength + 1 + part.length
    if (nextLength > reservedBudget) {
      didTruncate = true
      break
    }
    previewParts.push(part)
    currentLength = nextLength
  }

  const preview = previewParts.join(' ')
  return didTruncate ? `${preview}${ellipsis}` : preview
}

const loadMock = vi.fn<() => Promise<void>>()
const deleteMock = vi.fn<(id: string) => Promise<void>>()
const toggleEnabledMock = vi.fn<(id: string) => Promise<void>>()
const detectAllMock = vi.fn<() => Promise<void>>()
const handleTestMock = vi.fn<(server: McpServer) => Promise<void>>()
const handleSyncAllMock = vi.fn<() => Promise<void>>()
const handleImportFromClientsMock = vi.fn<() => Promise<void>>()
const serversActionsState: {
  testingByServerId: Record<string, ServerTestPhase>
  testStatusByServerId: Record<string, Exclude<ServerTestStatus, 'not_tested'>>
} = {
  testingByServerId: {},
  testStatusByServerId: {},
}

const toastSuccessMock = vi.fn<(message?: unknown) => void>()
const toastErrorMock = vi.fn<(message?: unknown) => void>()
const clipboardWriteTextMock = vi.fn<(text: string) => Promise<void>>()

const server: McpServer = {
  id: 'srv-1',
  name: 'devtools',
  type: 'stdio',
  command: 'npx',
  args: [
    '-y',
    'chrome-devtools-mcp@latest',
    '--browser-url=http://localhost:9222',
    '--log-file=C:\\Users\\chris\\AppData\\Local\\Temp\\aidrelay\\mcp\\devtools.log',
  ],
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
  tags: ['registry'],
  notes: '',
  createdAt: '2026-03-08T10:00:00.000Z',
  updatedAt: '2026-03-08T10:00:00.000Z',
  recipeId: '',
  recipeVersion: '',
  setupStatus: 'ready',
  lastInstallResult: {},
  lastInstallTimestamp: '2026-03-08T10:00:00.000Z',
  installPolicy: 'manual',
  normalizedLaunchConfig: {},
}
const secondServer: McpServer = {
  ...server,
  id: 'srv-2',
  name: 'filesystem',
  command: 'node',
  args: ['dist/server.js'],
}

const fullCommand = `${server.command} ${server.args.join(' ')}`
const commandPreview = formatCommandPreview(server.command, server.args)

vi.mock('sonner', () => ({
  toast: {
    success: (message?: unknown) => toastSuccessMock(message),
    error: (message?: unknown) => toastErrorMock(message),
  },
}))

vi.mock('@/stores/servers.store', () => ({
  useServersStore: () => ({
    servers: [server, secondServer],
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
    getTestingPhase: (serverId: string) => serversActionsState.testingByServerId[serverId] ?? null,
    isTestingServer: (serverId: string) => Boolean(serversActionsState.testingByServerId[serverId]),
    getTestStatus: (serverId: string) =>
      serversActionsState.testStatusByServerId[serverId] ?? 'not_tested',
    handleTest: handleTestMock,
    handleSyncAll: handleSyncAllMock,
    handleImportFromClients: handleImportFromClientsMock,
  }),
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
    serversActionsState.testingByServerId = {}
    serversActionsState.testStatusByServerId = {}

    clipboardWriteTextMock.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteTextMock },
      writable: true,
      configurable: true,
    })
  })

  it('renders truncated command text with tooltip trigger semantics', () => {
    renderWithProviders(<ServersPage />)

    const commandText = screen.getByTestId('server-command-text-srv-1')
    expect(commandText).toHaveClass('truncate')
    expect(commandText).toHaveAttribute('data-slot', 'tooltip-trigger')
    expect(commandText).toHaveTextContent(commandPreview)
    expect(commandPreview).toContain('...')
  })

  it('keeps full command available via tooltip title', () => {
    renderWithProviders(<ServersPage />)

    expect(screen.getByTestId('server-command-text-srv-1')).toHaveAttribute('title', fullCommand)
  })

  it('copies full command and shows success toast', async () => {
    renderWithProviders(<ServersPage />)

    const copyButton = screen.getByTestId('server-command-copy-srv-1')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(fullCommand)
      expect(toastSuccessMock).toHaveBeenCalledWith('Command copied to clipboard')
    })
  })

  it('shows error toast when copy fails', async () => {
    clipboardWriteTextMock.mockRejectedValueOnce(new Error('no clipboard'))

    renderWithProviders(<ServersPage />)

    const copyButton = screen.getByTestId('server-command-copy-srv-1')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to copy command')
    })
  })

  it('keeps existing row actions available', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ServersPage />)

    // Primary action (Edit) is always visible
    expect(screen.getByTestId('server-actions-srv-1-primary')).toBeInTheDocument()

    // Open the dropdown to verify menu items
    await user.click(screen.getByTestId('server-actions-srv-1-menu-trigger'))

    expect(await screen.findByTestId('server-actions-srv-1-item-test-server')).toBeInTheDocument()
    expect(await screen.findByTestId('server-actions-srv-1-item-delete')).toBeInTheDocument()
  })

  it('renders inline test phase and spinner for active test row', async () => {
    const user = userEvent.setup()
    serversActionsState.testingByServerId = { 'srv-1': 'waiting_response' }

    renderWithProviders(<ServersPage />)

    expect(screen.getByTestId('server-test-phase-srv-1')).toHaveTextContent(
      'Waiting for server response…',
    )

    // Open the dropdown to verify the test item is disabled while testing
    await user.click(screen.getByTestId('server-actions-srv-1-menu-trigger'))
    const testItem = await screen.findByTestId('server-actions-srv-1-item-test-server')
    expect(testItem).toHaveAttribute('data-disabled', '')
  })

  it('supports showing multiple active test rows in parallel', async () => {
    const user = userEvent.setup()
    serversActionsState.testingByServerId = {
      'srv-1': 'waiting_response',
      'srv-2': 'sending_initialize',
    }

    renderWithProviders(<ServersPage />)

    expect(screen.getByTestId('server-test-phase-srv-1')).toHaveTextContent(
      'Waiting for server response…',
    )
    expect(screen.getByTestId('server-test-phase-srv-2')).toHaveTextContent('Sending initialize…')

    // Verify test action is disabled in dropdown for srv-1
    await user.click(screen.getByTestId('server-actions-srv-1-menu-trigger'))
    const testItem1 = await screen.findByTestId('server-actions-srv-1-item-test-server')
    expect(testItem1).toHaveAttribute('data-disabled', '')

    // Close the first dropdown by pressing Escape, then check srv-2
    await user.keyboard('{Escape}')
    await user.click(screen.getByTestId('server-actions-srv-2-menu-trigger'))
    const testItem2 = await screen.findByTestId('server-actions-srv-2-item-test-server')
    expect(testItem2).toHaveAttribute('data-disabled', '')
  })

  it('renders not tested badge by default', () => {
    renderWithProviders(<ServersPage />)
    expect(screen.getByTestId('server-test-status-srv-1')).toHaveTextContent('Not tested')
    expect(screen.getByTestId('server-test-status-srv-2')).toHaveTextContent('Not tested')
  })

  it('renders passed and failed badges from latest test results', () => {
    serversActionsState.testStatusByServerId = {
      'srv-1': 'success',
      'srv-2': 'failure',
    }

    renderWithProviders(<ServersPage />)

    expect(screen.getByTestId('server-test-status-srv-1')).toHaveTextContent('Passed')
    expect(screen.getByTestId('server-test-status-srv-2')).toHaveTextContent('Failed')
  })
})
