/**
 * @file src/renderer/lib/ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Augments the global `Window` interface so that `window.api` is
 * fully typed in renderer code. Import this file anywhere in the renderer to
 * activate the type — it has no runtime footprint.
 *
 * The `ElectronApi` type is exported from the preload script; we import it
 * here as a type-only import so it never crosses into renderer bundles.
 */

import type { ElectronApi } from '../../preload/index'

declare global {
  interface Window {
    /**
     * The typed IPC bridge injected by the preload script via contextBridge.
     * Every method on this object is a promise-returning wrapper around
     * `ipcRenderer.invoke`, so calls are always async.
     */
    readonly api: ElectronApi
  }
}
