/**
 * @file src/renderer/components/rules/__tests__/ImportRulesDialog.test.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the ImportRulesDialog component. Mocks the
 * window.api bridge and the rules store.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { ImportRulesDialog } from '../ImportRulesDialog'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLoad = vi.fn()

vi.mock('@/stores/rules.store', () => ({
  useRulesStore: () => ({ load: mockLoad }),
}))

const mockDetectWorkspaces = vi.fn<() => Promise<string[]>>()
const mockImportFromProject =
  vi.fn<(p: string) => Promise<{ imported: number; skipped: number; errors: string[] }>>()

beforeEach(() => {
  vi.clearAllMocks()
  mockDetectWorkspaces.mockResolvedValue([])
  mockImportFromProject.mockResolvedValue({ imported: 0, skipped: 0, errors: [] })

  Object.defineProperty(window, 'api', {
    value: {
      rulesDetectWorkspaces: mockDetectWorkspaces,
      rulesImportFromProject: mockImportFromProject,
    },
    writable: true,
    configurable: true,
  })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ImportRulesDialog', () => {
  it('renders the dialog with heading', async () => {
    renderWithProviders(<ImportRulesDialog onClose={vi.fn()} />)
    await waitFor(() => expect(screen.queryByText('Detecting recent workspaces…')).toBeNull())
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Import rules from project')).toBeTruthy()
  })

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn()
    renderWithProviders(<ImportRulesDialog onClose={onClose} />)
    await waitFor(() => expect(mockDetectWorkspaces).toHaveBeenCalled())
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when cancel button is clicked', async () => {
    const onClose = vi.fn()
    renderWithProviders(<ImportRulesDialog onClose={onClose} />)
    await waitFor(() => expect(mockDetectWorkspaces).toHaveBeenCalled())
    fireEvent.click(screen.getByTestId('import-dialog-cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows workspace select trigger when workspaces are detected', async () => {
    mockDetectWorkspaces.mockResolvedValue(['C:\\proj\\a', 'C:\\proj\\b'])
    renderWithProviders(<ImportRulesDialog onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('workspace-select')).toBeTruthy())
    expect(screen.getByTestId('workspace-select')).toBeInTheDocument()
  })

  it('shows scan result in preview after scanning', async () => {
    mockDetectWorkspaces.mockResolvedValue([])
    mockImportFromProject.mockResolvedValue({ imported: 3, skipped: 1, errors: [] })

    renderWithProviders(<ImportRulesDialog onClose={vi.fn()} />)
    await waitFor(() => expect(mockDetectWorkspaces).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('custom-path-input'), {
      target: { value: 'C:\\my-project' },
    })
    fireEvent.click(screen.getByTestId('scan-button'))

    await waitFor(() => expect(screen.getByTestId('import-preview')).toBeTruthy())
    expect(screen.getByTestId('import-preview').textContent).toContain('3')
  })

  it('disables import button when scan found 0 rules', async () => {
    mockImportFromProject.mockResolvedValue({ imported: 0, skipped: 0, errors: [] })

    renderWithProviders(<ImportRulesDialog onClose={vi.fn()} />)
    await waitFor(() => expect(mockDetectWorkspaces).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('custom-path-input'), {
      target: { value: 'C:\\empty-project' },
    })
    fireEvent.click(screen.getByTestId('scan-button'))

    await waitFor(() => expect(screen.getByTestId('import-preview')).toBeTruthy())

    const btn = screen.getByTestId<HTMLButtonElement>('import-confirm-button')
    expect(btn.disabled).toBe(true)
  })

  it('calls load and onClose after successful import', async () => {
    mockImportFromProject.mockResolvedValue({ imported: 2, skipped: 0, errors: [] })
    const onClose = vi.fn()

    renderWithProviders(<ImportRulesDialog onClose={onClose} />)
    await waitFor(() => expect(mockDetectWorkspaces).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('custom-path-input'), {
      target: { value: 'C:\\project' },
    })
    fireEvent.click(screen.getByTestId('scan-button'))
    await waitFor(() => expect(screen.getByTestId('import-preview')).toBeTruthy())

    fireEvent.click(screen.getByTestId('import-confirm-button'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(mockLoad).toHaveBeenCalled()
  })
})
