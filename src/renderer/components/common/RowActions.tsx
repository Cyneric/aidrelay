/**
 * @file src/renderer/components/common/RowActions.tsx
 *
 * @created 17.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Standardized row-level action pattern for tables and cards.
 * Renders an optional labeled primary action button alongside a "more actions"
 * dropdown menu, replacing scattered icon-only button rows.
 */

import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RowActionPrimary {
  readonly label: string
  readonly icon: LucideIcon
  readonly onClick: () => void
  readonly disabled?: boolean
  readonly loading?: boolean
}

interface RowActionMenuItem {
  readonly label: string
  readonly icon?: LucideIcon
  readonly onClick: () => void
  readonly disabled?: boolean
  readonly destructive?: boolean
}

interface RowActionsProps {
  /** Labeled primary action button shown inline */
  readonly primaryAction?: RowActionPrimary | undefined
  /** Items shown in the "more actions" dropdown menu */
  readonly menuItems: ReadonlyArray<RowActionMenuItem>
  /** Test identifier */
  readonly testId?: string
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Renders an inline primary action button and a dropdown trigger for
 * secondary actions. Designed for use in table rows and card footers.
 *
 * @param props - Row actions configuration.
 * @returns The row actions element.
 */
const RowActions = ({
  primaryAction,
  menuItems,
  testId = 'row-actions',
}: Readonly<RowActionsProps>) => {
  const { t } = useTranslation()

  // Split menu items: regular items first, destructive items after a separator
  const regularItems = menuItems.filter((item) => !item.destructive)
  const destructiveItems = menuItems.filter((item) => item.destructive)

  return (
    <div className="flex items-center gap-1" data-testid={testId}>
      {primaryAction ? (
        <Button
          type="button"
          variant="default"
          size="xs"
          disabled={primaryAction.disabled || primaryAction.loading}
          onClick={primaryAction.onClick}
          data-testid={`${testId}-primary`}
        >
          <primaryAction.icon
            size={12}
            className={primaryAction.loading ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          {primaryAction.label}
        </Button>
      ) : null}

      {menuItems.length > 0 ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('common.moreActions', 'More actions')}
                  data-testid={`${testId}-menu-trigger`}
                >
                  <MoreHorizontal size={14} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t('common.moreActions', 'More actions')}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            {regularItems.map((item) => {
              const ItemIcon = item.icon
              const slug = item.label.toLowerCase().replace(/\s+/g, '-')
              return (
                <DropdownMenuItem
                  key={item.label}
                  disabled={item.disabled ?? false}
                  onClick={item.onClick}
                  data-testid={`${testId}-item-${slug}`}
                >
                  {ItemIcon ? <ItemIcon size={14} aria-hidden="true" /> : null}
                  {item.label}
                </DropdownMenuItem>
              )
            })}
            {destructiveItems.length > 0 && regularItems.length > 0 ? (
              <DropdownMenuSeparator />
            ) : null}
            {destructiveItems.map((item) => {
              const ItemIcon = item.icon
              const slug = item.label.toLowerCase().replace(/\s+/g, '-')
              return (
                <DropdownMenuItem
                  key={item.label}
                  variant="destructive"
                  disabled={item.disabled ?? false}
                  onClick={item.onClick}
                  data-testid={`${testId}-item-${slug}`}
                >
                  {ItemIcon ? <ItemIcon size={14} aria-hidden="true" /> : null}
                  {item.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

export { RowActions }
export type { RowActionsProps, RowActionPrimary, RowActionMenuItem }
