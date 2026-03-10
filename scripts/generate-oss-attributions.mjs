/**
 * @file scripts/generate-oss-attributions.mjs
 *
 * @description Generates a normalized OSS attribution manifest from runtime
 * npm dependencies, including full license text content for each package.
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

const REPO_ROOT = process.cwd()
const OUTPUT_PATH = resolve(REPO_ROOT, 'resources/generated/oss-attributions.json')
const LICENSE_TEXT_FALLBACK = 'License text not available in installed package metadata.'

/**
 * Converts a repository field from package metadata into a canonical URL string.
 */
const normalizeRepositoryUrl = (value) => {
  if (typeof value !== 'string') return ''

  return value.replace(/^git\+/, '').replace(/\.git$/, '')
}

/**
 * Returns a stable `packageName` + `version` tuple from a `name@version` key.
 */
const parsePackageRef = (packageRef) => {
  const versionDelimiter = packageRef.lastIndexOf('@')
  if (versionDelimiter <= 0) {
    return null
  }

  const packageName = packageRef.slice(0, versionDelimiter)
  const version = packageRef.slice(versionDelimiter + 1)

  if (!packageName || !version) {
    return null
  }

  return { packageName, version }
}

/**
 * Reads license text from the provided path with a user-friendly fallback.
 */
const readLicenseText = (licenseFilePath) => {
  if (!licenseFilePath) {
    return LICENSE_TEXT_FALLBACK
  }

  const resolvedPath = isAbsolute(licenseFilePath)
    ? licenseFilePath
    : resolve(REPO_ROOT, licenseFilePath)

  if (!existsSync(resolvedPath)) {
    return LICENSE_TEXT_FALLBACK
  }

  try {
    return readFileSync(resolvedPath, 'utf8')
  } catch {
    return `Unable to read license file: ${resolvedPath}`
  }
}

/**
 * Converts absolute paths into repo-relative paths for deterministic output.
 */
const normalizeLicenseFilePath = (licenseFilePath) => {
  if (!licenseFilePath) return ''

  const resolvedPath = isAbsolute(licenseFilePath)
    ? licenseFilePath
    : resolve(REPO_ROOT, licenseFilePath)

  return relative(REPO_ROOT, resolvedPath)
}

const checkerOutput = execSync(
  'pnpm exec license-checker-rseidelsohn --production --excludePrivatePackages --json --start .',
  {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)

/** @type {Record<string, Record<string, unknown>>} */
const rawAttributions = JSON.parse(checkerOutput)

const attributions = Object.entries(rawAttributions)
  .map(([packageRef, value]) => {
    const parsedRef = parsePackageRef(packageRef)
    if (!parsedRef) return null

    const licenseFile = typeof value.licenseFile === 'string' ? value.licenseFile : ''

    return {
      packageName: parsedRef.packageName,
      version: parsedRef.version,
      license: typeof value.licenses === 'string' ? value.licenses : 'UNKNOWN',
      repositoryUrl: normalizeRepositoryUrl(value.repository),
      licenseFile: normalizeLicenseFilePath(licenseFile),
      licenseText: readLicenseText(licenseFile),
    }
  })
  .filter((entry) => entry !== null)
  .sort((a, b) => {
    if (a.packageName !== b.packageName) {
      return a.packageName.localeCompare(b.packageName)
    }
    return a.version.localeCompare(b.version)
  })

mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
writeFileSync(OUTPUT_PATH, `${JSON.stringify(attributions, null, 2)}\n`, 'utf8')

console.log(`Generated ${attributions.length} OSS attributions at ${OUTPUT_PATH}`)
