/**
 * @file src/renderer/components/layout/Shell.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Root layout shell. Renders the fixed sidebar alongside a
 * scrollable main content area. Used as the layout component for the root
 * TanStack Router route so all pages share the same chrome.
 */

import { Outlet } from '@tanstack/react-router'
import { Sidebar } from './Sidebar'

/**
 * Full-window layout with sidebar on the left and the active page content
 * on the right. The `<Outlet />` renders whichever route is currently active.
 */
const Shell = () => (
  <div className="flex h-screen overflow-hidden bg-background text-foreground" data-testid="shell">
    <Sidebar />
    <main className="flex-1 overflow-y-auto p-6" role="main" id="main-content">
      <Outlet />
    </main>
  </div>
)

export { Shell }
