/**
 * @file src/main/installer/recipe-resolver.service.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Recipe resolution service for local MCP server installation.
 * Normalizes registry metadata and local defaults into a concrete
 * `InstallRecipe` that can be executed by the installer engine.
 */

import log from 'electron-log'
import type { InstallRecipe } from '@shared/types'
import { smitheryClient } from '@main/registry/smithery.client'

export class RecipeResolverService {
  /**
   * Resolve an install recipe for a given server ID.
   * Attempts to fetch from registry (Smithery / Official) first, then falls
   * back to local defaults derived from the server's launch configuration.
   */
  async resolve(_serverId: string, recipeId: string): Promise<InstallRecipe> {
    log.debug(`[recipe-resolver] resolving recipe for server ${_serverId}, recipe ${recipeId}`)

    // 1. Try to fetch from Smithery
    if (recipeId.startsWith('smithery:')) {
      const qualifiedName = recipeId.slice('smithery:'.length)
      const remoteRecipe = await smitheryClient.getRemoteInstallRecipe(qualifiedName)
      if (remoteRecipe) {
        return this.normalizeRemoteRecipe(remoteRecipe)
      }
    }

    // 2. TODO: Try to fetch from Official registry (when available)

    // 3. Fallback: generate a minimal recipe from the server's stored config
    return this.generateLocalRecipe(_serverId, recipeId)
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  private normalizeRemoteRecipe(remoteRecipe: unknown): InstallRecipe {
    // TODO: implement proper normalization of Smithery/Official remote recipes
    log.warn('[recipe-resolver] remote recipe normalization not yet implemented', remoteRecipe)
    return {
      id: 'unknown',
      version: '1.0.0',
      displayName: 'Unknown',
      runtimeDetection: [],
      adapters: [],
      launchConfig: {
        command: '',
        args: [],
        env: {},
        type: 'stdio',
      },
    }
  }

  private async generateLocalRecipe(_serverId: string, recipeId: string): Promise<InstallRecipe> {
    // TODO: fetch server from DB and derive recipe
    // For now, return a generic recipe that assumes the server is already installed
    await Promise.resolve()
    return {
      id: recipeId,
      version: '1.0.0',
      displayName: 'Local server',
      runtimeDetection: [],
      adapters: [],
      launchConfig: {
        command: '',
        args: [],
        env: {},
        type: 'stdio',
      },
    }
  }
}
