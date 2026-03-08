/**
 * @file src/renderer/components/rules/__tests__/TokenBudgetPanel.test.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the TokenBudgetPanel component. Mocks the
 * rules and clients Zustand stores to drive different rendering scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TokenBudgetPanel } from '../TokenBudgetPanel'
import type { AiRule, ClientStatus } from '@shared/types'

// ─── Store Mocks ──────────────────────────────────────────────────────────────

const mockRulesState = { rules: [] as AiRule[] }
const mockClientsState = { clients: [] as ClientStatus[] }

vi.mock('@/stores/rules.store', () => ({
  useRulesStore: (selector: (s: typeof mockRulesState) => unknown) => selector(mockRulesState),
}))

vi.mock('@/stores/clients.store', () => ({
  useClientsStore: (selector: (s: typeof mockClientsState) => unknown) =>
    selector(mockClientsState),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeClient = (id: string, displayName: string, installed = true): ClientStatus => ({
  id: id as ClientStatus['id'],
  displayName,
  installed,
  configPaths: [],
  serverCount: 0,
  syncStatus: 'never-synced',
})

const makeRule = (
  id: string,
  tokenEstimate: number,
  enabled = true,
  clientOverrides: AiRule['clientOverrides'] = {} as AiRule['clientOverrides'],
): AiRule =>
  ({
    id,
    name: `rule-${id}`,
    description: '',
    content: 'content',
    category: 'general',
    priority: 'normal',
    scope: 'global',
    fileGlobs: [],
    alwaysApply: false,
    tags: [],
    enabled,
    clientOverrides,
    tokenEstimate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as AiRule

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TokenBudgetPanel', () => {
  beforeEach(() => {
    mockRulesState.rules = []
    mockClientsState.clients = []
  })

  it('renders empty state when no clients are installed', () => {
    render(<TokenBudgetPanel />)
    expect(screen.getByTestId('token-budget-empty')).toBeTruthy()
  })

  it('renders empty state when clients are detected but none installed', () => {
    mockClientsState.clients = [makeClient('cursor', 'Cursor', false)]
    render(<TokenBudgetPanel />)
    expect(screen.getByTestId('token-budget-empty')).toBeTruthy()
  })

  it('renders one bar per installed client', () => {
    mockClientsState.clients = [makeClient('cursor', 'Cursor'), makeClient('vscode', 'VS Code')]
    render(<TokenBudgetPanel />)
    expect(screen.getByTestId('token-budget-bar-cursor')).toBeTruthy()
    expect(screen.getByTestId('token-budget-bar-vscode')).toBeTruthy()
  })

  it('sums tokenEstimate for enabled rules', () => {
    mockClientsState.clients = [makeClient('cursor', 'Cursor')]
    mockRulesState.rules = [makeRule('r1', 100), makeRule('r2', 200)]
    render(<TokenBudgetPanel />)
    const label = screen.getByTestId('token-budget-label-cursor')
    // 100 + 200 = 300 used, 200,000 limit
    expect(label.textContent).toContain('300')
    expect(label.textContent).toMatch(/300\s*\/\s*200[.,]000/)
  })

  it('excludes disabled rules from the token sum', () => {
    mockClientsState.clients = [makeClient('cursor', 'Cursor')]
    mockRulesState.rules = [makeRule('r1', 100, true), makeRule('r2', 500, false)]
    render(<TokenBudgetPanel />)
    const label = screen.getByTestId('token-budget-label-cursor')
    expect(label.textContent).toContain('100')
    expect(label.textContent).not.toContain('600')
  })

  it('respects clientOverrides to exclude a rule from a specific client', () => {
    mockClientsState.clients = [makeClient('cursor', 'Cursor')]
    mockRulesState.rules = [
      makeRule('r1', 100),
      makeRule('r2', 200, true, { cursor: { enabled: false } } as AiRule['clientOverrides']),
    ]
    render(<TokenBudgetPanel />)
    const label = screen.getByTestId('token-budget-label-cursor')
    // r2 is overridden to disabled for cursor, so only r1 counts
    expect(label.textContent).toContain('100')
    expect(label.textContent).not.toContain('300')
  })

  it('shows warning icon when usage exceeds 80% of limit', () => {
    mockClientsState.clients = [makeClient('cursor', 'Cursor')]
    // default limit = 200,000; 80% = 160,000
    mockRulesState.rules = [makeRule('r1', 170_000)]
    render(<TokenBudgetPanel />)
    expect(screen.getByTestId('token-budget-warning-cursor')).toBeTruthy()
  })

  it('does not show warning icon below 80% threshold', () => {
    mockClientsState.clients = [makeClient('cursor', 'Cursor')]
    mockRulesState.rules = [makeRule('r1', 1_000)]
    render(<TokenBudgetPanel />)
    expect(screen.queryByTestId('token-budget-warning-cursor')).toBeNull()
  })
})
