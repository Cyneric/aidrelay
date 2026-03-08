import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { DashboardPage } from '../DashboardPage'
import type * as ClientsStoreModule from '@/stores/clients.store'

const detectAllMock = vi.fn<() => Promise<void>>()
const syncClientMock =
  vi.fn<(id: string, options?: { allowCreateConfigIfMissing?: boolean }) => Promise<unknown>>()

const toastErrorMock = vi.fn<(message?: unknown) => void>()
const toastInfoMock = vi.fn<(message?: unknown, options?: unknown) => void>()

vi.mock('sonner', () => ({
  toast: {
    error: (message?: unknown) => toastErrorMock(message),
    info: (message?: unknown, options?: unknown) => toastInfoMock(message, options),
  },
}))

vi.mock('@/stores/clients.store', async (importOriginal) => {
  const actual: typeof ClientsStoreModule = await importOriginal()
  return {
    ...actual,
    useClientsStore: () => ({
      clients: [
        {
          id: 'cursor',
          displayName: 'Cursor',
          installed: true,
          configPaths: ['C:\\Users\\tester\\.cursor\\mcp.json'],
          serverCount: 1,
          syncStatus: 'never-synced',
        },
      ],
      loading: false,
      error: null,
      detectAll: detectAllMock,
      syncClient: syncClientMock,
    }),
  }
})

describe('DashboardPage sync error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    detectAllMock.mockResolvedValue()
    syncClientMock.mockRejectedValue(new Error('sync exploded'))

    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        onConfigChanged: () => () => {},
      },
      writable: true,
      configurable: true,
    })
  })

  it('shows sync error and resets syncing state when sync fails', async () => {
    renderWithProviders(<DashboardPage />)

    fireEvent.click(screen.getByTestId('client-sync-button-cursor'))

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('sync exploded'))
    expect(screen.getByTestId('client-sync-button-cursor')).toHaveTextContent('Sync')
    expect(screen.getByTestId('client-sync-button-cursor')).not.toHaveTextContent('Syncing')
  })

  it('prompts to create config when missing and syncs on confirm', async () => {
    syncClientMock.mockImplementation((_id, options) => {
      if (options?.allowCreateConfigIfMissing) return Promise.resolve(undefined)
      const error = new Error('needs config')
      ;(error as Error & { code?: string }).code = 'config_creation_required'
      return Promise.reject(error)
    })

    renderWithProviders(<DashboardPage />)

    fireEvent.click(screen.getByTestId('client-sync-button-cursor'))

    expect(await screen.findByText('Create new configuration?')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('create-config-confirm'))

    await waitFor(() =>
      expect(syncClientMock).toHaveBeenNthCalledWith(2, 'cursor', {
        allowCreateConfigIfMissing: true,
      }),
    )
  })
})
