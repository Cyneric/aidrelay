/**
 * @file src/renderer/components/rules/CategoryFilter.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Pill-button row for filtering rules by category. Derives the
 * available category list from the rules passed in — only categories that
 * actually exist are shown. "All" is always the first option.
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AiRule } from '@shared/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryFilterProps {
  /** All rules — used to derive the dynamic category list. */
  readonly rules: readonly AiRule[]
  /** The currently selected category, or `null` to show all. */
  readonly selected: string | null
  /** Called when the user clicks a category pill. */
  readonly onChange: (category: string | null) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Horizontal pill-button row that lets users filter the rules list by category.
 * The "All" pill is always shown first; remaining categories are derived from
 * the provided rules and sorted alphabetically.
 */
const CategoryFilter = ({ rules, selected, onChange }: CategoryFilterProps) => {
  const categories = Array.from(new Set(rules.map((r) => r.category))).sort()

  return (
    <nav aria-label="Filter by category" className="flex flex-wrap gap-1.5">
      <Button
        type="button"
        size="sm"
        variant={selected === null ? 'default' : 'secondary'}
        onClick={() => onChange(null)}
        className={cn(
          'rounded-full h-7 px-3 text-xs',
          selected !== null && 'text-muted-foreground',
        )}
        aria-pressed={selected === null}
        data-testid="category-filter-all"
      >
        All
      </Button>

      {categories.map((cat) => (
        <Button
          key={cat}
          type="button"
          size="sm"
          variant={selected === cat ? 'default' : 'secondary'}
          onClick={() => onChange(cat)}
          className={cn(
            'rounded-full h-7 px-3 text-xs',
            selected !== cat && 'text-muted-foreground',
          )}
          aria-pressed={selected === cat}
          data-testid={`category-filter-${cat}`}
        >
          {cat}
        </Button>
      ))}
    </nav>
  )
}

export { CategoryFilter }
