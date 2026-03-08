import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StartupSplash } from '../StartupSplash'

describe('StartupSplash', () => {
  it('renders loading message and progress width', () => {
    render(<StartupSplash progress={42} message="Loading interface..." />)

    expect(screen.getByTestId('startup-splash')).toBeInTheDocument()
    expect(screen.getByTestId('startup-splash-message')).toHaveTextContent('Loading interface...')
    expect(screen.getByTestId('startup-splash-progress')).toHaveStyle({ width: '42%' })
  })
})
