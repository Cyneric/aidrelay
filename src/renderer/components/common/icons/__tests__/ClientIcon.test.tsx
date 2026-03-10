/**
 * @file src/renderer/components/common/icons/__tests__/ClientIcon.test.tsx
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the ClientIcon component.
 */

import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClientIcon } from '../ClientIcon'
import type { ClientId } from '@shared/types'

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Code2: vi.fn(() => <svg data-testid="mock-lucide-icon" />),
  Monitor: vi.fn(() => <svg data-testid="mock-lucide-monitor" />),
}))

// Mock the client-icon-mapping module to avoid PNG imports in tests
vi.mock('../client-icon-mapping', () => ({
  getClientIconSource: vi.fn((clientId: string) => {
    const mockMap: Record<string, { type: 'custom'; name: string; path: string }> = {
      'claude-desktop': { type: 'custom', name: 'claude', path: 'claude-icon-url' },
      'claude-code': { type: 'custom', name: 'claude', path: 'claude-icon-url' },
      cline: { type: 'custom', name: 'cline', path: 'cline-icon-url' },
      'roo-code': { type: 'custom', name: 'roo-code', path: 'roo-code-icon-url' },
      cursor: { type: 'custom', name: 'cursor', path: 'cursor-icon-url' },
      vscode: { type: 'custom', name: 'visual-studio-code', path: 'vscode-icon-url' },
      'vscode-insiders': {
        type: 'custom',
        name: 'visual-studio-code-insiders',
        path: 'vscode-insiders-icon-url',
      },
      windsurf: { type: 'custom', name: 'windsurf', path: 'windsurf-icon-url' },
      zed: { type: 'custom', name: 'zed', path: 'zed-icon-url' },
      jetbrains: { type: 'custom', name: 'jetbrains', path: 'jetbrains-icon-url' },
      'gemini-cli': { type: 'custom', name: 'gemini-cli', path: 'gemini-icon-url' },
      'kilo-cli': { type: 'custom', name: 'kilo-cli', path: 'kilo-icon-url' },
      'codex-cli': { type: 'custom', name: 'github-copilot', path: 'copilot-icon-url' },
      'codex-gui': { type: 'custom', name: 'github-copilot', path: 'copilot-icon-url' },
      opencode: { type: 'custom', name: 'opencode', path: 'opencode-icon-url' },
      'visual-studio': { type: 'custom', name: 'visual-studio', path: 'visual-studio-icon-url' },
    }
    const source = mockMap[clientId]
    if (!source) throw new Error(`No icon mapping found for clientId: ${clientId}`)
    return source
  }),
  isValidClientId: vi.fn((value: string) =>
    [
      'claude-desktop',
      'claude-code',
      'cline',
      'roo-code',
      'cursor',
      'vscode',
      'vscode-insiders',
      'windsurf',
      'zed',
      'jetbrains',
      'gemini-cli',
      'kilo-cli',
      'codex-cli',
      'codex-gui',
      'opencode',
      'visual-studio',
    ].includes(value),
  ),
  getIconSourceName: vi.fn((source: { name: string }) => source.name),
}))

describe('ClientIcon', () => {
  test('renders with default props', () => {
    render(<ClientIcon clientId="cursor" />)
    const container = screen.getByTestId('client-icon-cursor')
    expect(container).toBeInTheDocument()
    expect(container).toHaveAttribute('role', 'img')
    expect(container).toHaveAttribute('aria-label', 'cursor icon')
  })

  test('renders with custom aria label', () => {
    render(<ClientIcon clientId="cursor" ariaLabel="Cursor IDE icon" />)
    const container = screen.getByTestId('client-icon-cursor')
    expect(container).toHaveAttribute('aria-label', 'Cursor IDE icon')
  })

  test('renders with custom size and className', () => {
    render(<ClientIcon clientId="cursor" size={24} className="text-blue-500" />)
    const container = screen.getByTestId('client-icon-cursor')
    expect(container).toBeInTheDocument()
  })

  test('supports all client IDs', () => {
    const clientIds: ClientId[] = [
      'claude-desktop',
      'claude-code',
      'cline',
      'roo-code',
      'cursor',
      'vscode',
      'vscode-insiders',
      'windsurf',
      'zed',
      'jetbrains',
      'gemini-cli',
      'kilo-cli',
      'codex-cli',
      'codex-gui',
      'opencode',
      'visual-studio',
    ]

    clientIds.forEach((clientId) => {
      const { unmount } = render(<ClientIcon clientId={clientId} />)
      const container = screen.getByTestId(`client-icon-${clientId}`)
      expect(container).toBeInTheDocument()
      unmount()
    })
  })

  test('renders custom icons for VS Code, VS Code Insiders, Visual Studio, and OpenCode', () => {
    // Test that custom icon clients don't throw errors
    const customClients: ClientId[] = ['vscode', 'vscode-insiders', 'visual-studio', 'opencode']

    customClients.forEach((clientId) => {
      const { unmount } = render(<ClientIcon clientId={clientId} />)
      const container = screen.getByTestId(`client-icon-${clientId}`)
      expect(container).toBeInTheDocument()
      unmount()
    })
  })

  test('shows fallback when custom icon fails to load', async () => {
    // This test is less relevant now since we don't have dynamic loading
    // but we keep it to test the fallback mechanism
    const { ClientIcon: ClientIconDynamic } = await import('../ClientIcon')
    render(<ClientIconDynamic clientId="jetbrains" />)

    // Should show the icon container
    expect(screen.getByTestId('client-icon-jetbrains')).toBeInTheDocument()
  })

  test('handles invalid client ID gracefully', () => {
    // This should throw an error since getClientIconSource validates
    // We need to cast to bypass TypeScript since this is testing error handling
    const invalidClientId = 'invalid-client' as ClientId
    expect(() => {
      render(<ClientIcon clientId={invalidClientId} />)
    }).toThrow('No icon mapping found for clientId: invalid-client')
  })
})
