/**
 * @file src/renderer/components/rules/CategoryFilter.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Pill-button row for filtering rules by category. Derives the
 * available category list from the rules passed in — only categories that
 * actually exist are shown. "All" is always the first option.
 */

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
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          selected === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
        aria-pressed={selected === null}
        data-testid="category-filter-all"
      >
        All
      </button>

      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onChange(cat)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selected === cat
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
          aria-pressed={selected === cat}
          data-testid={`category-filter-${cat}`}
        >
          {cat}
        </button>
      ))}
    </nav>
  )
}

export { CategoryFilter }
