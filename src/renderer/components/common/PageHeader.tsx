/**
 * @file src/renderer/components/common/PageHeader.tsx
 *
 * @created 17.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Standardized page header component used across all pages.
 * Renders a consistent title, optional subtitle, and right-aligned action
 * buttons. Supports an optional sticky mode with backdrop blur.
 */

import { type ReactNode } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  /** Unique ID used for aria-labelledby linkage */
  readonly id?: string
  /** Page title displayed as h1 */
  readonly title: string
  /** Optional subtitle below the title */
  readonly subtitle?: string
  /** Right-aligned action buttons or controls */
  readonly actions?: ReactNode
  /** When true, the header sticks to the top with backdrop blur */
  readonly sticky?: boolean
  /** Test identifier */
  readonly testId?: string
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Renders a consistent page header with title, subtitle, and action slot.
 *
 * @param props - Header configuration props.
 * @returns The page header element.
 */
const PageHeader = ({
  id,
  title,
  subtitle,
  actions,
  sticky = false,
  testId = 'page-header',
}: Readonly<PageHeaderProps>) => {
  const stickyClasses = sticky
    ? 'sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'
    : ''

  return (
    <header
      className={`flex items-start justify-between gap-4 px-6 py-4 ${stickyClasses}`.trim()}
      data-testid={testId}
    >
      <div>
        <h1 id={id} className="text-2xl font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export { PageHeader }
export type { PageHeaderProps }
