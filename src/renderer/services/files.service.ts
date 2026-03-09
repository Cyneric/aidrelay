import type { ReadTextFileResult, WriteTextFileResult } from '@shared/channels'

export const filesService = {
  reveal: (path: string): Promise<void> => window.api.filesReveal(path),
  readText: (path: string): Promise<ReadTextFileResult> => window.api.filesReadText(path),
  writeText: (
    path: string,
    content: string,
    expectedMtimeMs: number,
  ): Promise<WriteTextFileResult> => window.api.filesWriteText(path, content, expectedMtimeMs),
}
