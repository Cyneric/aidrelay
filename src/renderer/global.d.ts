/**
 * @file src/renderer/global.d.ts
 *
 * @description Global renderer typings for the preload IPC bridge.
 */

import type { ElectronApi } from '../preload/index'

declare global {
  interface Window {
    /**
     * Typed IPC bridge injected by the preload script.
     */
    readonly api: ElectronApi
  }
}

export {}
