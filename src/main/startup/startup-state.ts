/**
 * @file src/main/startup/startup-state.ts
 *
 * @description Shared startup progress state for splash-screen UX. Main
 * process updates this during bootstrap; IPC handlers expose snapshots to the
 * renderer, and push events are broadcast when windows are available.
 */

import { BrowserWindow } from 'electron'
import type {
  AppStartupCompletePayload,
  AppStartupProgressPayload,
  AppStartupStatus,
} from '@shared/channels'

const PROGRESS_CHANNEL = 'app:startup-progress'
const COMPLETE_CHANNEL = 'app:startup-complete'

const createInitialState = (): AppStartupStatus => ({
  progress: 0,
  message: 'Starting aidrelay...',
  ready: false,
  startedAt: Date.now(),
})

let startupState: AppStartupStatus = createInitialState()

const broadcast = (channel: string, payload: unknown): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

const clampProgress = (progress: number): number => Math.min(100, Math.max(0, progress))

export const getStartupStatus = (): AppStartupStatus => ({ ...startupState })

export const setStartupProgress = (progress: number, message: string): void => {
  const nextProgress = clampProgress(progress)
  startupState = {
    ...startupState,
    progress: Math.max(startupState.progress, nextProgress),
    message,
  }

  const payload: AppStartupProgressPayload = {
    progress: startupState.progress,
    message: startupState.message,
  }
  broadcast(PROGRESS_CHANNEL, payload)
}

export const markStartupComplete = (): void => {
  const completedAt = Date.now()
  startupState = {
    ...startupState,
    progress: 100,
    ready: true,
    message: 'Ready.',
    completedAt,
  }

  const progressPayload: AppStartupProgressPayload = {
    progress: startupState.progress,
    message: startupState.message,
  }
  const completePayload: AppStartupCompletePayload = { completedAt }
  broadcast(PROGRESS_CHANNEL, progressPayload)
  broadcast(COMPLETE_CHANNEL, completePayload)
}

export const setStartupError = (message: string): void => {
  startupState = {
    ...startupState,
    message,
    ready: false,
  }

  const payload: AppStartupProgressPayload = {
    progress: startupState.progress,
    message: startupState.message,
  }
  broadcast(PROGRESS_CHANNEL, payload)
}

export const resetStartupStateForTests = (): void => {
  startupState = createInitialState()
}
