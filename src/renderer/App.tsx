/**
 * @file src/renderer/App.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Root React component. Sets up the TanStack Router with a
 * root route that renders the Shell layout and child routes for each page.
 * Placeholder routes are used for pages not yet implemented so navigation
 * links work end-to-end from the start. Rules page wired in Step 22;
 * Profiles page wired in Step 30; Registry + Stacks pages wired in Step 43/45;
 * Settings + History pages wired in Phase 6.
 */

import { useEffect } from 'react'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { Toaster, toast } from 'sonner'
import { Shell } from '@/components/layout/Shell'
import { DashboardPage } from '@/pages/DashboardPage'
import { ServersPage } from '@/pages/ServersPage'
import { RulesPage } from '@/pages/RulesPage'
import { ActivityLogPage } from '@/pages/ActivityLogPage'
import { ProfilesPage } from '@/pages/ProfilesPage'
import { RegistryPage } from '@/pages/RegistryPage'
import { StacksPage } from '@/pages/StacksPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { ClientsPage } from '@/pages/ClientsPage'

// ─── Routes ───────────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({ component: Shell })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

const serversRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/servers',
  component: ServersPage,
})

const rulesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rules',
  component: RulesPage,
})

const clientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clients',
  component: ClientsPage,
})

const profilesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profiles',
  component: ProfilesPage,
})

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  component: ActivityLogPage,
})

const registryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/registry',
  component: RegistryPage,
})

const stacksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stacks',
  component: StacksPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  component: HistoryPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  serversRoute,
  rulesRoute,
  clientsRoute,
  profilesRoute,
  activityRoute,
  registryRoute,
  stacksRoute,
  settingsRoute,
  historyRoute,
])

// ─── Router ───────────────────────────────────────────────────────────────────

const router = createRouter({ routeTree })

// Register the router's type for TypeScript inference across the app
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Root component rendered by `src/renderer/main.tsx`.
 * Wraps the entire app in the TanStack Router provider and listens for
 * tray-initiated profile switches and update notifications globally.
 */
const App = () => {
  // Handle profile quick-switch from the system tray
  useEffect(() => {
    const handleTrayActivate = (profileId: string): void => {
      void window.api
        .profilesActivate(profileId)
        .then(() => {
          toast.success('Profile activated from tray.')
        })
        .catch(() => {
          toast.error('Failed to activate profile from tray.')
        })
    }
    const unsub = window.api.onActivateProfileFromTray(handleTrayActivate)
    return unsub
  }, [])

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors />
    </>
  )
}

export { App }
