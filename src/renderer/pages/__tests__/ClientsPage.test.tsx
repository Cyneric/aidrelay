import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { ClientsPage } from '../ClientsPage'
import type { SyncResult } from '@shared/types'
import type * as ClientsStoreModule from '@/stores/clients.store'

const detectAllMock = vi.fn<() => Promise<void>>()
const syncClientMock =
  vi.fn<(id: string, options?: { allowCreateConfigIfMissing?: boolean }) => Promise<SyncResult>>()

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
      clients: [
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
      ],
      loading: false,
      error: null,
      detectAll: detectAllMock,
      syncClient: syncClientMock,
    }),
  }
})

describe('ClientsPage sync-all reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        clientsValidateConfig: () => Promise.resolve({ valid: true, errors: [] }),
      },
      writable: true,
      configurable: true,
    })
  })

  it('shows mixed-result summary when sync-all has failures', async () => {
    renderWithProviders(<ClientsPage />)

    fireEvent.click(screen.getByTestId('btn-sync-all'))

    await waitFor(() => {
      expect(syncClientMock).toHaveBeenCalledTimes(2)
      expect(toastWarningMock).toHaveBeenCalled()
    })

    expect(toastWarningMock.mock.calls[0]?.[0]).toContain('Synced 1 of 2 clients (1 failed).')
    expect(toastSuccessMock).not.toHaveBeenCalledWith('All clients synced.')
  })

  it('shows missing-config badge and prompts before creating config on sync', async () => {
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

    expect(screen.getByTestId('client-missing-config-badge-cursor')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-sync-cursor'))

    expect(await screen.findByText('Create new configuration?')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('create-config-confirm'))

    await waitFor(() =>
      expect(syncClientMock).toHaveBeenNthCalledWith(2, 'cursor', {
        allowCreateConfigIfMissing: true,
      }),
    )
  })
})
