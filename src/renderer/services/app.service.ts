import type {
  AppStartupCompletePayload,
  AppStartupProgressPayload,
  AppStartupStatus,
  SettingsResetInput,
  SettingsResetResult,
  WindowMaximizeChangedPayload,
} from '@shared/channels'
import type { OssAttribution } from '@shared/types'

export const appService = {
  version: (): Promise<string> => window.api.appVersion(),
  startupStatus: (): Promise<AppStartupStatus> => window.api.appStartupStatus(),
  ossAttributions: (): Promise<OssAttribution[]> => window.api.appOssAttributions(),
  checkForUpdates: (): Promise<void> => window.api.updaterCheck(),
  installUpdate: (): Promise<void> => window.api.updaterInstall(),
  onUpdateAvailable: (handler: (info: { version: string }) => void): (() => void) =>
    window.api.onUpdateAvailable(handler),
  onUpdateDownloaded: (handler: (info: { version: string }) => void): (() => void) =>
    window.api.onUpdateDownloaded(handler),
  onMaximizeChanged: (handler: (payload: WindowMaximizeChangedPayload) => void): (() => void) =>
    window.api.onMaximizeChanged(handler),
  onStartupProgress: (handler: (payload: AppStartupProgressPayload) => void): (() => void) =>
    window.api.onStartupProgress(handler),
  onStartupComplete: (handler: (payload: AppStartupCompletePayload) => void): (() => void) =>
    window.api.onStartupComplete(handler),
  resetSettings: (input: SettingsResetInput): Promise<SettingsResetResult> =>
    window.api.settingsReset(input),
}
