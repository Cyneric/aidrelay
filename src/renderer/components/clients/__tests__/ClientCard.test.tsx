import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { ClientCard } from '../ClientCard'
import type { ClientStatus } from '@shared/types'

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

describe('ClientCard', () => {
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

  it('uses "Create config" as primary action when config path is missing', () => {
    const onSync = vi.fn()
    const onCreateConfig = vi.fn()
    renderWithProviders(
      <ClientCard client={buildClient(1, [])} onSync={onSync} onCreateConfig={onCreateConfig} />,
    )

    const primaryButton = screen.getByTestId('client-sync-button-cursor')
    expect(primaryButton).toHaveTextContent('Create config')

    fireEvent.click(primaryButton)
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
})
