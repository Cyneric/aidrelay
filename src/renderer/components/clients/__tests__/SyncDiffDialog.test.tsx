import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { SyncDiffDialog } from '../SyncDiffDialog'

const filesRevealMock = vi.fn<(path: string) => Promise<void>>()
const writeTextMock = vi.fn<(text: string) => Promise<void>>()
const toastSuccessMock = vi.fn<(message?: unknown) => void>()

vi.mock('sonner', () => ({
  toast: {
    success: (message?: unknown) => toastSuccessMock(message),
    error: vi.fn(),
  },
}))

describe('SyncDiffDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    filesRevealMock.mockResolvedValue(undefined)
    writeTextMock.mockResolvedValue(undefined)
    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        filesReveal: filesRevealMock,
      },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    })
  })

  it('renders target config path with copy and reveal actions', async () => {
    renderWithProviders(
      <SyncDiffDialog
        open={true}
        loading={false}
        syncing={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        preview={{
          clientId: 'codex-cli',
          configPath: 'C:\\Users\\tester\\.codex\\config.json',
          items: [],
        }}
      />,
    )

    expect(screen.getByText('Target file location')).toBeInTheDocument()
    expect(screen.getByText('C:\\Users\\tester\\.codex\\config.json')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('sync-preview-config-path-copy'))
    await waitFor(() =>
      expect(writeTextMock).toHaveBeenCalledWith('C:\\Users\\tester\\.codex\\config.json'),
    )
    expect(toastSuccessMock).toHaveBeenCalledWith('Config path copied to clipboard')

    fireEvent.click(screen.getByTestId('sync-preview-config-path-reveal'))
    await waitFor(() =>
      expect(filesRevealMock).toHaveBeenCalledWith('C:\\Users\\tester\\.codex\\config.json'),
    )
  })

  it('shows ignored summary and explanatory note', () => {
    renderWithProviders(
      <SyncDiffDialog
        open={true}
        loading={false}
        syncing={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        preview={{
          clientId: 'cursor',
          configPath: 'C:\\Users\\tester\\.cursor\\mcp.json',
          items: [
            {
              name: 'ignored-server',
              source: 'modified',
              action: 'ignored',
              before: { command: 'python' },
              after: { command: 'python' },
            },
          ],
        }}
      />,
    )

    expect(screen.getByTestId('sync-preview-summary-ignored')).toHaveTextContent('1 ignored')
    expect(screen.getByTestId('sync-preview-ignore-note')).toBeInTheDocument()
  })
})
