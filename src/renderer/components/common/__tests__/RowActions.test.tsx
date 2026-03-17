import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { renderWithProviders } from '@/test-utils'
import { RowActions } from '../RowActions'

describe('RowActions', () => {
  it('renders the primary action button with label and icon', () => {
    const handleClick = vi.fn()
    renderWithProviders(
      <RowActions
        primaryAction={{ label: 'Sync', icon: RefreshCw, onClick: handleClick }}
        menuItems={[]}
      />,
    )

    const button = screen.getByTestId('row-actions-primary')
    expect(button).toHaveTextContent('Sync')

    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('disables the primary action when disabled is true', () => {
    renderWithProviders(
      <RowActions
        primaryAction={{ label: 'Sync', icon: RefreshCw, onClick: vi.fn(), disabled: true }}
        menuItems={[]}
      />,
    )

    expect(screen.getByTestId('row-actions-primary')).toBeDisabled()
  })

  it('disables the primary action when loading is true', () => {
    renderWithProviders(
      <RowActions
        primaryAction={{ label: 'Sync', icon: RefreshCw, onClick: vi.fn(), loading: true }}
        menuItems={[]}
      />,
    )

    expect(screen.getByTestId('row-actions-primary')).toBeDisabled()
  })

  it('renders the menu trigger when menuItems are provided', () => {
    renderWithProviders(
      <RowActions menuItems={[{ label: 'Edit', icon: Pencil, onClick: vi.fn() }]} />,
    )

    expect(screen.getByTestId('row-actions-menu-trigger')).toBeInTheDocument()
  })

  it('does not render the menu trigger when menuItems is empty', () => {
    renderWithProviders(
      <RowActions
        primaryAction={{ label: 'Sync', icon: RefreshCw, onClick: vi.fn() }}
        menuItems={[]}
      />,
    )

    expect(screen.queryByTestId('row-actions-menu-trigger')).not.toBeInTheDocument()
  })

  it('opens the dropdown and shows menu items when trigger is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RowActions
        menuItems={[
          { label: 'Edit', icon: Pencil, onClick: vi.fn() },
          { label: 'Delete', icon: Trash2, onClick: vi.fn(), destructive: true },
        ]}
      />,
    )

    await user.click(screen.getByTestId('row-actions-menu-trigger'))

    expect(await screen.findByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('fires onClick when a menu item is selected', async () => {
    const user = userEvent.setup()
    const handleEdit = vi.fn()
    renderWithProviders(
      <RowActions menuItems={[{ label: 'Edit', icon: Pencil, onClick: handleEdit }]} />,
    )

    await user.click(screen.getByTestId('row-actions-menu-trigger'))
    await user.click(await screen.findByText('Edit'))

    expect(handleEdit).toHaveBeenCalledOnce()
  })

  it('renders both primary action and menu trigger together', () => {
    renderWithProviders(
      <RowActions
        primaryAction={{ label: 'Sync', icon: RefreshCw, onClick: vi.fn() }}
        menuItems={[{ label: 'Edit', onClick: vi.fn() }]}
      />,
    )

    expect(screen.getByTestId('row-actions-primary')).toBeInTheDocument()
    expect(screen.getByTestId('row-actions-menu-trigger')).toBeInTheDocument()
  })

  it('uses a custom testId when provided', () => {
    renderWithProviders(
      <RowActions testId="custom-actions" menuItems={[{ label: 'Test', onClick: vi.fn() }]} />,
    )

    expect(screen.getByTestId('custom-actions')).toBeInTheDocument()
  })
})
