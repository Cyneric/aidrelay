import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { PageHeader } from '../PageHeader'

describe('PageHeader', () => {
  it('renders the title', () => {
    renderWithProviders(<PageHeader title="Dashboard" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  it('renders the subtitle when provided', () => {
    renderWithProviders(<PageHeader title="Servers" subtitle="Manage your MCP servers" />)

    expect(screen.getByText('Manage your MCP servers')).toBeInTheDocument()
  })

  it('does not render a subtitle paragraph when omitted', () => {
    renderWithProviders(<PageHeader title="Settings" />)

    const header = screen.getByTestId('page-header')
    expect(header.querySelectorAll('p')).toHaveLength(0)
  })

  it('renders actions in the right slot', () => {
    renderWithProviders(<PageHeader title="Servers" actions={<button>Add Server</button>} />)

    expect(screen.getByRole('button', { name: 'Add Server' })).toBeInTheDocument()
  })

  it('applies sticky classes when sticky is true', () => {
    renderWithProviders(<PageHeader title="Dashboard" sticky />)

    const header = screen.getByTestId('page-header')
    expect(header.className).toContain('sticky')
    expect(header.className).toContain('backdrop-blur')
  })

  it('does not apply sticky classes by default', () => {
    renderWithProviders(<PageHeader title="Settings" />)

    const header = screen.getByTestId('page-header')
    expect(header.className).not.toContain('sticky')
  })

  it('sets the id on the heading for aria-labelledby linkage', () => {
    renderWithProviders(<PageHeader id="page-title" title="Rules" />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('id', 'page-title')
  })

  it('uses a custom testId when provided', () => {
    renderWithProviders(<PageHeader title="Custom" testId="custom-header" />)

    expect(screen.getByTestId('custom-header')).toBeInTheDocument()
  })
})
