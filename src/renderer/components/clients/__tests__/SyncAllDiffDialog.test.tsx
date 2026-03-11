import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { SyncAllDiffDialog } from '../SyncAllDiffDialog'

const filesRevealMock = vi.fn<(path: string) => Promise<void>>()
const writeTextMock = vi.fn<(text: string) => Promise<void>>()

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('SyncAllDiffDialog', () => {
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

  it('shows file-change summary and per-client target path actions', async () => {
    renderWithProviders(
      <SyncAllDiffDialog
        open={true}
        loading={false}
        syncing={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        preview={{
          previews: {
            cursor: {
              clientId: 'cursor',
              configPath: 'C:\\Users\\tester\\.cursor\\mcp.json',
              items: [],
            },
            'codex-cli': {
              clientId: 'codex-cli',
              configPath: 'C:\\Users\\tester\\.codex\\config.json',
              items: [],
            },
          },
        }}
      />,
    )

    expect(screen.getByTestId('sync-all-preview-summary-files')).toHaveTextContent(
      '2 files to be changed',
    )
    expect(screen.getByTestId('sync-all-preview-config-path-cursor-reveal')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sync-all-preview-config-path-copy-cursor'))
    await waitFor(() =>
      expect(writeTextMock).toHaveBeenCalledWith('C:\\Users\\tester\\.cursor\\mcp.json'),
    )
    fireEvent.click(screen.getByTestId('sync-all-preview-config-path-cursor-reveal'))
    await waitFor(() =>
      expect(filesRevealMock).toHaveBeenCalledWith('C:\\Users\\tester\\.cursor\\mcp.json'),
    )
  })
})
