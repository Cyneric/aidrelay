/**
 * @file src/renderer/components/rules/__tests__/RuleEditorTokenBadge.test.tsx
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @description Verifies token estimate badges in RuleEditor and
 * RuleMarkdownEditor use the same shared severity class.
 */

import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test-utils'
import { RuleEditor } from '../RuleEditor'
import { tokenBadgeClass } from '../tokenBadgeSeverity'

const mockTokenEstimate = 120_000 // 60% of 200,000 => orange

vi.mock('@/hooks/useTokenEstimate', () => ({
  useTokenEstimate: () => mockTokenEstimate,
}))

vi.mock('@/stores/rules.store', () => ({
  useRulesStore: () => ({
    create: vi.fn(),
    update: vi.fn(),
  }),
}))

vi.mock('@/lib/useTheme', () => ({
  useTheme: () => ({ effectiveTheme: 'dark' }),
}))

vi.mock('@uiw/react-md-editor', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value?: string) => void }) => (
    <textarea
      data-testid="mock-md-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly
    />
  ),
}))

describe('RuleEditor token estimate badges', () => {
  it('applies the same severity class to header and markdown badges for the same estimate', async () => {
    const expectedClass = tokenBadgeClass(mockTokenEstimate)
    const user = userEvent.setup()

    renderWithProviders(<RuleEditor onClose={() => {}} />)

    const headerBadge = screen.getByTestId('editor-token-estimate')
    expect(headerBadge.className).toContain(expectedClass)

    await user.click(screen.getByTestId('rule-editor-tab-content'))

    const markdownBadge = screen.getByTestId('token-estimate-badge')
    expect(markdownBadge.className).toContain(expectedClass)
  })
})
