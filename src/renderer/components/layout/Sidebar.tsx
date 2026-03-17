/**
 * @file src/renderer/components/layout/Sidebar.tsx
 *
 * @created 07.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Fixed left sidebar with application branding and simplified
 * flat navigation. Highlights the active route using TanStack Router state.
 */

import { useEffect, useRef } from 'react'
import {
  LayoutDashboard,
  Server,
  BookOpen,
  Monitor,
  Layers,
  Settings,
  Store,
  History,
} from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/useTheme'
import { useProfilesStore } from '@/stores/profiles.store'
import { Separator } from '@/components/ui/separator'
import sidebarLogoDark from '../../assets/branding/aidrelay_logo_with_slogan_for_darkmode.png'
import sidebarLogoLight from '../../assets/branding/aidrelay_logo_with_slogan_for_lightmode.png'

// ─── Nav Config ───────────────────────────────────────────────────────────────

/**
 * Primary navigation items displayed in the main section of the sidebar.
 * Labels are i18n keys looked up at render time so the sidebar reacts
 * to language changes without a page reload.
 */
const PRIMARY_NAV_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/servers', labelKey: 'nav.servers', icon: Server },
  { to: '/rules', labelKey: 'nav.rules', icon: BookOpen },
  { to: '/clients', labelKey: 'nav.clients', icon: Monitor },
  { to: '/profiles', labelKey: 'nav.profiles', icon: Layers },
  { to: '/registry', labelKey: 'nav.registry', icon: Store },
] as const

/**
 * Secondary navigation items displayed below the separator.
 */
const SECONDARY_NAV_ITEMS = [
  { to: '/history', labelKey: 'nav.history', icon: History },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Application sidebar with logo, navigation links, and active profile indicator.
 * Rendered once inside `Shell` — not re-mounted on route changes.
 */
const Sidebar = () => {
  const { location } = useRouterState()
  const { t } = useTranslation()
  const { effectiveTheme } = useTheme()
  const { profiles, loading: profilesLoading, load: loadProfiles } = useProfilesStore()
  const currentPath = location.pathname
  const sidebarLogo = effectiveTheme === 'dark' ? sidebarLogoDark : sidebarLogoLight
  const profilesLoadedRef = useRef(false)

  const activeProfile = profiles.find((profile) => profile.isActive)
  const linkClasses = (isActive: boolean) =>
    cn(
      'flex items-center gap-2 rounded-md border-l-2 px-2.5 py-1.5 text-[13px] font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      isActive
        ? 'border-l-primary bg-accent/65 text-foreground'
        : 'border-l-transparent text-muted-foreground/90 hover:bg-accent/35 hover:text-foreground',
    )

  const renderNavLink = (
    to: string,
    labelKey: string,
    Icon: (typeof PRIMARY_NAV_ITEMS)[number]['icon'],
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
          <Icon size={15} aria-hidden="true" />
          {label}
        </Link>
      </li>
    )
  }

  useEffect(() => {
    if (profilesLoadedRef.current) return
    if (!profilesLoading && profiles.length === 0) {
      profilesLoadedRef.current = true
      void loadProfiles()
    }
  }, [profilesLoading, profiles.length, loadProfiles])

  return (
    <aside
      className="flex h-full min-h-0 w-56 shrink-0 flex-col border-r bg-sidebar"
      role="navigation"
      aria-label="Main navigation"
      data-testid="sidebar"
    >
      {/* Brand */}
      <div className="border-b px-5 py-4">
        <img
          src={sidebarLogo}
          alt="aidrelay logo"
          className="h-12 w-auto select-none object-contain"
          data-testid="sidebar-logo"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5" role="list">
          {PRIMARY_NAV_ITEMS.map(({ to, labelKey, icon }) => renderNavLink(to, labelKey, icon))}
        </ul>

        <Separator className="my-3" />

        <ul className="space-y-0.5" role="list">
          {SECONDARY_NAV_ITEMS.map(({ to, labelKey, icon }) => renderNavLink(to, labelKey, icon))}
        </ul>
      </nav>

      {/* Active profile */}
      <div className="border-t px-4 py-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
          {t('profilesIndicator.label')}
        </p>
        {profilesLoading && profiles.length === 0 ? (
          <p
            className="mt-1 px-1 text-sm text-muted-foreground"
            data-testid="active-profile-loading"
          >
            {t('profilesIndicator.loading')}
          </p>
        ) : activeProfile ? (
          <Link
            to="/profiles"
            className={cn(
              'mt-1 inline-flex w-full items-center justify-between gap-3 rounded-md border border-border/60',
              'bg-muted/30 px-2 py-1.5 text-[13px] font-medium text-foreground/90',
              'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            data-testid="active-profile-indicator"
            aria-label={t('profilesIndicator.aria', { name: activeProfile.name })}
          >
            <span className="flex min-w-0 items-center gap-2">
              {activeProfile.icon ? (
                <span className="text-base leading-none">{activeProfile.icon}</span>
              ) : (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: activeProfile.color }}
                />
              )}
              <span className="truncate">{activeProfile.name}</span>
            </span>
            <span className="rounded-full bg-accent/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {t('profiles.active')}
            </span>
          </Link>
        ) : (
          <p className="mt-1 px-1 text-sm text-muted-foreground" data-testid="active-profile-empty">
            {t('profilesIndicator.none')}
          </p>
        )}
      </div>
    </aside>
  )
}

export { Sidebar }
