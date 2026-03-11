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
import { FREE_GATES } from '@shared/feature-gates'

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
    skillsListInstalled: () => Promise.resolve([]),
    skillsListCurated: () => Promise.resolve([]),
    skillsDetectWorkspaces: () => Promise.resolve([]),
    skillsPrepareInstall: () =>
      Promise.resolve({
        skillName: 'test-skill',
        scope: 'user' as const,
        targetPath: '',
        exists: false,
        conflict: false,
        files: [],
      }),
    skillsInstallCurated: () =>
      Promise.resolve({
        scope: 'user' as const,
        skillName: 'test-skill',
        skillPath: '',
        skillMdPath: '',
        descriptionSource: 'none' as const,
        enabled: true,
        source: 'curated' as const,
        updatedAt: new Date().toISOString(),
      }),
    skillsCreate: () =>
      Promise.resolve({
        scope: 'user' as const,
        skillName: 'test-skill',
        skillPath: '',
        skillMdPath: '',
        descriptionSource: 'none' as const,
        enabled: true,
        source: 'manual' as const,
        updatedAt: new Date().toISOString(),
      }),
    skillsDelete: () => Promise.resolve(),
    skillsSetEnabled: () => Promise.resolve(),
    skillsMigrateLegacyPreview: () => Promise.resolve({ hasLegacy: false, items: [] }),
    skillsMigrateLegacyApply: () =>
      Promise.resolve({ hasLegacy: false, items: [], migrated: 0, skipped: 0 }),
    skillsSyncListConflicts: () => Promise.resolve([]),
    skillsSyncResolveConflict: () => Promise.resolve(),
    licenseFeatureGates: () => Promise.resolve(FREE_GATES),
    gitSyncStatus: () => Promise.resolve({ connected: false }),
    gitSyncConnectGitHub: () => Promise.resolve({ connected: true }),
    gitSyncConnectManual: () => Promise.resolve({ connected: true }),
    gitSyncTestRemote: () => Promise.resolve({ success: true }),
    gitSyncDisconnect: () => Promise.resolve(),
    gitSyncPush: () => Promise.resolve({ success: true }),
    gitSyncPull: () =>
      Promise.resolve({
        success: true,
        serversImported: 0,
        rulesImported: 0,
        profilesImported: 0,
        installIntentsImported: 0,
        skillsImported: 0,
        userSkillsImported: 0,
        projectSkillsImported: 0,
        conflicts: 0,
        skillConflicts: 0,
        skillMappingsRequired: 0,
        skillConflictItems: [],
        projectSkillMappings: [],
      }),
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
