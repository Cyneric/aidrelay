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
 * English and German translations, language detection, and persisted
 * preference reconciliation. Import this module once at the root of the
 * renderer (before any components render) to activate translations globally.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en.json'
import de from './de.json'
import { DEFAULT_LANGUAGE, normalizeLanguage, resolveInitialLanguage } from './language'

const LANGUAGE_STORAGE_KEY = 'language'

const getCachedLanguage = (): string | null => {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    return null
  }
}

const setCachedLanguage = (language: string): void => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Ignore storage write failures (privacy mode / blocked storage).
  }
}

const preferredLanguages =
  typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []

const initialLanguage = resolveInitialLanguage(getCachedLanguage(), preferredLanguages)

const syncLanguageFromSettings = async (): Promise<void> => {
  try {
    const saved = normalizeLanguage(await window.api.settingsGet(LANGUAGE_STORAGE_KEY))
    if (!saved) return
    if (normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) !== saved) {
      await i18n.changeLanguage(saved)
    }
    setCachedLanguage(saved)
  } catch {
    // Keep startup resilient when IPC is not ready (tests/early lifecycle).
  }
}

i18n.on('languageChanged', (language) => {
  const normalized = normalizeLanguage(language)
  if (normalized) {
    setCachedLanguage(normalized)
  }
})

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      // React already escapes values — disable i18next's own escaping to avoid
      // double-encoding HTML entities in translated strings.
      escapeValue: false,
    },
  })
  .then(async () => {
    await syncLanguageFromSettings()
  })
  .catch(() => {
    // Initialization errors are intentionally swallowed here so the renderer
    // does not crash on localization bootstrap failures.
  })

export default i18n
export { DEFAULT_LANGUAGE, normalizeLanguage, resolveInitialLanguage }
