import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen } from '@/test-utils'
import type React from 'react'
import { RegistryPage } from '../RegistryPage'

const loadMock = vi.fn<() => Promise<void>>()

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    'data-testid': testId,
  }: {
    to: string
    children: React.ReactNode
    'data-testid'?: string
  }) => (
    <a href={to} data-testid={testId}>
      {children}
    </a>
  ),
}))

vi.mock('@/stores/servers.store', () => ({
  useServersStore: () => ({
    servers: [{ id: 'local-1' }, { id: 'local-2' }],
    load: loadMock,
  }),
}))

vi.mock('@/components/registry/RegistryBrowser', () => ({
  RegistryBrowser: () => <div data-testid="registry-browser-stub" />,
}))

describe('RegistryPage', () => {
  beforeEach(() => {
    loadMock.mockResolvedValue()
  })

  it('renders the local panel and manage-local CTA', () => {
    renderWithProviders(<RegistryPage />)

    expect(screen.getByTestId('registry-local-panel')).toBeInTheDocument()
    expect(screen.getByText('My Local Servers')).toBeInTheDocument()
    expect(screen.getByText('2 local servers configured')).toBeInTheDocument()
    expect(screen.getByTestId('registry-manage-local-link')).toHaveAttribute('href', '/servers')
  })
})
