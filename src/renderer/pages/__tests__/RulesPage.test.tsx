import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, within } from '@/test-utils'
import { RulesPage } from '../RulesPage'
import type { AiRule } from '@shared/types'

const mockLoadRules = vi.fn<() => Promise<void>>()
const mockDeleteRule = vi.fn<(id: string) => Promise<void>>()
const mockToggleRuleEnabled = vi.fn<(id: string) => Promise<void>>()

const rules: AiRule[] = [
  {
    id: 'rule-global',
    name: 'Global Rule',
    description: 'global',
    content: 'Always do X.',
    category: 'coding',
    tags: [],
    enabled: true,
    priority: 'normal',
    scope: 'global',
    fileGlobs: [],
    alwaysApply: true,
    clientOverrides: {} as AiRule['clientOverrides'],
    tokenEstimate: 120,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-project',
    name: 'Project Rule',
    description: 'project',
    content: 'Project only.',
    category: 'coding',
    tags: [],
    enabled: true,
    priority: 'normal',
    scope: 'project',
    projectPath: 'C:\\workspace',
    fileGlobs: [],
    alwaysApply: true,
    clientOverrides: {} as AiRule['clientOverrides'],
    tokenEstimate: 2_190,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

vi.mock('@/stores/rules.store', () => ({
  useRulesStore: () => ({
    rules,
    loading: false,
    error: null,
    load: mockLoadRules,
    delete: mockDeleteRule,
    toggleEnabled: mockToggleRuleEnabled,
  }),
}))

describe('RulesPage scope badge colors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadRules.mockResolvedValue()
    mockDeleteRule.mockResolvedValue()
    mockToggleRuleEnabled.mockResolvedValue()
  })

  it('uses teal classes for project scope badge and no violet classes', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RulesPage />)

    await user.click(screen.getByTestId('scope-project'))

    const projectRow = await screen.findByTestId('rule-row-rule-project')
    const projectScopeBadge = within(projectRow).getByText('project')

    expect(projectScopeBadge).toHaveClass('bg-teal-100')
    expect(projectScopeBadge).toHaveClass('text-teal-800')
    expect(projectScopeBadge.className).not.toContain('violet')

    const projectTokenCell = within(projectRow).getByText(/~2[.,]190/)
    expect(projectTokenCell).toHaveClass('text-emerald-700')
    expect(projectTokenCell.className).not.toContain('text-destructive')
  })
})
