/**
 * @file src/renderer/__tests__/setup.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Vitest setup file for renderer tests. Extends the jsdom
 * environment with jest-dom matchers and stubs the Electron preload bridge
 * so renderer components can be tested without a real Electron context.
 */

import '@testing-library/jest-dom'

// Stub the window.api bridge that the preload script normally exposes.
// Individual tests can override specific methods as needed.
Object.defineProperty(window, 'api', {
  value: {},
  writable: true,
  configurable: true,
})
