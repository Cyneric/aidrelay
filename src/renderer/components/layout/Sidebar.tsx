/**
 * @file src/renderer/components/layout/Sidebar.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
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
import { useTheme } from '@/lib/useTheme'
import sidebarLogoDark from '../../assets/branding/aidrelay_logo_with_slogan_for_darkmode.png'
import sidebarLogoLight from '../../assets/branding/aidrelay_logo_with_slogan_for_lightmode.png'

// ─── Nav Config ───────────────────────────────────────────────────────────────

/**
 * Static nav item definitions. Labels are i18n keys looked up at render time
 * so the sidebar reacts to language changes without a page reload.
 */
const CORE_NAV_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/servers', labelKey: 'nav.servers', icon: Server },
  { to: '/rules', labelKey: 'nav.rules', icon: BookOpen },
  { to: '/clients', labelKey: 'nav.clients', icon: Monitor },
]

const OPERATIONS_NAV_ITEMS = [
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
  const { effectiveTheme } = useTheme()
  const currentPath = location.pathname
  const sidebarLogo = effectiveTheme === 'dark' ? sidebarLogoDark : sidebarLogoLight

  const isPro = status.tier === 'pro' && status.valid
  const linkClasses = (isActive: boolean) =>
    cn(
      'flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      isActive
        ? 'border-l-primary bg-accent/65 text-foreground'
        : 'border-l-transparent text-muted-foreground/90 hover:bg-accent/35 hover:text-foreground',
    )

  const renderNavLink = (
    to: string,
    labelKey: string,
    Icon: (typeof CORE_NAV_ITEMS)[number]['icon'],
  ) => {
    const label = t(labelKey)
    const isActive = to === '/' ? currentPath === '/' : currentPath.startsWith(to)

    return (
      <li key={to}>
        <Link
          to={to}
          className={linkClasses(isActive)}
          data-testid={`nav-link-${to === '/' ? 'dashboard' : to.replace('/', '').toLowerCase()}`}
          aria-current={isActive ? 'page' : undefined}
        >
          <Icon size={16} aria-hidden="true" />
          {label}
        </Link>
      </li>
    )
  }

  return (
    <aside
      className="flex h-full min-h-0 w-60 shrink-0 flex-col border-r bg-sidebar"
      role="navigation"
      aria-label="Main navigation"
      data-testid="sidebar"
    >
      {/* Brand */}
      <div className="px-5 py-5 border-b">
        <img
          src={sidebarLogo}
          alt="aidrelay logo"
          className="h-14 w-auto object-contain select-none"
          data-testid="sidebar-logo"
        />
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
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-4">
          <section aria-labelledby="sidebar-core-nav">
            <h2
              id="sidebar-core-nav"
              className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80"
            >
              {t('nav.sectionCore')}
            </h2>
            <ul className="space-y-1" role="list">
              {CORE_NAV_ITEMS.map(({ to, labelKey, icon }) => renderNavLink(to, labelKey, icon))}
            </ul>
          </section>

          <section aria-labelledby="sidebar-operations-nav">
            <h2
              id="sidebar-operations-nav"
              className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80"
            >
              {t('nav.sectionOperations')}
            </h2>
            <ul className="space-y-1" role="list">
              {OPERATIONS_NAV_ITEMS.map(({ to, labelKey, icon }) =>
                renderNavLink(to, labelKey, icon),
              )}
            </ul>
          </section>
        </div>
      </nav>

      {/* Settings (pinned to bottom) */}
      <div className="border-t px-2 py-3">
        <h2 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
          {t('nav.sectionSettings')}
        </h2>
        <ul role="list">
          <li>
            <Link
              to="/settings"
              className={linkClasses(currentPath.startsWith('/settings'))}
              data-testid="nav-link-settings"
              aria-current={currentPath.startsWith('/settings') ? 'page' : undefined}
            >
              <Settings size={16} aria-hidden="true" />
              {t('nav.settings')}
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  )
}

export { Sidebar }
