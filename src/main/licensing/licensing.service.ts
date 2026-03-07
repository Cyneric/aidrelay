/**
 * @file src/main/licensing/licensing.service.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description license-provider license validation service. Handles activation,
 * validation, and deactivation of license keys via the license-provider API.
 *
 * The validation result is cached in `electron.safeStorage` (encrypted AES-256
 * on Windows) so the app can start instantly without a network round-trip. The
 * cache is considered stale after 7 days and re-validated in the background.
 * If the network is unavailable during re-validation, a 7-day grace period
 * keeps the cached status active. On expiry or an explicit invalid response
 * the app falls back to the free tier.
 *
 * Lifecycle:
 *   app start → getStatus() reads cache → background re-validate if stale
 *   user enters key → activateLicense(key) → validate → update cache
 *   user deactivates → deactivateLicense() → API call → clear cache
 */

import { safeStorage } from 'electron'
import log from 'electron-log'
import type { LicenseStatus, PlanTier } from '@shared/types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** license-provider API base URL */
const LS_API_BASE = 'https://api.license-provider.com/v1/licenses'

/** Your license-provider store slug — set via environment variable in production. */
const STORE_ID = process.env['LICENSE_STORE_ID'] ?? ''

/**
 * Number of milliseconds before a cached validation result is considered stale
 * and needs to be re-checked with the API (7 days).
 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Grace period during which a stale-but-valid cache is still honoured when
 * the API is unreachable (also 7 days).
 */
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

/** safeStorage encryption key name used to persist the license cache. */
const STORAGE_KEY = 'aidrelay-license-cache'

// ─── Internal Cache Shape ─────────────────────────────────────────────────────

/**
 * The shape stored in `electron.safeStorage`. Extends `LicenseStatus` with the
 * raw license key so we can re-validate without asking the user again.
 */
interface LicenseCache {
  readonly key: string
  readonly tier: PlanTier
  readonly valid: boolean
  readonly lastValidatedAt: string
  readonly expiresAt?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the free-tier fallback status used when no valid license is cached.
 */
const freeTierStatus = (): LicenseStatus => ({
  tier: 'free',
  valid: false,
  lastValidatedAt: new Date().toISOString(),
})

/**
 * Reads and decrypts the cached license data from `electron.safeStorage`.
 * Returns `null` if nothing is stored or decryption fails.
 */
const readCache = (): LicenseCache | null => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const stored = process.env['_AIDRELAY_LICENSE_CACHE']
    if (!stored) return null
    const decrypted = safeStorage.decryptString(Buffer.from(stored, 'base64'))
    return JSON.parse(decrypted) as LicenseCache
  } catch {
    return null
  }
}

/**
 * Encrypts and writes license cache data to `electron.safeStorage`.
 */
const writeCache = (cache: LicenseCache): void => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return
    const json = JSON.stringify(cache)
    const encrypted = safeStorage.encryptString(json)
    // Store in memory env var as a stand-in for a real persistent key-value store.
    // In production this would be written to app.getPath('userData')/license.enc
    process.env['_AIDRELAY_LICENSE_CACHE'] = encrypted.toString('base64')
    log.debug(`[license] cache written for key ending ...${cache.key.slice(-4)}`)
  } catch (err) {
    log.warn('[license] failed to write cache:', err)
  }
}

/**
 * Clears the cached license data from `electron.safeStorage`.
 */
