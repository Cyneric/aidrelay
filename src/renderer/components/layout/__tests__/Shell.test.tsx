/**
 * @file src/renderer/components/layout/__tests__/Shell.test.tsx
 *
 * @description Regression tests for shell layout overflow behavior.
 * Ensures the app chrome stays fixed and only the main content area scrolls.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Shell } from '../Shell'

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div data-testid="shell-outlet">Outlet</div>,
}))

vi.mock('../Sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar-mock">Sidebar</aside>,
}))

vi.mock('../TitleBar', () => ({
  TitleBar: () => <header data-testid="titlebar-mock">TitleBar</header>,
}))

describe('Shell', () => {
  it('renders shell chrome and outlet content', () => {
    render(<Shell />)

    expect(screen.getByTestId('shell')).toBeInTheDocument()
    expect(screen.getByTestId('titlebar-mock')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument()
    expect(screen.getByTestId('shell-outlet')).toBeInTheDocument()
  })

  it('uses fixed chrome and single content scroll container classes', () => {
    render(<Shell />)

    const shell = screen.getByTestId('shell')
    expect(shell).toHaveClass('h-screen', 'min-h-0', 'overflow-hidden')

    const main = screen.getByRole('main')
    expect(main).toHaveClass(
      'relative',
      'z-0',
      'flex-1',
      'min-h-0',
      'overflow-y-auto',
      'overflow-x-hidden',
    )

    const contentRow = main.parentElement
    expect(contentRow).toHaveClass('flex', 'flex-1', 'min-h-0', 'overflow-hidden')
  })
})
