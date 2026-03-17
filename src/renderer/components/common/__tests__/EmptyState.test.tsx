import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { Server } from 'lucide-react'
import { renderWithProviders } from '@/test-utils'
import { EmptyState } from '../EmptyState'

describe('EmptyState', () => {
  it('renders the title', () => {
    renderWithProviders(<EmptyState title="No servers yet" />)

    expect(screen.getByText('No servers yet')).toBeInTheDocument()
  })

  it('renders the description when provided', () => {
    renderWithProviders(<EmptyState title="Empty" description="Add a server to get started." />)

    expect(screen.getByText('Add a server to get started.')).toBeInTheDocument()
  })

  it('does not render a description paragraph when omitted', () => {
    renderWithProviders(<EmptyState title="Empty" />)

    const container = screen.getByTestId('empty-state')
    // Title paragraph only, no description
    expect(container.querySelectorAll('p')).toHaveLength(1)
  })

  it('renders an icon when provided', () => {
    renderWithProviders(<EmptyState icon={Server} title="No servers" />)

    const container = screen.getByTestId('empty-state')
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders the primary action button and fires onClick', () => {
    const handleClick = vi.fn()
    renderWithProviders(
      <EmptyState title="Empty" action={{ label: 'Add Server', onClick: handleClick }} />,
    )

    const button = screen.getByTestId('empty-state-action')
    expect(button).toHaveTextContent('Add Server')

    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('renders the secondary action button and fires onClick', () => {
    const handlePrimary = vi.fn()
    const handleSecondary = vi.fn()
    renderWithProviders(
      <EmptyState
        title="Empty"
        action={{ label: 'Add', onClick: handlePrimary }}
        secondaryAction={{ label: 'Browse Registry', onClick: handleSecondary }}
      />,
    )

    const secondary = screen.getByTestId('empty-state-secondary-action')
    expect(secondary).toHaveTextContent('Browse Registry')

    fireEvent.click(secondary)
    expect(handleSecondary).toHaveBeenCalledOnce()
  })

  it('does not render action buttons when none are provided', () => {
    renderWithProviders(<EmptyState title="Nothing here" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('uses a custom testId when provided', () => {
    renderWithProviders(<EmptyState title="Custom" testId="custom-empty" />)

    expect(screen.getByTestId('custom-empty')).toBeInTheDocument()
  })
})
