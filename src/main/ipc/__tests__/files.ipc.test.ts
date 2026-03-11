import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, showItemInFolder, openPath, existsSync, stat, readFile, writeFile } = vi.hoisted(
  () => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    showItemInFolder: vi.fn<(path: string) => void>(),
    openPath: vi.fn<(path: string) => Promise<string>>(),
    existsSync: vi.fn<(path: string) => boolean>(),
    stat: vi.fn<
      (path: string) => Promise<{ isFile?: () => boolean; size?: number; mtimeMs: number }>
    >(),
    readFile: vi.fn<(path: string) => Promise<Buffer>>(),
    writeFile:
      vi.fn<(path: string, content: string, options: { encoding: string }) => Promise<void>>(),
  }),
)

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn),
  },
  shell: {
    showItemInFolder,
    openPath,
  },
}))

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

vi.mock('node:fs', () => ({
  existsSync: (path: string) => existsSync(path),
  promises: {
    stat: (path: string): Promise<{ isFile?: () => boolean; size?: number; mtimeMs: number }> =>
      stat(path),
    readFile: (path: string): Promise<Buffer> => readFile(path),
    writeFile: (path: string, content: string, options: { encoding: string }): Promise<void> =>
      writeFile(path, content, options),
  },
}))

import { registerFilesIpc } from '../files.ipc'

const call = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
  const handler = handlers.get(channel)
  if (!handler) throw new Error(`No handler registered for ${channel}`)
  return (await handler(undefined, ...args)) as T
}

describe('files IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    showItemInFolder.mockReset()
    openPath.mockReset()
    existsSync.mockReset()
    stat.mockReset()
    readFile.mockReset()
    writeFile.mockReset()
    registerFilesIpc()
  })

  it('reveals a file in explorer', async () => {
    existsSync.mockReturnValue(true)

    await call<void>('files:reveal', 'C:\\tmp\\a.json')

    expect(showItemInFolder).toHaveBeenCalledWith('C:\\tmp\\a.json')
    expect(openPath).not.toHaveBeenCalled()
  })

  it('falls back to opening the parent folder when reveal fails', async () => {
    existsSync.mockReturnValue(true)
    showItemInFolder.mockImplementation(() => {
      throw new Error('reveal failed')
    })
    openPath.mockResolvedValue('')

    await call<void>('files:reveal', 'C:\\tmp\\a.json')

    expect(showItemInFolder).toHaveBeenCalledWith('C:\\tmp\\a.json')
    expect(openPath).toHaveBeenCalledWith('C:\\tmp')
  })

  it('throws file_reveal_failed when fallback open fails', async () => {
    existsSync.mockReturnValue(true)
    showItemInFolder.mockImplementation(() => {
      throw new Error('reveal failed')
    })
    openPath.mockResolvedValue('cannot open')

    await expect(call('files:reveal', 'C:\\tmp\\a.json')).rejects.toThrow('[file_reveal_failed]')
  })

  it('reads UTF-8 text files', async () => {
    stat.mockResolvedValue({ isFile: () => true, size: 4, mtimeMs: 1000 })
    readFile.mockResolvedValue(Buffer.from('test', 'utf-8'))

    const result = await call<{ content: string; mtimeMs: number; size: number }>(
      'files:read-text',
      'C:\\tmp\\a.json',
    )
    expect(result.content).toBe('test')
    expect(result.mtimeMs).toBe(1000)
    expect(result.size).toBe(4)
  })

  it('rejects oversized files', async () => {
    stat.mockResolvedValue({ isFile: () => true, size: 2 * 1024 * 1024, mtimeMs: 1000 })

    await expect(call('files:read-text', 'C:\\tmp\\large.txt')).rejects.toThrow('[file_too_large]')
  })

  it('writes text files when mtime matches', async () => {
    stat
      .mockResolvedValueOnce({ isFile: () => true, size: 4, mtimeMs: 123 })
      .mockResolvedValueOnce({ mtimeMs: 200 })
    readFile.mockResolvedValue(Buffer.from('test', 'utf-8'))
    writeFile.mockResolvedValue(undefined)

    const result = await call<{ mtimeMs: number }>(
      'files:write-text',
      'C:\\tmp\\a.json',
      'next',
      123,
    )

    expect(writeFile).toHaveBeenCalledWith('C:\\tmp\\a.json', 'next', { encoding: 'utf-8' })
    expect(result.mtimeMs).toBe(200)
  })

  it('rejects stale write attempts', async () => {
    stat.mockResolvedValue({ isFile: () => true, size: 4, mtimeMs: 999 })
    readFile.mockResolvedValue(Buffer.from('test', 'utf-8'))

    await expect(call('files:write-text', 'C:\\tmp\\a.json', 'next', 123)).rejects.toThrow(
      '[file_conflict]',
    )
  })
})
