import { existsSync } from 'fs'
import { join } from 'path'

const normalizePathEntry = (entry: string): string => {
  const trimmed = entry.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const windowsPathDirectories = (): string[] =>
  (process.env['PATH'] ?? '')
    .split(';')
    .map(normalizePathEntry)
    .filter((entry) => entry.length > 0)

const windowsPathExtensions = (): string[] =>
  (process.env['PATHEXT'] ?? '.EXE;.CMD;.BAT;.COM')
    .split(';')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
    .map((entry) => (entry.startsWith('.') ? entry : `.${entry}`))

/**
 * Returns true when one of the given command names resolves from PATH.
 *
 * Supports extensionless launchers (e.g. `code`) and PATHEXT suffixes
 * (e.g. `.cmd`, `.exe`) on Windows.
 */
export const hasWindowsCommandOnPath = (commandNames: readonly string[]): boolean => {
  if (process.platform !== 'win32') return false

  const pathDirs = windowsPathDirectories()
  if (pathDirs.length === 0 || commandNames.length === 0) return false

  const pathExt = windowsPathExtensions()

  for (const dir of pathDirs) {
    for (const command of commandNames) {
      const normalizedCommand = command.trim()
      if (normalizedCommand.length === 0) continue

      if (existsSync(join(dir, normalizedCommand))) {
        return true
      }

      for (const ext of pathExt) {
        if (existsSync(join(dir, `${normalizedCommand}${ext}`))) {
          return true
        }
      }
    }
  }

  return false
}
