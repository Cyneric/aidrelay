/**
 * @file src/renderer/test-utils.tsx
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Custom render helper that wraps the tree with all global
 * providers needed in the renderer (TooltipProvider from Radix). Import
 * `renderWithProviders` instead of `render` from @testing-library/react
 * whenever the component under test contains Tooltip, Dialog, or other
 * Radix primitives that require a provider ancestor.
 */

import { type ReactNode } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'

// ─── Wrapper ──────────────────────────────────────────────────────────────────

const AllProviders = ({ children }: { children: ReactNode }) => (
  <TooltipProvider>{children}</TooltipProvider>
)

// ─── Custom render ────────────────────────────────────────────────────────────

/**
 * Renders a component wrapped in all global app providers.
 * Use this instead of the plain `render` from @testing-library/react
 * whenever the component uses Radix UI primitives (Tooltip, Dialog, etc.).
 *
 * @param ui - The React element to render.
 * @param options - Optional RTL render options.
 * @returns The RTL render result.
 */
const renderWithProviders = (ui: ReactNode, options?: RenderOptions): RenderResult =>
  render(ui, { wrapper: AllProviders, ...options })

export { renderWithProviders }
// Re-export everything from RTL so test files only need one import source
export * from '@testing-library/react'
