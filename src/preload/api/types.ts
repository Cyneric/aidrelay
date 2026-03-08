export interface IpcRendererLike {
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
  on(channel: string, listener: (...args: unknown[]) => void): void
  removeListener(channel: string, listener: (...args: unknown[]) => void): void
}
