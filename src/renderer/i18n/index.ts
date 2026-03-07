/**
 * @file src/renderer/i18n/index.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description i18next initialization for the renderer process. Configures
 * English and German translations, language detection from the browser locale,
 * and sensible fallback behaviour. Import this module once at the root of the
 * renderer (before any components render) to activate translations globally.
 *
 * Language selection priority:
 *   1. `navigator.language` / `navigator.languages` (browser/OS preference)
 *   2. Falls back to `en` if the detected language is not supported
 *
 * A language picker will be added to the Settings page in Step 48.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en.json'
import de from './de.json'

/** All supported locale codes. Extend this list as more translations are added. */
const SUPPORTED_LANGUAGES = ['en', 'de'] as const

/**
 * Detects the best-match language from the browser/OS locale.
 * Strips region suffixes (e.g. `en-US` → `en`) before matching.
 */
const detectLanguage = (): string => {
  const preferred = navigator.languages ?? [navigator.language]
  for (const lang of preferred) {
    const base = lang.split('-')[0] ?? 'en'
    if (SUPPORTED_LANGUAGES.includes(base as (typeof SUPPORTED_LANGUAGES)[number])) {
      return base
    }
  }
  return 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: {
    // React already escapes values — disable i18next's own escaping to avoid
    // double-encoding HTML entities in translated strings.
    escapeValue: false,
  },
})

export default i18n
