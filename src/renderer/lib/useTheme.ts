/**
 * @file src/renderer/lib/useTheme.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Theme hook for light/dark/system mode. Persists preference
 * to settings (main process) and localStorage for instant first-paint. Applies
 * .dark class on document.documentElement when effective theme is dark.
 */

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'theme'
const THEME_CHANGED_EVENT = 'aidrelay:theme-changed'

export type Theme = 'light' | 'dark' | 'system'

/**
 * Returns whether the effective theme (resolved from system preference when
 * theme is 'system') is dark.
 */
const isDark = (theme: Theme): boolean => {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Applies or removes the .dark class on document.documentElement.
 */
const applyTheme = (dark: boolean): void => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (dark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

/**
 * Hook for theme state. Reads initial value from localStorage (for instant
 * first-paint, set by inline script in index.html), then syncs with settings
 * on mount. Persists to both localStorage and settings on change.
 *
 * @returns theme, setTheme, and effectiveTheme ('light' | 'dark')
 */
export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    return 'system'
  })

  const effectiveTheme = isDark(theme) ? 'dark' : 'light'

  useEffect(() => {
    applyTheme(isDark(theme))
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => {
      if (theme === 'system') applyTheme(mq.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  useEffect(() => {
    void window.api.settingsGet(STORAGE_KEY).then((stored: unknown) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored)
        localStorage.setItem(STORAGE_KEY, stored)
        applyTheme(isDark(stored))
      }
    })
  }, [])

  useEffect(() => {
    const handler = (event: Event): void => {
      const nextTheme = (event as CustomEvent<Theme>).detail
      if (nextTheme === 'light' || nextTheme === 'dark' || nextTheme === 'system') {
        setThemeState(nextTheme)
        localStorage.setItem(STORAGE_KEY, nextTheme)
        applyTheme(isDark(nextTheme))
      }
    }

    window.addEventListener(THEME_CHANGED_EVENT, handler)
    return () => window.removeEventListener(THEME_CHANGED_EVENT, handler)
  }, [])

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value)
    localStorage.setItem(STORAGE_KEY, value)
    void window.api.settingsSet(STORAGE_KEY, value)
    applyTheme(isDark(value))
    window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGED_EVENT, { detail: value }))
  }, [])

  return { theme, setTheme, effectiveTheme }
}
