/**
 * @file src/renderer/components/layout/TitleBar.tsx
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Custom Electron title bar rendered in the renderer process.
 * Replaces the OS-native title bar (hidden via `titleBarStyle: 'hidden'`).
 * Provides an app label, a full-width drag region, and Win32-style window
 * control buttons (minimize, maximize/restore, close) that delegate to the
 * main process via IPC.
 */

import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import logo from '../../assets/branding/logo.png'
import '../../lib/electron.d'

/**
 * Renders the custom application title bar with a drag region and window
 * control buttons. Subscribes to the `window:maximize-changed` push event
 * so the maximize/restore icon stays in sync with the actual window state.
 */
const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const cleanup = window.api.onMaximizeChanged(({ isMaximized: maximized }) => {
      setIsMaximized(maximized)
    })
    return cleanup
  }, [])

  return (
    <header
      className="flex h-8 shrink-0 items-center justify-between bg-background border-b select-none"
      style={{ WebkitAppRegion: 'drag' }}
      data-testid="title-bar"
    >
      <div className="flex items-center pl-3" data-testid="title-bar-brand">
        <img
          src={logo as unknown as string}
          alt="aidrelay logo"
          className="h-5 w-auto object-contain"
          style={{ WebkitAppRegion: 'no-drag' }}
          data-testid="title-bar-logo"
        />
      </div>

      <div
        className="flex h-full"
        style={{ WebkitAppRegion: 'no-drag' }}
        data-testid="title-bar-controls"
      >
        {/* Minimize */}
        <button
          type="button"
          aria-label="Minimize window"
          className="flex w-12 h-full items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          onClick={() => void window.api.windowMinimize()}
          data-testid="title-bar-minimize"
        >
          <Minus size={14} />
        </button>

        {/* Maximize / Restore */}
        <button
          type="button"
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
          className="flex w-12 h-full items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          onClick={() => void window.api.windowMaximize()}
          data-testid="title-bar-maximize"
        >
          {isMaximized ? <Copy size={14} /> : <Square size={14} />}
        </button>

        {/* Close */}
        <button
          type="button"
          aria-label="Close window"
          className="flex w-12 h-full items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
          onClick={() => void window.api.windowClose()}
          data-testid="title-bar-close"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  )
}

export { TitleBar }
