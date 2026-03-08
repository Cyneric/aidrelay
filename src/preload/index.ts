import { contextBridge, ipcRenderer } from 'electron'
import { createApi } from './api/bridge'

const api = createApi(ipcRenderer)

contextBridge.exposeInMainWorld('api', api)

export type { ElectronApi } from './api/bridge'
