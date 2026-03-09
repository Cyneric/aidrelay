/**
 * @file src/renderer/__tests__/setup.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Vitest setup file for renderer tests. Extends the jsdom
 * environment with jest-dom matchers and stubs the Electron preload bridge
 * so renderer components can be tested without a real Electron context.
 */

import '@testing-library/jest-dom'
// Initialize i18n so that useTranslation() resolves keys to actual strings in tests.
import '@/i18n'

// Stub the window.api bridge that the preload script normally exposes.
// Individual tests can override specific methods as needed.
Object.defineProperty(window, 'api', {
  value: {
    settingsGet: () => Promise.resolve(undefined),
    settingsSet: () => Promise.resolve(),
    settingsDelete: () => Promise.resolve(),
    clientsInstall: () =>
      Promise.resolve({
        clientId: 'cursor',
        success: false,
        attempts: [],
        failureReason: 'command_failed' as const,
        message: '',
      }),
    clientsPreviewConfigImport: () =>
      Promise.resolve({
        clientId: 'cursor',
        configPath: '',
        items: [],
      }),
    clientsImportConfigChanges: () =>
      Promise.resolve({
        clientId: 'cursor',
        configPath: '',
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
      }),
    clientsSetManualConfigPath: () => Promise.resolve({ valid: true, errors: [] }),
    clientsClearManualConfigPath: () => Promise.resolve(),
    onClientInstallProgress: () => () => {},
    showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
    filesReveal: () => Promise.resolve(),
    filesReadText: () =>
      Promise.resolve({ content: '', mtimeMs: Date.now(), size: 0, encoding: 'utf-8' as const }),
    filesWriteText: () => Promise.resolve({ mtimeMs: Date.now() }),
    settingsReset: () =>
      Promise.resolve({
        resetKeys: [],
        disconnectedGitSync: false,
        clearedAllSecrets: false,
        clearedLicenseCache: false,
        databaseReset: false,
        deletedPaths: [],
        restartTriggered: false,
      }),
  },
  writable: true,
  configurable: true,
})

// useTheme and other components rely on matchMedia for prefers-color-scheme.
// jsdom does not implement it, so we stub it with a no-op that returns false (light).
if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = () =>
    ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      media: '',
      onchange: null,
    }) as MediaQueryList
}

// Radix UI uses ResizeObserver to measure popper/tooltip content dimensions.
// jsdom does not implement it, so we stub it with a no-op.
if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Radix UI Dialog and other primitives use hasPointerCapture / setPointerCapture
// internally. jsdom does not implement them on HTMLElement.
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false
}
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {}
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {}
}

// Radix Select may call scrollIntoView on active options.
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {}
}
