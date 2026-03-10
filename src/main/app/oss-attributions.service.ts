/**
 * @file src/main/app/oss-attributions.service.ts
 *
 * @description Loads and caches generated OSS attributions for the About page.
 */

import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import log from 'electron-log'
import type { OssAttribution } from '@shared/types'

let cachedAttributions: OssAttribution[] | null = null

const resolveAttributionsPath = (): string => {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'generated', 'oss-attributions.json')
  }

  return resolve(process.cwd(), 'resources', 'generated', 'oss-attributions.json')
}

const sanitizeAttribution = (entry: unknown): OssAttribution | null => {
  if (!entry || typeof entry !== 'object') return null

  const raw = entry as Record<string, unknown>
  if (
    typeof raw.packageName !== 'string' ||
    typeof raw.version !== 'string' ||
    typeof raw.license !== 'string' ||
    typeof raw.repositoryUrl !== 'string' ||
    typeof raw.licenseFile !== 'string' ||
    typeof raw.licenseText !== 'string'
  ) {
    return null
  }

  return {
    packageName: raw.packageName,
    version: raw.version,
    license: raw.license,
    repositoryUrl: raw.repositoryUrl,
    licenseFile: raw.licenseFile,
    licenseText: raw.licenseText,
  }
}

export const getOssAttributions = (): OssAttribution[] => {
  if (cachedAttributions) {
    return cachedAttributions
  }

  const attributionsPath = resolveAttributionsPath()
  if (!existsSync(attributionsPath)) {
    log.warn(`[oss] attribution file not found at ${attributionsPath}`)
    cachedAttributions = []
    return cachedAttributions
  }

  try {
    const rawFile = readFileSync(attributionsPath, 'utf8')
    const parsed = JSON.parse(rawFile) as unknown
    const list = Array.isArray(parsed) ? parsed : []
    cachedAttributions = list
      .map((entry) => sanitizeAttribution(entry))
      .filter((entry): entry is OssAttribution => entry !== null)
    return cachedAttributions
  } catch (error) {
    log.warn('[oss] failed to load attribution file:', error)
    cachedAttributions = []
    return cachedAttributions
  }
}
