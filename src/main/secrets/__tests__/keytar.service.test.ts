/**
 * @file src/main/secrets/__tests__/keytar.service.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the keytar wrapper service. The `keytar` module
 * is mocked entirely so these tests run without hitting the Windows Credential
 * Manager, making them safe to run in any environment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock keytar before importing the service ──────────────────────────────────
vi.mock('keytar', () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
    findCredentials: vi.fn(),
  },
}))

import keytar from 'keytar'
import {
  storeSecret,
  getSecret,
  deleteSecret,
  listSecretKeys,
  deleteAllSecrets,
} from '../keytar.service'

const mockKeytar = keytar as unknown as {
  setPassword: ReturnType<typeof vi.fn>
  getPassword: ReturnType<typeof vi.fn>
  deletePassword: ReturnType<typeof vi.fn>
  findCredentials: ReturnType<typeof vi.fn>
}

describe('KeytarService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('storeSecret()', () => {
    it('calls setPassword with the correct service and composite account key', async () => {
      mockKeytar.setPassword.mockResolvedValue(undefined)
      await storeSecret('my-server', 'API_KEY', 'secret-value')
      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        'aidrelay',
        'my-server/API_KEY',
        'secret-value',
      )
    })
  })

  describe('getSecret()', () => {
    it('returns the stored value when the credential exists', async () => {
      mockKeytar.getPassword.mockResolvedValue('secret-value')
      const result = await getSecret('my-server', 'API_KEY')
      expect(result).toBe('secret-value')
      expect(mockKeytar.getPassword).toHaveBeenCalledWith('aidrelay', 'my-server/API_KEY')
    })

    it('returns null when the credential does not exist', async () => {
      mockKeytar.getPassword.mockResolvedValue(null)
      const result = await getSecret('my-server', 'MISSING_KEY')
      expect(result).toBeNull()
    })
  })

  describe('deleteSecret()', () => {
    it('calls deletePassword with the correct account key', async () => {
      mockKeytar.deletePassword.mockResolvedValue(true)
      const result = await deleteSecret('my-server', 'API_KEY')
      expect(result).toBe(true)
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith('aidrelay', 'my-server/API_KEY')
    })
  })

  describe('listSecretKeys()', () => {
    it('returns only the env key names for the given server', async () => {
      mockKeytar.findCredentials.mockResolvedValue([
        { account: 'my-server/API_KEY', password: '' },
        { account: 'my-server/TOKEN', password: '' },
        { account: 'other-server/SECRET', password: '' },
      ])
      const keys = await listSecretKeys('my-server')
      expect(keys).toEqual(['API_KEY', 'TOKEN'])
    })

    it('returns an empty array when no credentials exist for the server', async () => {
      mockKeytar.findCredentials.mockResolvedValue([])
      const keys = await listSecretKeys('unknown-server')
      expect(keys).toEqual([])
    })
  })

  describe('deleteAllSecrets()', () => {
    it('deletes every secret associated with the given server', async () => {
      mockKeytar.findCredentials.mockResolvedValue([
        { account: 'my-server/API_KEY', password: '' },
        { account: 'my-server/TOKEN', password: '' },
      ])
      mockKeytar.deletePassword.mockResolvedValue(true)

      await deleteAllSecrets('my-server')

      expect(mockKeytar.deletePassword).toHaveBeenCalledTimes(2)
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith('aidrelay', 'my-server/API_KEY')
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith('aidrelay', 'my-server/TOKEN')
    })

    it('is a no-op when no secrets exist for the server', async () => {
      mockKeytar.findCredentials.mockResolvedValue([])
      await deleteAllSecrets('no-secrets-server')
      expect(mockKeytar.deletePassword).not.toHaveBeenCalled()
    })
  })
})
