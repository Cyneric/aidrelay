/**
 * @file src/renderer/lib/useLicense.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description React hook for accessing and managing the current license status
 * in the renderer. Fetches the initial status from the main process on mount
 * and exposes activate/deactivate actions that update the local state and
 * invalidate the feature gate cache so Pro features unlock immediately.
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { LicenseStatus } from '@shared/types'
import { invalidateGateCache } from './useFeatureGate'

/** Free-tier fallback used before the main process responds. */
const FREE_STATUS: LicenseStatus = {
  tier: 'free',
  valid: false,
  lastValidatedAt: new Date().toISOString(),
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Provides the current license status and actions to activate or deactivate
 * a license-provider license key.
 *
 * @returns An object containing the current status, loading flag, and actions.
 */
export const useLicense = (): {
  status: LicenseStatus
  loading: boolean
  activating: boolean
  activate: (key: string) => Promise<void>
  deactivate: () => Promise<void>
} => {
  const [status, setStatus] = useState<LicenseStatus>(FREE_STATUS)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    void window.api.licenseStatus().then((s: LicenseStatus) => {
      setStatus(s)
      setLoading(false)
    })
  }, [])

  const activate = useCallback(async (key: string) => {
    setActivating(true)
    try {
      const newStatus = await window.api.licenseActivate(key)
      setStatus(newStatus)
      invalidateGateCache()
      toast.success('License activated — Pro features unlocked.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Activation failed. Please try again.'
      toast.error(message)
    } finally {
      setActivating(false)
    }
  }, [])

  const deactivate = useCallback(async () => {
    try {
      await window.api.licenseDeactivate()
      setStatus(FREE_STATUS)
      invalidateGateCache()
      toast.success('License deactivated.')
    } catch {
      toast.error('Deactivation failed. Please try again.')
    }
  }, [])

  return { status, loading, activating, activate, deactivate }
}
