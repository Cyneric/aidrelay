/**
 * @file src/renderer/components/layout/Shell.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
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
import { TitleBar } from './TitleBar'

/**
 * Full-window layout with a custom title bar on top, then sidebar on the left
 * and the active page content on the right. The `<Outlet />` renders whichever
 * route is currently active.
 */
const Shell = () => (
  <div
    className="flex flex-col h-screen min-h-0 overflow-hidden bg-background text-foreground"
    data-testid="shell"
  >
    <TitleBar />
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <Sidebar />
      <main
        className="relative z-0 flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-6"
        role="main"
        id="main-content"
      >
        <Outlet />
      </main>
    </div>
  </div>
)

export { Shell }