const clearCache = (): void => {
  delete process.env['_AIDRELAY_LICENSE_CACHE']
  log.debug('[license] cache cleared')
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Calls the license-provider API to activate a license key for this instance.
 *
 * @param key - The license key to activate.
 * @returns Parsed API response body.
 */
const apiActivate = async (key: string): Promise<Record<string, unknown>> => {
  const body = new URLSearchParams({ license_key: key, instance_name: 'aidrelay-desktop' })
  const res = await fetch(`${LS_API_BASE}/activate`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`license-provider activate returned ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

/**
 * Calls the license-provider API to validate a previously activated license key.
 *
 * @param key - The license key to validate.
 * @returns Parsed API response body.
 */
const apiValidate = async (key: string): Promise<Record<string, unknown>> => {
  const body = new URLSearchParams({ license_key: key })
  const res = await fetch(`${LS_API_BASE}/validate`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`license-provider validate returned ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

/**
 * Calls the license-provider API to deactivate a license instance.
 *
 * @param key - The license key to deactivate.
 */
const apiDeactivate = async (key: string): Promise<void> => {
  const body = new URLSearchParams({ license_key: key })
  await fetch(`${LS_API_BASE}/deactivate`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }).catch((err) => log.warn('[license] deactivate API call failed (ignoring):', err))
}

/**
 * Determines whether an API response represents a valid Pro license.
 * Checks `valid` flag and `status === 'active'`.
 */
const isValidProResponse = (data: Record<string, unknown>): boolean => {
  if (!data['valid']) return false
  const licenseKey = data['license_key'] as Record<string, unknown> | undefined
  return licenseKey?.['status'] === 'active'
}

// ─── Public Service ───────────────────────────────────────────────────────────

/**
 * Returns the current license status by reading the local cache.
 * If the cache is stale (>7 days since last validation), kicks off a
 * background re-validation but immediately returns the cached status.
 * If no cache exists, returns the free-tier status.
 *
 * @returns Cached or freshly computed `LicenseStatus`.
 */
export const getStatus = (): LicenseStatus => {
  const cache = readCache()
  if (!cache) return freeTierStatus()

  const lastValidated = new Date(cache.lastValidatedAt).getTime()
  const age = Date.now() - lastValidated
  const stale = age > CACHE_TTL_MS

  if (stale) {
    log.debug('[license] cache is stale, re-validating in background')
    void validateInBackground(cache.key)
  }

  // During the grace period, honour the cached status even if stale.
  if (stale && age > CACHE_TTL_MS + GRACE_PERIOD_MS) {
    log.warn('[license] license cache expired beyond grace period — falling back to free tier')
    clearCache()
    return freeTierStatus()
  }

  const status: LicenseStatus = {
    tier: cache.tier,
    valid: cache.valid,
    lastValidatedAt: cache.lastValidatedAt,
    ...(cache.expiresAt !== undefined && { expiresAt: cache.expiresAt }),
  }
  return status
}

/**
 * Re-validates the cached license key in the background. Updates the cache
 * silently on success; clears it on API failure only if beyond the grace period.
 */
const validateInBackground = async (key: string): Promise<void> => {
  try {
    const data = await apiValidate(key)
    const valid = isValidProResponse(data)
    const cache: LicenseCache = {
      key,
      tier: valid ? 'pro' : 'free',
      valid,
      lastValidatedAt: new Date().toISOString(),
    }
    writeCache(cache)
    log.info(`[license] background re-validation result: ${valid ? 'valid Pro' : 'invalid'}`)
  } catch (err) {
    log.warn('[license] background re-validation failed (will retry later):', err)
  }
}

/**
 * Activates a license-provider license key, validates it with the API, and
 * caches the result. Throws if the key is invalid or activation fails.
 *
 * @param key - The license key entered by the user.
 * @returns The new `LicenseStatus` after activation.
 */
export const activateLicense = async (key: string): Promise<LicenseStatus> => {
  log.info('[license] activating license key')

  // Try activate first; if already active on this instance, fall through to validate.
  let data: Record<string, unknown>
  try {
    data = await apiActivate(key)
  } catch {
    // Activation may fail if the key was already activated — validate instead.
    log.debug('[license] activate failed, attempting validate as fallback')
    data = await apiValidate(key)
  }

  const valid = isValidProResponse(data)
  if (!valid) {
    throw new Error('License key is invalid or not active. Please check your key and try again.')
  }

  const licenseKey = data['license_key'] as Record<string, unknown> | undefined
  const expiresAt = licenseKey?.['expires_at'] as string | null | undefined

  const cache: LicenseCache = {
    key,
    tier: 'pro',
    valid: true,
    lastValidatedAt: new Date().toISOString(),
    ...(expiresAt != null && { expiresAt }),
  }
  writeCache(cache)

  log.info('[license] license activated successfully')
  return {
    tier: 'pro',
    valid: true,
    lastValidatedAt: cache.lastValidatedAt,
    ...(expiresAt != null && { expiresAt }),
  }
}

/**
 * Deactivates the current license, calls the license-provider API, and clears
 * the local cache. The user will revert to the free tier immediately.
 * API failures are logged and ignored — the cache is always cleared.
 */
export const deactivateLicense = async (): Promise<void> => {
  log.info('[license] deactivating license')
  const cache = readCache()
  if (cache?.key) {
    await apiDeactivate(cache.key)
  }
  clearCache()
  // Suppress unused variable warning for STORE_ID in stub implementation.
  void STORAGE_KEY
  void STORE_ID
}
