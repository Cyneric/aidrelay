import type { SyncResult } from '@shared/types'

export const isSyncErrorWithCode = (
  err: unknown,
  code: SyncResult['errorCode'],
): err is { code: SyncResult['errorCode'] } =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code?: string }).code === code

export const isConfigCreationRequiredError = (err: unknown): boolean =>
  isSyncErrorWithCode(err, 'config_creation_required')
