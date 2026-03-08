/**
 * @file src/renderer/components/registry/__tests__/RegistryBrowser.test.tsx
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for RegistryBrowser provider and availability filters.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderWithProviders, screen, waitFor, act } from '@/test-utils'
import userEvent from '@testing-library/user-event'
import { RegistryBrowser } from '../RegistryBrowser'
import type { RegistryServer } from '@shared/channels'

vi.mock('@/lib/useFeatureGate', () => ({
  useFeatureGate: () => true,
}))

vi.mock('../RegistryServerCard', () => ({
  RegistryServerCard: ({
    server,
  }: {
    server: { id: string; displayName: string; remote: boolean; source: string }
  }) => (
    <div data-testid={`mock-card-${server.id}`}>
      {server.displayName} [{server.source}] {server.remote ? 'hosted' : 'deployable'}
    </div>
  ),
}))

const smitheryResults: RegistryServer[] = [
  {
    id: 'local-server',
    displayName: 'Local Server',
    description: '',
    source: 'smithery',
    verified: false,
    remote: false,
  },
  {
    id: 'remote-server',
    displayName: 'Remote Server',
    description: '',
    source: 'smithery',
    verified: true,
    remote: true,
  },
]

const officialResults: RegistryServer[] = [
  {
    id: 'official-remote',
    displayName: 'Official Remote',
    description: '',
    source: 'official',
    verified: true,
    remote: true,
  },
]

describe('RegistryBrowser', () => {
  const registrySearchMock =
    vi.fn<(provider: 'smithery' | 'official', query: string) => Promise<RegistryServer[]>>()

  beforeEach(() => {
    registrySearchMock.mockReset()
    ;(window.api as unknown as { registrySearch: typeof registrySearchMock }).registrySearch =
      registrySearchMock
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const waitForDebounce = async (): Promise<void> => {
    await act(
      async () =>
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 350)
        }),
    )
  }

  it('shows all results by default', async () => {
    registrySearchMock.mockResolvedValue(smitheryResults)
    const user = userEvent.setup()

    renderWithProviders(<RegistryBrowser />)

    await user.type(screen.getByTestId('registry-search'), 'git')
    await waitForDebounce()

    expect(screen.getByRole('button', { name: 'Deployable' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hosted' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Local Server/)).toBeInTheDocument())
    expect(screen.getByText(/Remote Server/)).toBeInTheDocument()
    expect(registrySearchMock).toHaveBeenLastCalledWith('smithery', 'git')
  })

  it('filters to deployable results', async () => {
    registrySearchMock.mockResolvedValue(smitheryResults)
    const user = userEvent.setup()

    renderWithProviders(<RegistryBrowser />)
    await user.type(screen.getByTestId('registry-search'), 'git')
    await waitForDebounce()

    await user.click(screen.getByTestId('registry-availability-deployable'))

    expect(screen.getByText(/Local Server/)).toBeInTheDocument()
    expect(screen.queryByText(/Remote Server/)).not.toBeInTheDocument()
  })

  it('filters to hosted results', async () => {
    registrySearchMock.mockResolvedValue(smitheryResults)
    const user = userEvent.setup()

    renderWithProviders(<RegistryBrowser />)
    await user.type(screen.getByTestId('registry-search'), 'git')
    await waitForDebounce()

    await user.click(screen.getByTestId('registry-availability-hosted'))

    expect(screen.getByText(/Remote Server/)).toBeInTheDocument()
    expect(screen.queryByText(/Local Server/)).not.toBeInTheDocument()
  })

  it('re-queries and renders official provider results', async () => {
    registrySearchMock.mockImplementation((provider) =>
      Promise.resolve(provider === 'official' ? officialResults : smitheryResults),
    )
    const user = userEvent.setup()

    renderWithProviders(<RegistryBrowser />)
    await user.type(screen.getByTestId('registry-search'), 'github')
    await waitForDebounce()

    await waitFor(() => expect(screen.getByText(/Local Server/)).toBeInTheDocument())

    await user.click(screen.getByTestId('registry-provider-official'))
    await waitForDebounce()

    await waitFor(() => expect(screen.getByText(/Official Remote/)).toBeInTheDocument())
    expect(screen.queryByText(/Local Server/)).not.toBeInTheDocument()
    expect(registrySearchMock).toHaveBeenLastCalledWith('official', 'github')
  })
})
