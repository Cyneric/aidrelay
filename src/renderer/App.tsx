/**
 * @file src/renderer/App.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Root application component. Renders the top-level shell
 * layout and will host the router in subsequent phases. For now it displays
 * a placeholder that confirms the renderer loaded correctly.
 */

/**
 * Root application component. This is a placeholder — the full layout with
 * sidebar navigation, TanStack Router, and all pages gets built in Phase 1
 * step 10 onwards.
 */
export const App = () => {
  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground"
      data-testid="app-root"
    >
      <main className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">aidrelay</h1>
        <p className="text-muted-foreground text-lg">AI Developer Relay</p>
        <p className="text-muted-foreground text-sm">
          Phase 1 scaffold complete — renderer loaded successfully.
        </p>
      </main>
    </div>
  )
}
