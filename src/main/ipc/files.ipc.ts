/**
 * @file src/main/ipc/files.ipc.ts
 *
 * @description IPC handlers for file reveal and guarded UTF-8 text read/write.
 */

import { dirname } from 'node:path'
import { TextDecoder } from 'node:util'
import { ipcMain, shell } from 'electron'
import log from 'electron-log'
import { existsSync, promises as fs } from 'node:fs'
import type { ReadTextFileResult, WriteTextFileResult } from '@shared/channels'

const MAX_TEXT_FILE_BYTES = 1024 * 1024 // 1 MiB
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true })

const makeIpcError = (code: string, message: string): Error => {
  const error = new Error(`[${code}] ${message}`)
  error.name = 'IpcFileError'
  return error
}

const readUtf8TextFile = async (path: string): Promise<ReadTextFileResult> => {
  if (!path || path.trim().length === 0) {
    throw makeIpcError('file_invalid_path', 'Path is required.')
  }

  const stat = await fs.stat(path).catch(() => {
    throw makeIpcError('file_not_found', `File not found: ${path}`)
  })

  if (!stat.isFile()) {
    throw makeIpcError('file_not_regular', `Path is not a file: ${path}`)
  }

  if (stat.size > MAX_TEXT_FILE_BYTES) {
    throw makeIpcError('file_too_large', `File exceeds ${MAX_TEXT_FILE_BYTES} bytes: ${path}`)
  }

  const buffer = await fs.readFile(path)
  try {
    const content = UTF8_DECODER.decode(buffer)
    return {
      content,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      encoding: 'utf-8',
    }
  } catch {
    throw makeIpcError('file_not_utf8', `File is not valid UTF-8 text: ${path}`)
  }
}

export const registerFilesIpc = (): void => {
  ipcMain.handle('files:reveal', async (_event, path: string): Promise<void> => {
    log.debug('[ipc] files:reveal', path)
    if (!path || path.trim().length === 0) {
      throw makeIpcError('file_invalid_path', 'Path is required.')
    }

    if (!existsSync(path)) {
      throw makeIpcError('file_not_found', `Path not found: ${path}`)
    }

    shell.showItemInFolder(path)
    const fallbackError = await shell.openPath(dirname(path))
    if (fallbackError) {
      throw makeIpcError('file_reveal_failed', fallbackError)
    }
  })

  ipcMain.handle('files:read-text', async (_event, path: string): Promise<ReadTextFileResult> => {
    log.debug('[ipc] files:read-text', path)
    return readUtf8TextFile(path)
  })

  ipcMain.handle(
    'files:write-text',
    async (
      _event,
      path: string,
      content: string,
      expectedMtimeMs: number,
    ): Promise<WriteTextFileResult> => {
      log.debug('[ipc] files:write-text', path)
      const current = await readUtf8TextFile(path)
      if (Math.abs(current.mtimeMs - expectedMtimeMs) > 1) {
        throw makeIpcError(
          'file_conflict',
          'The file changed on disk since it was opened. Reload and try again.',
        )
      }

      await fs.writeFile(path, content, { encoding: 'utf-8' }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown write error'
        throw makeIpcError('file_write_failed', message)
      })

      const stat = await fs.stat(path)
      return { mtimeMs: stat.mtimeMs }
    },
  )

  log.info('[ipc] files handlers registered')
}
