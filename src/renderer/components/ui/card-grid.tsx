/**
 * @file src/renderer/components/ui/card-grid.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Responsive grid wrapper for card layouts. Applies consistent
 * breakpoints and gaps. Used for Dashboard, Profiles, Registry, StackExporter.
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

type ColsVariant = 'default' | 'md:2' | 'sm:2-lg:3'

const COLS_CLASSES: Record<ColsVariant, string> = {
  default: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  'md:2': 'grid-cols-1 md:grid-cols-2',
  'sm:2-lg:3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
}

const GAP_CLASSES: Record<string, string> = {
  '4': 'gap-4',
  '6': 'gap-6',
}

interface CardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Grid column breakpoints. Default: sm:2 lg:3. Use md:2 for two-column layouts. */
  readonly cols?: ColsVariant
  /** Gap between items. Default: 4. */
  readonly gap?: '4' | '6'
}

/**
 * Responsive grid for card layouts. Default: 1 col mobile, 2 cols sm, 3 cols lg.
 */
const CardGrid = ({ cols = 'default', gap = '4', className, ...props }: CardGridProps) => (
  <div
    className={cn('grid', COLS_CLASSES[cols], GAP_CLASSES[gap] ?? 'gap-4', className)}
    {...props}
  />
)

export { CardGrid }
