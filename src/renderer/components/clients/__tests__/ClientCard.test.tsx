import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { ClientCard } from '../ClientCard'
import type { ClientStatus } from '@shared/types'

// Mock ClientIcon to simplify testing
vi.mock('@/components/common/icons/ClientIcon', () => ({
  ClientIcon: ({ clientId, ariaLabel }: { clientId: string; ariaLabel: string }) => (
    <span data-testid={`mock-client-icon-${clientId}`} aria-label={ariaLabel}>
      {clientId} icon
    </span>
  ),
}))

const toastSuccessMock = vi.fn<(message?: unknown) => void>()
const toastErrorMock = vi.fn<(message?: unknown) => void>()
const clipboardWriteTextMock = vi.fn<(text: string) => Promise<void>>()
const filesRevealMock = vi.fn<(path: string) => Promise<void>>()

vi.mock('sonner', () => ({
  toast: {
    success: (...args: Parameters<typeof toastSuccessMock>) => {
      toastSuccessMock(...args)
    },
    error: (...args: Parameters<typeof toastErrorMock>) => {
      toastErrorMock(...args)
    },
  },
}))

const buildClient = (
  serverCount: number,
  configPaths: string[] = ['C:/cursor/settings.json'],
): ClientStatus => ({
  id: 'cursor',
  displayName: 'Cursor',
  installed: true,
  configPaths,
  serverCount,
  syncStatus: 'synced',
  lastSyncedAt: '2026-03-01T10:00:00.000Z',
})

const getEnabledByTestId = (testId: string): HTMLElement => {
  const matches = screen.getAllByTestId(testId)
  const enabled = [...matches].reverse().find((element) => !element.hasAttribute('data-disabled'))
  if (!enabled) {
    throw new Error(`Element with test id "${testId}" not found`)
  }
  return enabled
}

describe('ClientCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clipboardWriteTextMock.mockResolvedValue(undefined)
    filesRevealMock.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: clipboardWriteTextMock,
      },
      configurable: true,
      writable: true,
    })
    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        filesReveal: filesRevealMock,
      },
      configurable: true,
      writable: true,
    })
  })

  it('renders MCP server count in singular form', () => {
    renderWithProviders(
      <ClientCard client={buildClient(1)} onSync={vi.fn()} onCreateConfig={vi.fn()} />,
    )
    expect(screen.getByTestId('client-server-count-cursor')).toHaveTextContent('1 MCP Server')
  })

  it('renders MCP server count in plural form', () => {
    renderWithProviders(
      <ClientCard client={buildClient(2)} onSync={vi.fn()} onCreateConfig={vi.fn()} />,
    )
    expect(screen.getByTestId('client-server-count-cursor')).toHaveTextContent('2 MCP Servers')
  })

  it('falls back to 0 MCP Servers for invalid count values', () => {
    renderWithProviders(
      <ClientCard client={buildClient(Number.NaN)} onSync={vi.fn()} onCreateConfig={vi.fn()} />,
    )
    expect(screen.getByTestId('client-server-count-cursor')).toHaveTextContent('0 MCP Servers')
  })

  it('renders separate sync and create-config actions when config path is missing', () => {
    const onSync = vi.fn()
    const onCreateConfig = vi.fn()
    renderWithProviders(
      <ClientCard client={buildClient(1, [])} onSync={onSync} onCreateConfig={onCreateConfig} />,
    )

    const syncButton = screen.getByTestId('client-sync-button-cursor')
    const createConfigButton = screen.getByTestId('client-create-config-button-cursor')
    expect(syncButton).toHaveTextContent('Sync')
    expect(syncButton).toBeDisabled()
    expect(createConfigButton).toHaveTextContent('Create config')
    expect(syncButton).toHaveAttribute('aria-label', 'Sync Cursor')
    expect(createConfigButton).toHaveAttribute('aria-label', 'Create config Cursor')

    fireEvent.click(syncButton)
    expect(onSync).not.toHaveBeenCalled()

    fireEvent.click(createConfigButton)
    expect(onCreateConfig).toHaveBeenCalledWith('cursor')
    expect(onSync).not.toHaveBeenCalled()
  })

  it('disables the primary action when the client is not installed', () => {
    const client = { ...buildClient(1), installed: false, configPaths: [] }
    renderWithProviders(<ClientCard client={client} onSync={vi.fn()} onCreateConfig={vi.fn()} />)

    expect(screen.getByTestId('client-sync-button-cursor')).toBeDisabled()
  })

  it('toggles detail panel from overflow menu', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ClientCard client={buildClient(1)} onSync={vi.fn()} onCreateConfig={vi.fn()} />,
    )

    await user.click(screen.getByTestId('client-more-actions-cursor'))
    await user.click(await screen.findByText('View details'))

    expect(screen.getByText(/Sync status/i)).toBeInTheDocument()
  })

  it('shows enabled copy action when config path exists', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ClientCard client={buildClient(1)} onSync={vi.fn()} onCreateConfig={vi.fn()} />,
    )

    await user.click(screen.getByTestId('client-more-actions-cursor'))
    expect(getEnabledByTestId('client-copy-config-path-cursor')).not.toHaveAttribute(
      'data-disabled',
    )
  })

  it('reveals first config path in explorer', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ClientCard client={buildClient(1)} onSync={vi.fn()} onCreateConfig={vi.fn()} />,
    )

    await user.click(screen.getByTestId('client-more-actions-cursor'))
    fireEvent.click(getEnabledByTestId('client-reveal-config-path-cursor'))

    await waitFor(() => {
      expect(filesRevealMock).toHaveBeenCalledTimes(1)
      expect(filesRevealMock).toHaveBeenCalledWith('C:/cursor/settings.json')
    })
  })

  it('copies first config path once from overflow menu', async () => {
    const user = userEvent.setup()
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    renderWithProviders(
      <ClientCard client={buildClient(1)} onSync={vi.fn()} onCreateConfig={vi.fn()} />,
    )

    await user.click(screen.getByTestId('client-more-actions-cursor'))
    await user.click(getEnabledByTestId('client-copy-config-path-cursor'))

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledTimes(1)
      expect(writeTextSpy).toHaveBeenCalledWith('C:/cursor/settings.json')
    })
  })

  it('shows an error toast when reveal in explorer fails', async () => {
    filesRevealMock.mockRejectedValueOnce(new Error('cannot open'))
    const user = userEvent.setup()
    renderWithProviders(
      <ClientCard client={buildClient(1)} onSync={vi.fn()} onCreateConfig={vi.fn()} />,
    )

    await user.click(screen.getByTestId('client-more-actions-cursor'))
    fireEvent.click(getEnabledByTestId('client-reveal-config-path-cursor'))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('Could not reveal file: cannot open'),
    )
  })

  it('disables copy and reveal actions when no config path exists', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ClientCard client={buildClient(1, [])} onSync={vi.fn()} onCreateConfig={vi.fn()} />,
    )

    await user.click(screen.getByTestId('client-more-actions-cursor'))

    expect(screen.getByRole('menuitem', { name: 'Copy config path' })).toHaveAttribute(
      'data-disabled',
    )
    expect(screen.getByRole('menuitem', { name: 'Reveal in Explorer' })).toHaveAttribute(
      'data-disabled',
    )
  })
})
