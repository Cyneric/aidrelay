/**
 * @file src/renderer/components/registry/__tests__/RegistryServerCard.test.tsx
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for RegistryServerCard. Verifies install-button
 * gating behavior for Pro vs. non-Pro users, including remote entries.
 */

import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders, screen } from '@/test-utils'
import { RegistryServerCard } from '../RegistryServerCard'
import type { RegistryServer } from '@shared/channels'

const loadMock = vi.fn().mockResolvedValue(undefined)

vi.mock('@/stores/servers.store', () => ({
  useServersStore: () => ({ load: loadMock }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const remoteServer: RegistryServer = {
  id: '@acme/remote-server',
  displayName: 'Remote Server',
  description: 'Remote MCP endpoint',
  source: 'smithery',
  verified: true,
  useCount: 42,
  remote: true,
}

describe('RegistryServerCard', () => {
  it('keeps remote install enabled when Pro gate is active', () => {
    renderWithProviders(<RegistryServerCard server={remoteServer} canInstall />)

    expect(screen.getByTestId('registry-install-@acme/remote-server')).toBeEnabled()
    expect(screen.getByTestId('registry-availability-badge-@acme/remote-server')).toHaveTextContent(
      'Hosted',
    )
  })

  it('disables install when Pro gate is inactive', () => {
    renderWithProviders(<RegistryServerCard server={remoteServer} canInstall={false} />)

    expect(screen.getByTestId('registry-install-@acme/remote-server')).toBeDisabled()
  })

  it('shows deployable badge for non-hosted registry entries', () => {
    renderWithProviders(
      <RegistryServerCard
        server={{
          ...remoteServer,
          id: '@acme/deployable-server',
          displayName: 'Deployable Server',
          remote: false,
        }}
        canInstall
      />,
    )

    expect(
      screen.getByTestId('registry-availability-badge-@acme/deployable-server'),
    ).toHaveTextContent('Deployable')
  })
})
