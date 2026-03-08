import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test-utils'
import { ScopeToggle } from '../ScopeToggle'

describe('ScopeToggle', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      value: {
        showOpenDialog: vi
          .fn()
          .mockResolvedValue({ canceled: false, filePaths: ['C:\\workspace'] }),
      },
      writable: true,
      configurable: true,
    })
  })

  it('renders localized labels and reflects active state', () => {
    renderWithProviders(
      <ScopeToggle
        scope="global"
        onScopeChange={vi.fn()}
        projectPath=""
        onProjectPathChange={vi.fn()}
      />,
    )

    const globalTrigger = screen.getByTestId('scope-global')
    const projectTrigger = screen.getByTestId('scope-project')

    expect(globalTrigger).toHaveTextContent('Global rules')
    expect(projectTrigger).toHaveTextContent('Project rules')
    expect(globalTrigger).toHaveAttribute('data-state', 'active')
  })

  it('calls onScopeChange when clicking project tab', async () => {
    const user = userEvent.setup()
    const onScopeChange = vi.fn()

    renderWithProviders(
      <ScopeToggle
        scope="global"
        onScopeChange={onScopeChange}
        projectPath=""
        onProjectPathChange={vi.fn()}
      />,
    )

    await user.click(screen.getByTestId('scope-project'))
    expect(onScopeChange).toHaveBeenCalledWith('project')
  })

  it('supports keyboard navigation with arrow keys', async () => {
    const user = userEvent.setup()
    const onScopeChange = vi.fn()

    renderWithProviders(
      <ScopeToggle
        scope="global"
        onScopeChange={onScopeChange}
        projectPath=""
        onProjectPathChange={vi.fn()}
      />,
    )

    await user.tab()
    await user.keyboard('{ArrowRight}')
    expect(onScopeChange).toHaveBeenCalledWith('project')
  })

  it('shows project path controls only when project scope is active', () => {
    const { rerender } = renderWithProviders(
      <ScopeToggle
        scope="global"
        onScopeChange={vi.fn()}
        projectPath=""
        onProjectPathChange={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('scope-project-path')).not.toBeInTheDocument()

    rerender(
      <ScopeToggle
        scope="project"
        onScopeChange={vi.fn()}
        projectPath="C:\\dev\\my-project"
        onProjectPathChange={vi.fn()}
      />,
    )

    expect(screen.getByTestId('scope-project-path')).toBeInTheDocument()
    expect(screen.getByTestId('scope-project-browse')).toBeInTheDocument()
  })

  it('invokes browse dialog and forwards selected path', async () => {
    const user = userEvent.setup()
    const onProjectPathChange = vi.fn()

    renderWithProviders(
      <ScopeToggle
        scope="project"
        onScopeChange={vi.fn()}
        projectPath=""
        onProjectPathChange={onProjectPathChange}
      />,
    )

    await user.click(screen.getByTestId('scope-project-browse'))

    expect(window.api.showOpenDialog).toHaveBeenCalled()
    expect(onProjectPathChange).toHaveBeenCalledWith('C:\\workspace')
  })
})
