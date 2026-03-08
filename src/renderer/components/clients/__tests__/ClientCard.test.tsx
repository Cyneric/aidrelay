import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { ClientCard } from '../ClientCard'
import type { ClientStatus } from '@shared/types'

const buildClient = (serverCount: number): ClientStatus => ({
  id: 'cursor',
  displayName: 'Cursor',
  installed: true,
  configPaths: ['C:/cursor/settings.json'],
  serverCount,
  syncStatus: 'synced',
  lastSyncedAt: '2026-03-01T10:00:00.000Z',
})

describe('ClientCard', () => {
  it('renders MCP server count in singular form', () => {
    renderWithProviders(<ClientCard client={buildClient(1)} onSync={vi.fn()} />)
    expect(screen.getByTestId('client-server-count-cursor')).toHaveTextContent('1 MCP Server')
  })

  it('renders MCP server count in plural form', () => {
    renderWithProviders(<ClientCard client={buildClient(2)} onSync={vi.fn()} />)
    expect(screen.getByTestId('client-server-count-cursor')).toHaveTextContent('2 MCP Servers')
  })

  it('falls back to 0 MCP Servers for invalid count values', () => {
    renderWithProviders(<ClientCard client={buildClient(Number.NaN)} onSync={vi.fn()} />)
    expect(screen.getByTestId('client-server-count-cursor')).toHaveTextContent('0 MCP Servers')
  })
})
