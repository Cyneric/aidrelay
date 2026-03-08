export const settingsService = {
  get: (key: string): Promise<unknown> => window.api.settingsGet(key),
  set: (key: string, value: unknown): Promise<void> => window.api.settingsSet(key, value),
  remove: (key: string): Promise<void> => window.api.settingsDelete(key),
}
