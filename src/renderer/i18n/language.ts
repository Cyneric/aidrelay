/**
 * @file src/renderer/i18n/language.ts
 *
 * @description Shared language normalization and selection helpers for the
 * renderer i18n layer.
 */

export const SUPPORTED_LANGUAGES = ['en', 'de'] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

/**
 * Normalizes user-provided or environment-provided language values.
 * Accepts base tags (`en`) and region variants (`en-US`), and returns
 * `null` for unsupported values.
 */
export const normalizeLanguage = (value: unknown): SupportedLanguage | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const base = trimmed.split('-')[0]?.toLowerCase()
  if (!base) return null
  return SUPPORTED_LANGUAGES.includes(base as SupportedLanguage)
    ? (base as SupportedLanguage)
    : null
}

/**
 * Chooses the initial app language from cached user preference, then browser
 * preferences, and finally the default fallback.
 */
export const resolveInitialLanguage = (
  cachedLanguage: unknown,
  preferredLanguages: readonly string[],
): SupportedLanguage => {
  const fromCache = normalizeLanguage(cachedLanguage)
  if (fromCache) return fromCache

  for (const preferred of preferredLanguages) {
    const normalized = normalizeLanguage(preferred)
    if (normalized) return normalized
  }

  return DEFAULT_LANGUAGE
}
