/**
 * @file src/renderer/components/layout/Sidebar.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Fixed left sidebar with application branding and primary
 * navigation. Highlights the active route using TanStack Router state.
 */

import {
  LayoutDashboard,
  Server,
  BookOpen,
  Monitor,
  Layers,
  Activity,
  Settings,
  Store,
  Package,
  History,
} from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLicense } from '@/lib/useLicense'

// ─── Nav Config ───────────────────────────────────────────────────────────────

/**
 * Static nav item definitions. Labels are i18n keys looked up at render time
 * so the sidebar reacts to language changes without a page reload.
 */
const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/servers', labelKey: 'nav.servers', icon: Server },
  { to: '/rules', labelKey: 'nav.rules', icon: BookOpen },
  { to: '/clients', labelKey: 'nav.clients', icon: Monitor },
  { to: '/profiles', labelKey: 'nav.profiles', icon: Layers },
  { to: '/registry', labelKey: 'nav.registry', icon: Store },
  { to: '/stacks', labelKey: 'nav.stacks', icon: Package },
  { to: '/activity', labelKey: 'nav.activityLog', icon: Activity },
  { to: '/history', labelKey: 'nav.history', icon: History },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Application sidebar with logo, navigation links, and a pinned settings link.
 * Rendered once inside `Shell` — not re-mounted on route changes.
 */
const Sidebar = () => {
  const { location } = useRouterState()
  const { t } = useTranslation()
  const { status, loading } = useLicense()
  const currentPath = location.pathname

  const isPro = status.tier === 'pro' && status.valid

  return (
    <aside
      className="flex flex-col w-60 shrink-0 border-r bg-sidebar h-full"
      role="navigation"
      aria-label="Main navigation"
      data-testid="sidebar"
    >
      {/* Brand */}
      <div className="px-5 py-4 border-b">
        <span className="text-base font-bold tracking-tight select-none">aidrelay</span>
        <p className="text-[11px] text-muted-foreground mt-0.5">AI Developer Relay</p>
      </div>

      {/* Plan tier badge */}
      {!loading && (
        <div className="px-5 pt-3 pb-1">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
              isPro
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-muted text-muted-foreground',
            )}
            aria-label={`Current plan: ${isPro ? 'Pro' : 'Free'}`}
            data-testid="plan-badge"
          >
            {isPro ? 'Pro' : 'Free'}
          </span>
        </div>
      )}

      {/* Primary links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => {
            const label = t(labelKey)
            const isActive = to === '/' ? currentPath === '/' : currentPath.startsWith(to)
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium',
                    'transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                  )}
                  data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Settings (pinned to bottom) */}
      <div className="px-2 py-3 border-t">
        <Link
          to="/settings"
          className={cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium',
            'transition-colors hover:bg-accent hover:text-accent-foreground',
            currentPath.startsWith('/settings')
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground',
          )}
          data-testid="nav-link-settings"
          aria-current={currentPath.startsWith('/settings') ? 'page' : undefined}
        >
          <Settings size={16} aria-hidden="true" />
          {t('nav.settings')}
        </Link>
      </div>
    </aside>
  )
}

export { Sidebar }
