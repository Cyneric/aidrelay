/**
 * @file src/renderer/components/layout/Sidebar.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
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
} from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

// ─── Nav Config ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/servers', label: 'Servers', icon: Server },
  { to: '/rules', label: 'Rules', icon: BookOpen },
  { to: '/clients', label: 'Clients', icon: Monitor },
  { to: '/profiles', label: 'Profiles', icon: Layers },
  { to: '/activity', label: 'Activity Log', icon: Activity },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Application sidebar with logo, navigation links, and a pinned settings link.
 * Rendered once inside `Shell` — not re-mounted on route changes.
 */
const Sidebar = () => {
  const { location } = useRouterState()
  const currentPath = location.pathname

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

      {/* Primary links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
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
          Settings
        </Link>
      </div>
    </aside>
  )
}

export { Sidebar }
