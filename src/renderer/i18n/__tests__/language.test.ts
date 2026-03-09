/**
 * @file src/renderer/i18n/__tests__/language.test.ts
 *
 * @description Unit tests for language normalization and startup language
 * resolution helpers.
 */

import { describe, it, expect } from 'vitest'
import { DEFAULT_LANGUAGE, normalizeLanguage, resolveInitialLanguage } from '../language'

describe('normalizeLanguage', () => {
  it('accepts supported base language tags', () => {
    expect(normalizeLanguage('en')).toBe('en')
    expect(normalizeLanguage('de')).toBe('de')
  })

  it('normalizes supported region variants', () => {
    expect(normalizeLanguage('en-US')).toBe('en')
    expect(normalizeLanguage('de-DE')).toBe('de')
    expect(normalizeLanguage('DE-at')).toBe('de')
  })

  it('returns null for invalid or unsupported values', () => {
    expect(normalizeLanguage('fr')).toBeNull()
    expect(normalizeLanguage('')).toBeNull()
    expect(normalizeLanguage(null)).toBeNull()
    expect(normalizeLanguage(undefined)).toBeNull()
  })
})

describe('resolveInitialLanguage', () => {
  it('prefers a valid cached language over navigator preferences', () => {
    const resolved = resolveInitialLanguage('de', ['en-US'])
    expect(resolved).toBe('de')
  })

  it('falls back to navigator preference when cache is invalid', () => {
    const resolved = resolveInitialLanguage('fr', ['en-US', 'de-DE'])
    expect(resolved).toBe('en')
  })

  it('falls back to default language when no source is supported', () => {
    const resolved = resolveInitialLanguage(null, ['fr-FR', 'es-ES'])
    expect(resolved).toBe(DEFAULT_LANGUAGE)
  })
})
