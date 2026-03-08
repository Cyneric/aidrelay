/**
 * @file src/renderer/hooks/useStartupSplash.ts
 *
 * @description Tracks startup progress state for the launch splash overlay.
 * The splash remains visible until startup is marked ready and at least
 * 3 seconds have elapsed since the hook mounted.
 */

import { useEffect, useRef, useState } from 'react'
import type {
  AppStartupCompletePayload,
  AppStartupProgressPayload,
  AppStartupStatus,
} from '@shared/channels'

const MIN_SPLASH_VISIBLE_MS = 3000

interface StartupSplashState {
  readonly showSplash: boolean
  readonly progress: number
  readonly message: string
}

const clampProgress = (progress: number): number => Math.min(100, Math.max(0, progress))

export const useStartupSplash = (): StartupSplashState => {
  const mountedAtRef = useRef(Date.now())
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showSplash, setShowSplash] = useState(true)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('Starting aidrelay...')

  useEffect(() => {
    const scheduleHide = (): void => {
      const elapsed = Date.now() - mountedAtRef.current
      const remaining = Math.max(0, MIN_SPLASH_VISIBLE_MS - elapsed)
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
      hideTimerRef.current = setTimeout(() => {
        setShowSplash(false)
      }, remaining)
    }

    const handleProgress = (payload: AppStartupProgressPayload): void => {
      setProgress(clampProgress(payload.progress))
      setMessage(payload.message)
      if (payload.progress >= 100) {
        scheduleHide()
      }
    }

    const handleComplete = (_payload: AppStartupCompletePayload): void => {
      scheduleHide()
    }

    const unsubProgress = window.api.onStartupProgress(handleProgress)
    const unsubComplete = window.api.onStartupComplete(handleComplete)

    void window.api
      .appStartupStatus()
      .then((status: AppStartupStatus) => {
        setProgress(clampProgress(status.progress))
        setMessage(status.message)
        if (status.ready || status.progress >= 100) {
          scheduleHide()
        }
      })
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : 'unknown error'
        setMessage(`Startup status unavailable: ${detail}`)
      })

    return () => {
      unsubProgress()
      unsubComplete()
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
    }
  }, [])

  return { showSplash, progress, message }
}
