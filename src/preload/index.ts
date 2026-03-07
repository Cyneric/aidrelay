/**
 * @file src/preload/index.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Preload script that runs in a privileged context before the
 * renderer loads. Exposes a typed IPC bridge to the renderer via
 * contextBridge. Only whitelisted methods are accessible — never raw
 * ipcRenderer. IPC channels are added here as each domain is implemented.
 */

import { contextBridge } from 'electron'

/**
 * The API surface exposed to the renderer process. Each domain (servers,
 * rules, clients, etc.) adds its typed methods here as those features are
 * built out in subsequent phases.
 *
 * This object is accessible in the renderer as `window.api`.
 */
const api = {} as const

// Expose the typed bridge to the renderer process
contextBridge.exposeInMainWorld('api', api)

// Declare the type of the exposed API so the renderer can import it
export type ElectronApi = typeof api
