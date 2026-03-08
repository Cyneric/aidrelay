import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientStatus, SyncResult } from '@shared/types'
import { useClientsStore } from '../clients.store'

const baseClient: ClientStatus = {
  id: 'cursor',
  displayName: 'Cursor',
  installed: true,
  configPaths: ['C:\\Users\\tester\\.cursor\\mcp.json'],
  serverCount: 1,
  syncStatus: 'never-synced',
}

describe('clients.store syncClient()', () => {
  beforeEach(() => {
    useClientsStore.setState({
      clients: [baseClient],
      loading: false,
      error: null,
    })
  })

  it('throws when backend sync returns success=false and still refreshes detection state', async () => {
    const clientsSync = vi
      .fn<
        (
          id: ClientStatus['id'],
          options?: { allowCreateConfigIfMissing?: boolean },
        ) => Promise<SyncResult>
      >()
      .mockResolvedValue({
        clientId: 'cursor',
        success: false,
        serversWritten: 0,
        error: 'sync failed',
        syncedAt: '2026-03-08T10:00:00.000Z',
      })
    const clientsDetectAll = vi
      .fn<() => Promise<ClientStatus[]>>()
      .mockResolvedValue([{ ...baseClient, syncStatus: 'error' }])

    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        clientsSync,
        clientsDetectAll,
      },
      writable: true,
      configurable: true,
    })

    await expect(useClientsStore.getState().syncClient('cursor')).rejects.toThrow('sync failed')
    expect(clientsSync).toHaveBeenCalledWith('cursor', undefined)
    expect(clientsDetectAll).toHaveBeenCalledTimes(1)
    expect(useClientsStore.getState().clients[0]?.syncStatus).toBe('error')
  })

  it('returns SyncResult on success and refreshes state', async () => {
    const successResult: SyncResult = {
      clientId: 'cursor',
      success: true,
      serversWritten: 2,
      syncedAt: '2026-03-08T10:05:00.000Z',
    }
    const clientsSync = vi
      .fn<
        (
          id: ClientStatus['id'],
          options?: { allowCreateConfigIfMissing?: boolean },
        ) => Promise<SyncResult>
      >()
      .mockResolvedValue(successResult)
    const clientsDetectAll = vi
      .fn<() => Promise<ClientStatus[]>>()
      .mockResolvedValue([
        { ...baseClient, syncStatus: 'synced', lastSyncedAt: successResult.syncedAt },
      ])

    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        clientsSync,
        clientsDetectAll,
      },
      writable: true,
      configurable: true,
    })

    const result = await useClientsStore.getState().syncClient('cursor')
    expect(result).toEqual(successResult)
    expect(useClientsStore.getState().clients[0]?.syncStatus).toBe('synced')
  })
})
