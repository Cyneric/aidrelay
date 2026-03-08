/**
 * @file src/renderer/components/theme/ThemeToggle.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Dropdown for switching between light, dark, and system theme.
 * Uses Sun/Moon/Monitor icons. Can be rendered compact (icon only) or with
 * a label.
 */

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme, type Theme } from '@/lib/useTheme'

const THEME_OPTIONS: { value: Theme; icon: typeof Sun }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
]

interface ThemeToggleProps {
  /** When true, only the icon button is shown (e.g. in Sidebar). */
  readonly compact?: boolean
}

/**
 * Theme toggle dropdown. Shows current theme icon; clicking opens Light /
 * Dark / System options.
 */
const ThemeToggle = ({ compact = false }: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()
  const current = THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[2]
  const CurrentIcon = current?.icon ?? Monitor

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon-sm' : 'sm'}
          className="gap-2"
          aria-label={t('theme.toggleLabel')}
          data-testid="theme-toggle"
        >
          <CurrentIcon size={compact ? 16 : 18} aria-hidden="true" />
          {!compact && <span>{t(`theme.${theme}`)}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'start' : 'end'}>
        {THEME_OPTIONS.map(({ value, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            data-testid={`theme-option-${value}`}
          >
            <Icon size={16} aria-hidden="true" />
            {t(`theme.${value}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ThemeToggle }
