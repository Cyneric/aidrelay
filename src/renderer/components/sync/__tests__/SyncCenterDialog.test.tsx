import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, waitFor } from '@/test-utils'
import { SyncCenterDialog } from '../SyncCenterDialog'

const mockState = vi.hoisted(() => ({
  listPendingMock: vi.fn<() => Promise<unknown[]>>(),
  listConflictsMock: vi.fn<() => Promise<unknown[]>>(),
  pushReviewMock: vi.fn<() => Promise<unknown[]>>(),
  previewOutgoingMock: vi.fn(),
  applyPendingMock: vi.fn(),
  resolveConflictMock: vi.fn(),
  generateReportMock: vi.fn(),
}))

const listPendingMock = mockState.listPendingMock
const listConflictsMock = mockState.listConflictsMock
const pushReviewMock = mockState.pushReviewMock
const previewOutgoingMock = mockState.previewOutgoingMock
const generateReportMock = mockState.generateReportMock

vi.mock('@/services/sync.service', () => ({
  syncService: {
    listPending: mockState.listPendingMock,
    listConflicts: mockState.listConflictsMock,
    pushReview: mockState.pushReviewMock,
    previewOutgoing: mockState.previewOutgoingMock,
    applyPending: mockState.applyPendingMock,
    resolveConflict: mockState.resolveConflictMock,
  },
}))

vi.mock('@/services/diagnostics.service', () => ({
  diagnosticsService: {
    generateReport: mockState.generateReportMock,
  },
}))

describe('SyncCenterDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPendingMock.mockResolvedValue([])
    listConflictsMock.mockResolvedValue([])
    pushReviewMock.mockResolvedValue([])
    previewOutgoingMock.mockResolvedValue({
      scope: { kind: 'app' },
      generatedAt: '2026-03-29T12:00:00.000Z',
      entries: [
        {
          id: 'entry-1',
          path: 'C:\\Users\\tester\\.cursor\\mcp.json',
          feature: 'mcp-config',
          origin: 'client-sync',
          action: 'create',
          clientId: 'cursor',
          clientName: 'Cursor',
          detail: {
            kind: 'mcp',
            items: [
              {
                name: 'filesystem',
                source: 'added',
                action: 'create',
                before: null,
                after: { command: 'npx' },
              },
            ],
          },
        },
      ],
      blockers: [],
      totalFiles: 1,
      createCount: 1,
      modifyCount: 0,
      removeCount: 0,
      confirmable: true,
    })
    generateReportMock.mockResolvedValue({ ok: true })
  })

  it('shows outgoing writes in inspection mode with summary badges and file actions', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SyncCenterDialog open={true} onOpenChange={vi.fn()} />)

    await waitFor(() => expect(previewOutgoingMock).toHaveBeenCalledWith({ kind: 'app' }))

    await user.click(screen.getByTestId('dialog-tab-outgoing-writes'))

    expect(await screen.findByTestId('sync-plan-view')).toBeInTheDocument()
    expect(screen.getByTestId('sync-plan-summary-total')).toHaveTextContent('1')
    expect(screen.getByTestId('sync-plan-summary-create')).toHaveTextContent('1')
    expect(screen.getByTestId('sync-plan-file-0')).toBeInTheDocument()
    expect(screen.getByTestId('sync-plan-file-path-0-reveal')).toBeInTheDocument()
    expect(screen.getByTestId('sync-plan-file-copy-0')).toBeInTheDocument()
    expect(screen.getByText('C:\\Users\\tester\\.cursor\\mcp.json')).toBeInTheDocument()
  })
})
