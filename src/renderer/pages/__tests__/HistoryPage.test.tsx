import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { HistoryPage } from '../HistoryPage'
import type { BackupEntry, BackupQueryFilters } from '@shared/channels'
import type { ClientStatus } from '@shared/types'

const clientsFixture: ClientStatus[] = [
  {
    id: 'cursor',
    displayName: 'Cursor',
    installed: true,
    configPaths: ['C:\\cursor\\mcp.json'],
    serverCount: 2,
    syncStatus: 'synced',
  },
  {
    id: 'vscode',
    displayName: 'VS Code',
    installed: true,
    configPaths: ['C:\\vscode\\mcp.json'],
    serverCount: 2,
    syncStatus: 'synced',
  },
]

const makeEntry = (
  id: number,
  clientId: 'cursor' | 'vscode',
  backupType: BackupEntry['backupType'],
  createdAt: string,
): BackupEntry => ({
  id,
  clientId,
  backupPath: `C:\\backups\\${clientId}\\backup-${id}.json`,
  backupType,
  createdAt,
  fileSize: 1200 + id,
  fileHash: `hash-${id}`,
})

const cursorEntries = Array.from({ length: 30 }, (_, index) =>
  makeEntry(
    index + 1,
    'cursor',
    index % 2 === 0 ? 'sync' : 'manual',
    new Date(Date.UTC(2026, 2, 10, 10, 0, index)).toISOString(),
  ),
)
const vscodeEntries = [
  makeEntry(200, 'vscode', 'pristine', new Date('2026-03-09T12:00:00.000Z').toISOString()),
]
const allEntries = [...cursorEntries, ...vscodeEntries]

const applyQuery = (filters: BackupQueryFilters): { items: BackupEntry[]; total: number } => {
  const sort = filters.sort ?? 'newest'
  const limit = filters.limit ?? 25
  const offset = filters.offset ?? 0
  const search = filters.search?.toLowerCase().trim()

  let items = allEntries.filter((entry) => {
    if (filters.clientId && entry.clientId !== filters.clientId) return false
    if (
      search &&
      !entry.backupPath.toLowerCase().includes(search) &&
      !entry.clientId.toLowerCase().includes(search)
    ) {
      return false
    }
    if (filters.types && filters.types.length > 0 && !filters.types.includes(entry.backupType)) {
      return false
    }
    if (filters.from && entry.createdAt < filters.from) return false
    if (filters.to && entry.createdAt > filters.to) return false
    return true
  })

  items = [...items].sort((a, b) =>
    sort === 'oldest'
      ? a.createdAt.localeCompare(b.createdAt)
      : b.createdAt.localeCompare(a.createdAt),
  )

  return {
    total: items.length,
    items: items.slice(offset, offset + limit),
  }
}

describe('HistoryPage', () => {
  const backupsQueryMock = vi.fn((filters: BackupQueryFilters) =>
    Promise.resolve(applyQuery(filters)),
  )
  const backupsPreviewRestoreMock = vi.fn(() =>
    Promise.resolve({
      clientId: 'cursor',
      backupPath: 'C:\\backups\\cursor\\backup-1.json',
      liveConfigPath: 'C:\\cursor\\mcp.json',
      hasLiveConfig: true,
      mode: 'json' as const,
      added: 1,
      removed: 0,
      changed: 1,
      totalChanges: 2,
      blocks: [
        {
          path: 'mcpServers.alpha',
          kind: 'changed' as const,
          before: '{}',
          after: '{"enabled":true}',
        },
      ],
      truncated: false,
    }),
  )
  const backupsRestoreMock = vi.fn(() => Promise.resolve())

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        clientsDetectAll: vi.fn(() => Promise.resolve(clientsFixture)),
        backupsQuery: backupsQueryMock,
        backupsPreviewRestore: backupsPreviewRestoreMock,
        backupsRestore: backupsRestoreMock,
      },
      writable: true,
      configurable: true,
    })
  })

  it('loads first page and supports load-more pagination', async () => {
    renderWithProviders(<HistoryPage />)

    expect(await screen.findByTestId('client-history-cursor')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByTestId(/backup-entry-/)).toHaveLength(26))
    expect(screen.queryByTestId('backup-path-30-edit')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('history-load-more-cursor'))
    await waitFor(() => expect(screen.getAllByTestId(/backup-entry-/)).toHaveLength(31))
  })

  it('keeps collapsed state across filter changes', async () => {
    renderWithProviders(<HistoryPage />)

    const cursorCard = await screen.findByTestId('client-history-cursor')
    const toggleButton = within(cursorCard).getAllByRole('button')[0]!
    fireEvent.click(toggleButton)
    expect(screen.queryByTestId('backup-timeline-cursor')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('history-type-sync'))
    await waitFor(() => {
      const cardAfterFilter = screen.getByTestId('client-history-cursor')
      expect(
        within(cardAfterFilter).queryByTestId('backup-timeline-cursor'),
      ).not.toBeInTheDocument()
    })
  })

  it('shows restore preview and restores only after confirmation', async () => {
    renderWithProviders(<HistoryPage />)

    expect(await screen.findByTestId('btn-restore-30')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-restore-30'))

    const dialog = await screen.findByTestId('history-restore-dialog')
    await waitFor(() => expect(backupsPreviewRestoreMock).toHaveBeenCalled())
    expect(backupsRestoreMock).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Restore' })[0]!)
    await waitFor(() => expect(backupsRestoreMock).toHaveBeenCalledTimes(1))
  })
})
