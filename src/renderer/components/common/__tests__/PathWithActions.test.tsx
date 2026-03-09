import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { PathWithActions } from '../PathWithActions'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea
      data-testid="monaco-editor"
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))

describe('PathWithActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'confirm', {
      value: vi.fn(() => true),
      configurable: true,
      writable: true,
    })
    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        filesReveal: vi.fn(() => Promise.resolve()),
        filesReadText: vi.fn(() =>
          Promise.resolve({
            content: 'hello',
            mtimeMs: 100,
            size: 5,
            encoding: 'utf-8',
          }),
        ),
        filesWriteText: vi.fn(() => Promise.resolve({ mtimeMs: 200 })),
      },
      configurable: true,
      writable: true,
    })
  })

  it('reveals a path in explorer', async () => {
    renderWithProviders(<PathWithActions path={'C:\\tmp\\config.json'} />)

    fireEvent.click(screen.getByTestId('path-action-reveal'))

    await waitFor(() => expect(window.api.filesReveal).toHaveBeenCalledWith('C:\\tmp\\config.json'))
  })

  it('opens editor and saves file changes', async () => {
    renderWithProviders(<PathWithActions path={'C:\\tmp\\config.json'} />)

    fireEvent.click(screen.getByTestId('path-action-edit'))

    expect(await screen.findByText('Edit file')).toBeInTheDocument()
    const editor = await screen.findByTestId('monaco-editor')
    fireEvent.change(editor, { target: { value: 'updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(window.api.filesWriteText).toHaveBeenCalledWith(
        'C:\\tmp\\config.json',
        'updated',
        100,
      ),
    )
  })

  it('shows conflict message when write fails with conflict', async () => {
    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        filesReadText: vi.fn(() =>
          Promise.resolve({
            content: 'hello',
            mtimeMs: 100,
            size: 5,
            encoding: 'utf-8',
          }),
        ),
        filesWriteText: vi.fn(() => Promise.reject(new Error('[file_conflict] stale'))),
      },
      configurable: true,
      writable: true,
    })

    renderWithProviders(<PathWithActions path={'C:\\tmp\\config.json'} />)

    fireEvent.click(screen.getByTestId('path-action-edit'))
    const editor = await screen.findByTestId('monaco-editor')
    fireEvent.change(editor, { target: { value: 'updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('The file changed on disk. Reload and try saving again.'),
    ).toBeInTheDocument()
  })
})
