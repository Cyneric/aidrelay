/**
 * @file src/main/skills/skills.service.ts
 *
 * @description Core skills domain service for curated install, manual create,
 * lifecycle management, legacy migration, and git-sync integration.
 */

import { app } from 'electron'
import log from 'electron-log'
import { createHash, randomUUID } from 'crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import { basename, dirname, join } from 'path'
import { gunzipSync } from 'zlib'
import { getDatabase } from '@main/db/connection'
import { SettingsRepo } from '@main/db/settings.repo'
import { detectRecentWorkspaces } from '@main/rules/workspace-detector'
import { extractSkillDescription } from './skill-description'
import type {
  CuratedSkill,
  InstalledSkill,
  ProjectSkillMapping,
  SkillFileDiff,
  SkillInstallPreview,
  SkillLocation,
  SkillMigrationItem,
  SkillMigrationPreview,
  SkillScope,
  SkillSyncConflict,
} from '@shared/types'
import type {
  ApplySkillMigrationInput,
  CreateSkillInput,
  DeleteSkillInput,
  InstallCuratedSkillInput,
  SetSkillEnabledInput,
} from '@shared/channels'

const CURATED_REPO = 'openai/skills'
const CURATED_BRANCH = 'main'
const CURATED_ROOT = 'skills/.curated'
const CURATED_TTL_MS = 5 * 60 * 1_000

const KNOWN_PROJECTS_KEY = 'skills:known-projects'
const SKILL_SYNC_STATE_KEY = 'skills:sync-state'

const METADATA_FILENAME = '.aidrelay-skill.json'
const SKILL_FILENAME = 'SKILL.md'

interface FrontmatterInfo {
  name?: string
}

interface PreparedCuratedInstall {
  preview: SkillInstallPreview
  files: Map<string, Buffer>
}

interface SkillMetadataFile {
  source?: InstalledSkill['source']
}

interface StoredSkillSyncConflict extends SkillSyncConflict {
  readonly targetPath: string
  readonly remoteFiles: Readonly<Record<string, string>>
}

interface SkillsSyncState {
  readonly conflicts: readonly StoredSkillSyncConflict[]
  readonly projectPathByKey: Readonly<Record<string, string>>
  readonly mappings: readonly ProjectSkillMapping[]
  readonly updatedAt: string
}

interface SkillsExportResult {
  readonly skillsExported: number
  readonly userSkillsExported: number
  readonly projectSkillsExported: number
  readonly skillFilesExported: number
}

interface SkillsImportResult {
  readonly skillsImported: number
  readonly userSkillsImported: number
  readonly projectSkillsImported: number
  readonly skillConflicts: number
  readonly skillConflictItems: readonly SkillSyncConflict[]
  readonly projectSkillMappings: readonly ProjectSkillMapping[]
}

interface ManifestProjectEntry {
  key: string
  projectPath: string
  skills: string[]
}

interface SkillsManifest {
  version: 1
  generatedAt: string
  projects: ManifestProjectEntry[]
}

const readJsonFile = <T>(path: string): T | null => {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

const writeJsonFile = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8')
}

const readDirectoryFiles = (rootDir: string): Map<string, Buffer> => {
  const out = new Map<string, Buffer>()
  if (!existsSync(rootDir)) return out

  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = join(dir, entry.name)
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(absolute, relative)
      } else if (entry.isFile()) {
        out.set(relative, readFileSync(absolute))
      }
    }
  }

  try {
    walk(rootDir, '')
  } catch {
    return new Map<string, Buffer>()
  }
  return out
}

const writeDirectoryFiles = (targetDir: string, files: Map<string, Buffer>): void => {
  mkdirSync(targetDir, { recursive: true })
  for (const [relative, content] of files.entries()) {
    const absolute = join(targetDir, ...relative.split('/'))
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, content)
  }
}

const replaceDirectoryAtomically = (targetDir: string, files: Map<string, Buffer>): void => {
  const parent = dirname(targetDir)
  const targetName = basename(targetDir)
  const tmpDir = join(parent, `${targetName}.aidrelay-tmp-${Date.now()}`)
  const backupDir = join(parent, `${targetName}.aidrelay-bak-${Date.now()}`)

  mkdirSync(parent, { recursive: true })
  writeDirectoryFiles(tmpDir, files)

  if (!existsSync(targetDir)) {
    renameSync(tmpDir, targetDir)
    return
  }

  try {
    renameSync(targetDir, backupDir)
    renameSync(tmpDir, targetDir)
    rmSync(backupDir, { recursive: true, force: true })
  } catch (err) {
    if (existsSync(backupDir) && !existsSync(targetDir)) {
      renameSync(backupDir, targetDir)
    }
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
    throw err
  }
}

const normalizeSkillName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')

const isValidSkillName = (value: string): boolean => /^[a-z0-9-]{1,64}$/.test(value)

const isBufferEqual = (a: Buffer, b: Buffer): boolean => a.length === b.length && a.equals(b)

const summarizeBuffer = (content: Buffer): string => {
  if (content.includes(0)) return `[binary ${content.length} bytes]`
  const text = content.toString('utf-8').replace(/\r\n/g, '\n')
  return text.split('\n').slice(0, 6).join('\n')
}

const diffFileMaps = (before: Map<string, Buffer>, after: Map<string, Buffer>): SkillFileDiff[] => {
  const paths = new Set<string>([...before.keys(), ...after.keys()])
  const rows: SkillFileDiff[] = []

  for (const path of Array.from(paths).sort()) {
    const left = before.get(path)
    const right = after.get(path)
    if (left === undefined && right !== undefined) {
      rows.push({ path, change: 'added', after: summarizeBuffer(right) })
      continue
    }
    if (left !== undefined && right === undefined) {
      rows.push({ path, change: 'removed', before: summarizeBuffer(left) })
      continue
    }
    if (left !== undefined && right !== undefined && !isBufferEqual(left, right)) {
      rows.push({
        path,
        change: 'modified',
        before: summarizeBuffer(left),
        after: summarizeBuffer(right),
      })
    }
  }

  return rows
}

const parseSkillFrontmatter = (content: string): FrontmatterInfo => {
  const match = /^---\s*\n([\s\S]*?)\n---\s*/.exec(content)
  if (!match) return {}
  const body = match[1] ?? ''
  const out: FrontmatterInfo = {}

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (key === 'name') out.name = value
  }

  return out
}

const parseDisableSkills = (toml: string): string[] => {
  const match = /^\s*disable_skills\s*=\s*\[([\s\S]*?)\]/m.exec(toml)
  if (!match) return []
  const body = match[1] ?? ''
  const out: string[] = []
  const regex = /"((?:\\.|[^"\\])*)"/g
  let current: RegExpExecArray | null = regex.exec(body)
  while (current) {
    out.push((current[1] ?? '').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
    current = regex.exec(body)
  }
  return out
}

const serializeDisableSkills = (skills: readonly string[]): string =>
  `disable_skills = [${skills.map((name) => `"${name}"`).join(', ')}]`

const readTarString = (buffer: Buffer): string => {
  const nul = buffer.indexOf(0)
  const end = nul >= 0 ? nul : buffer.length
  return buffer.subarray(0, end).toString('utf-8')
}

const parseTarOctal = (buffer: Buffer): number => {
  const raw = readTarString(buffer).trim()
  if (!raw) return 0
  return Number.parseInt(raw, 8) || 0
}

class SkillsService {
  private curatedCache: { at: number; skills: CuratedSkill[] } | null = null

  private createRepos(): { settings: SettingsRepo } {
    const db = getDatabase()
    return { settings: new SettingsRepo(db) }
  }

  private get homeDir(): string {
    return process.env['USERPROFILE'] ?? app.getPath('home')
  }

  private get userSkillsRoot(): string {
    return join(this.homeDir, '.agents', 'skills')
  }

  private get legacyUserSkillsRoot(): string {
    return join(this.homeDir, '.codex', 'skills')
  }

  private get codexConfigTomlPath(): string {
    return join(this.homeDir, '.codex', 'config.toml')
  }

  private projectSkillsRoot(projectPath: string): string {
    return join(projectPath, '.agents', 'skills')
  }

  private legacyProjectSkillsRoot(projectPath: string): string {
    return join(projectPath, '.codex', 'skills')
  }

  private getKnownProjects(): string[] {
    const { settings } = this.createRepos()
    const known = settings.get<string[]>(KNOWN_PROJECTS_KEY) ?? []
    return known.filter((path) => existsSync(path))
  }

  private rememberProject(projectPath: string): void {
    const normalized = projectPath.trim()
    if (!normalized) return
    const next = Array.from(new Set([...this.getKnownProjects(), normalized])).sort()
    const { settings } = this.createRepos()
    settings.set(KNOWN_PROJECTS_KEY, next)
  }

  private allProjectCandidates(extraProjectPath?: string): string[] {
    const detected = detectRecentWorkspaces()
    const known = this.getKnownProjects()
    const merged = [...known, ...detected]
    if (extraProjectPath) merged.push(extraProjectPath)
    return Array.from(new Set(merged))
      .filter((path) => existsSync(path))
      .sort()
  }

  private getSyncState(): SkillsSyncState {
    const { settings } = this.createRepos()
    const state = settings.get<SkillsSyncState>(SKILL_SYNC_STATE_KEY)
    return (
      state ?? {
        conflicts: [],
        projectPathByKey: {},
        mappings: [],
        updatedAt: new Date(0).toISOString(),
      }
    )
  }

  private setSyncState(state: SkillsSyncState): void {
    const { settings } = this.createRepos()
    settings.set(SKILL_SYNC_STATE_KEY, state)
  }

  private loadDisabledSkillNames(): Set<string> {
    if (!existsSync(this.codexConfigTomlPath)) return new Set()
    const content = readFileSync(this.codexConfigTomlPath, 'utf-8')
    return new Set(parseDisableSkills(content))
  }

  private writeDisabledSkillNames(names: Set<string>): void {
    const sorted = Array.from(names).sort((a, b) => a.localeCompare(b))
    const serialized = serializeDisableSkills(sorted)

    let current = ''
    if (existsSync(this.codexConfigTomlPath)) {
      current = readFileSync(this.codexConfigTomlPath, 'utf-8')
    }

    const next = /^\s*disable_skills\s*=\s*\[[\s\S]*?\]/m.test(current)
      ? current.replace(/^\s*disable_skills\s*=\s*\[[\s\S]*?\]/m, serialized)
      : current.trim().length > 0
        ? `${current.replace(/\s+$/g, '')}\n\n${serialized}\n`
        : `${serialized}\n`

    mkdirSync(dirname(this.codexConfigTomlPath), { recursive: true })
    writeFileSync(this.codexConfigTomlPath, next, 'utf-8')
  }

  private async githubJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'aidrelay',
        Accept: 'application/vnd.github+json',
      },
    })
    if (!response.ok) {
      throw new Error(`GitHub request failed (${response.status}) for ${url}`)
    }
    return (await response.json()) as T
  }

  private async githubBytes(url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'aidrelay' },
    })
    if (!response.ok) {
      throw new Error(`GitHub download failed (${response.status}) for ${url}`)
    }
    const arr = await response.arrayBuffer()
    return Buffer.from(arr)
  }

  private curatedRawUrl(slug: string, relativePath: string): string {
    const [owner, repo] = CURATED_REPO.split('/')
    return `https://raw.githubusercontent.com/${owner}/${repo}/${CURATED_BRANCH}/${CURATED_ROOT}/${slug}/${relativePath}`
  }

  private async fetchCuratedSkillFilesFromTarball(slug: string): Promise<Map<string, Buffer>> {
    const [owner, repo] = CURATED_REPO.split('/')
    const tarballUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${CURATED_BRANCH}`
    const gz = await this.githubBytes(tarballUrl)
    const tar = gunzipSync(gz)
    const out = new Map<string, Buffer>()
    const marker = `/${CURATED_ROOT}/${slug}/`

    let offset = 0
    while (offset + 512 <= tar.length) {
      const header = tar.subarray(offset, offset + 512)
      const isZeroBlock = header.every((byte) => byte === 0)
      if (isZeroBlock) break

      const name = readTarString(header.subarray(0, 100))
      const prefix = readTarString(header.subarray(345, 500))
      const fullPath = prefix ? `${prefix}/${name}` : name
      const typeFlag = header[156]
      const size = parseTarOctal(header.subarray(124, 136))
      const dataStart = offset + 512
      const dataEnd = dataStart + size

      if ((typeFlag === 0 || typeFlag === 48) && size > 0) {
        const idx = fullPath.indexOf(marker)
        if (idx >= 0) {
          const relative = fullPath.slice(idx + marker.length)
          if (relative.length > 0) {
            out.set(relative, Buffer.from(tar.subarray(dataStart, dataEnd)))
          }
        }
      }

      const dataBlocks = Math.ceil(size / 512)
      offset = dataStart + dataBlocks * 512
    }

    if (!out.has(SKILL_FILENAME)) {
      throw new Error(`Curated skill "${slug}" is missing ${SKILL_FILENAME}`)
    }
    return out
  }

  private async listCuratedSlugsFromTarball(): Promise<string[]> {
    const [owner, repo] = CURATED_REPO.split('/')
    const tarballUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${CURATED_BRANCH}`
    const gz = await this.githubBytes(tarballUrl)
    const tar = gunzipSync(gz)
    const marker = `/${CURATED_ROOT}/`
    const out = new Set<string>()

    let offset = 0
    while (offset + 512 <= tar.length) {
      const header = tar.subarray(offset, offset + 512)
      const isZeroBlock = header.every((byte) => byte === 0)
      if (isZeroBlock) break

      const name = readTarString(header.subarray(0, 100))
      const prefix = readTarString(header.subarray(345, 500))
      const fullPath = prefix ? `${prefix}/${name}` : name
      const size = parseTarOctal(header.subarray(124, 136))
      const dataStart = offset + 512

      const idx = fullPath.indexOf(marker)
      if (idx >= 0) {
        const remainder = fullPath.slice(idx + marker.length)
        const slug = remainder.split('/')[0]
        if (slug) out.add(slug)
      }

      const dataBlocks = Math.ceil(size / 512)
      offset = dataStart + dataBlocks * 512
    }

    return Array.from(out).sort((a, b) => a.localeCompare(b))
  }

  private async fetchCuratedSkillFiles(slug: string): Promise<Map<string, Buffer>> {
    interface RepoEntry {
      type: 'file' | 'dir'
      name: string
      path: string
      download_url: string | null
    }

    const [owner, repo] = CURATED_REPO.split('/')
    const rootPath = `${CURATED_ROOT}/${slug}`
    const files = new Map<string, Buffer>()

    const walk = async (path: string, relativePrefix: string): Promise<void> => {
      const entries = await this.githubJson<RepoEntry[]>(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${CURATED_BRANCH}`,
      )
      for (const entry of entries) {
        if (entry.type === 'dir') {
          const nextPrefix = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name
          await walk(entry.path, nextPrefix)
        } else if (entry.type === 'file' && entry.download_url) {
          const relative = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name
          files.set(relative, await this.githubBytes(entry.download_url))
        }
      }
    }

    try {
      await walk(rootPath, '')
    } catch (err) {
      const message = String(err)
      if (message.includes('GitHub request failed (403)')) {
        log.warn(`[skills] GitHub API rate-limited for ${slug}; falling back to tarball download`)
        return this.fetchCuratedSkillFilesFromTarball(slug)
      }
      throw err
    }
    if (!files.has(SKILL_FILENAME)) {
      throw new Error(`Curated skill "${slug}" is missing ${SKILL_FILENAME}`)
    }
    return files
  }

  private resolveSkillPath(
    scope: SkillScope,
    skillName: string,
    projectPath?: string,
  ): SkillLocation {
    if (scope === 'project' && (!projectPath || projectPath.trim().length === 0)) {
      throw new Error('projectPath is required for project-scoped skills.')
    }
    const root = scope === 'user' ? this.userSkillsRoot : this.projectSkillsRoot(projectPath!)
    const skillPath = join(root, skillName)
    return {
      scope,
      skillName,
      skillPath,
      skillMdPath: join(skillPath, SKILL_FILENAME),
      ...(scope === 'project' ? { projectPath: projectPath! } : {}),
    }
  }

  private readInstalledSkillAt(
    location: SkillLocation,
    disabledNames: Set<string>,
  ): InstalledSkill | null {
    if (!existsSync(location.skillMdPath)) return null

    const content = readFileSync(location.skillMdPath, 'utf-8')
    const description = extractSkillDescription(content)
    const metadataPath = join(location.skillPath, METADATA_FILENAME)
    const metadata = readJsonFile<SkillMetadataFile>(metadataPath)

    return {
      ...location,
      ...(description.description ? { description: description.description } : {}),
      descriptionSource: description.source,
      enabled: !disabledNames.has(location.skillName),
      source: metadata?.source ?? 'unknown',
      updatedAt: statSync(location.skillMdPath).mtime.toISOString(),
    }
  }

  private scanInstalledSkillsInRoot(
    scope: SkillScope,
    root: string,
    disabledNames: Set<string>,
    projectPath?: string,
  ): InstalledSkill[] {
    if (!existsSync(root)) return []
    let dirs: Array<{ name: string; isDirectory: () => boolean }>
    try {
      dirs = readdirSync(root, { withFileTypes: true }) as unknown as Array<{
        name: string
        isDirectory: () => boolean
      }>
    } catch {
      return []
    }
    const onlyDirs = dirs.filter((entry) => entry.isDirectory())
    const out: InstalledSkill[] = []
    for (const entry of onlyDirs) {
      const location = this.resolveSkillPath(scope, entry.name, projectPath)
      const installed = this.readInstalledSkillAt(location, disabledNames)
      if (installed) out.push(installed)
    }
    return out
  }

  private async ensureCrossScopeUniqueSkillName(
    skillName: string,
    except?: Pick<SkillLocation, 'scope' | 'skillPath'>,
  ): Promise<void> {
    const installed = await this.listInstalled()
    const duplicate = installed.find(
      (skill) =>
        skill.skillName === skillName &&
        (except === undefined ||
          skill.scope !== except.scope ||
          skill.skillPath !== except.skillPath),
    )
    if (duplicate) {
      throw new Error(
        `Skill name "${skillName}" already exists in ${duplicate.scope} scope at ${duplicate.skillPath}.`,
      )
    }
  }

  private buildConflict(
    base: Omit<SkillSyncConflict, 'id' | 'createdAt' | 'files'>,
    localFiles: Map<string, Buffer>,
    remoteFiles: Map<string, Buffer>,
    targetPath: string,
  ): StoredSkillSyncConflict {
    return {
      ...base,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      files: diffFileMaps(localFiles, remoteFiles),
      targetPath,
      remoteFiles: Object.fromEntries(
        Array.from(remoteFiles.entries()).map(([path, content]) => [
          path,
          content.toString('base64'),
        ]),
      ),
    }
  }

  listInstalled(): Promise<InstalledSkill[]> {
    const disabledNames = this.loadDisabledSkillNames()
    const userSkills = this.scanInstalledSkillsInRoot('user', this.userSkillsRoot, disabledNames)
    const projectSkills = this.allProjectCandidates().flatMap((projectPath) =>
      this.scanInstalledSkillsInRoot(
        'project',
        this.projectSkillsRoot(projectPath),
        disabledNames,
        projectPath,
      ),
    )

    return Promise.resolve(
      [...userSkills, ...projectSkills].sort((a, b) =>
        a.skillName !== b.skillName
          ? a.skillName.localeCompare(b.skillName)
          : a.scope !== b.scope
            ? a.scope.localeCompare(b.scope)
            : (a.projectPath ?? '').localeCompare(b.projectPath ?? ''),
      ),
    )
  }

  async listCurated(): Promise<CuratedSkill[]> {
    const now = Date.now()
    if (this.curatedCache && now - this.curatedCache.at < CURATED_TTL_MS) {
      return this.curatedCache.skills
    }

    interface CuratedEntry {
      name: string
      path: string
      type: 'dir' | 'file'
    }

    const [owner, repo] = CURATED_REPO.split('/')
    let directories: CuratedEntry[] = []
    try {
      const entries = await this.githubJson<CuratedEntry[]>(
        `https://api.github.com/repos/${owner}/${repo}/contents/${CURATED_ROOT}?ref=${CURATED_BRANCH}`,
      )
      directories = entries.filter((entry) => entry.type === 'dir')
    } catch (err) {
      if (String(err).includes('GitHub request failed (403)')) {
        log.warn('[skills] GitHub API rate-limited for curated list; falling back to tarball')
        const slugs = await this.listCuratedSlugsFromTarball()
        directories = slugs.map((slug) => ({
          name: slug,
          path: `${CURATED_ROOT}/${slug}`,
          type: 'dir',
        }))
      } else {
        throw err
      }
    }
    const skills = await Promise.all(
      directories.map(async (entry) => {
        let description = ''
        let descriptionSource: CuratedSkill['descriptionSource'] = 'none'
        try {
          const content = (
            await this.githubBytes(this.curatedRawUrl(entry.name, SKILL_FILENAME))
          ).toString('utf-8')
          const extracted = extractSkillDescription(content)
          description = extracted.description
          descriptionSource = extracted.source
        } catch (err) {
          log.warn(`[skills] failed to read curated metadata for ${entry.name}: ${String(err)}`)
        }

        return {
          name: entry.name,
          slug: entry.name,
          description,
          descriptionSource,
          repository: CURATED_REPO,
          path: `${CURATED_ROOT}/${entry.name}`,
        } satisfies CuratedSkill
      }),
    )

    const sorted = skills.sort((a, b) => a.slug.localeCompare(b.slug))
    this.curatedCache = { at: now, skills: sorted }
    return sorted
  }

  detectWorkspaces(): string[] {
    return detectRecentWorkspaces()
  }

  async prepareInstall(
    skillName: string,
    scope: SkillScope,
    projectPath?: string,
  ): Promise<SkillInstallPreview> {
    return (await this.prepareCuratedInstall(skillName, scope, projectPath)).preview
  }

  private async prepareCuratedInstall(
    skillName: string,
    scope: SkillScope,
    projectPath?: string,
  ): Promise<PreparedCuratedInstall> {
    const slug = normalizeSkillName(skillName)
    const remoteFiles = await this.fetchCuratedSkillFiles(slug)
    const skillDoc = remoteFiles.get(SKILL_FILENAME)?.toString('utf-8') ?? ''
    const frontmatter = parseSkillFrontmatter(skillDoc)
    const canonicalName = normalizeSkillName(frontmatter.name ?? slug)

    if (!isValidSkillName(canonicalName)) {
      throw new Error(`Curated skill name "${frontmatter.name ?? slug}" is invalid.`)
    }

    const location = this.resolveSkillPath(scope, canonicalName, projectPath)
    await this.ensureCrossScopeUniqueSkillName(canonicalName, {
      scope: location.scope,
      skillPath: location.skillPath,
    })
    const description = extractSkillDescription(skillDoc)

    const localFiles = readDirectoryFiles(location.skillPath)
    const files = diffFileMaps(localFiles, remoteFiles)
    const exists = existsSync(location.skillPath)

    return {
      files: remoteFiles,
      preview: {
        skillName: canonicalName,
        scope,
        ...(location.projectPath ? { projectPath: location.projectPath } : {}),
        targetPath: location.skillPath,
        ...(description.description ? { summary: description.description } : {}),
        exists,
        conflict: exists && files.length > 0,
        files,
      },
    }
  }

  async installCurated(input: InstallCuratedSkillInput): Promise<InstalledSkill> {
    const prepared = await this.prepareCuratedInstall(
      input.skillName,
      input.scope,
      input.projectPath,
    )
    if (prepared.preview.exists && prepared.preview.conflict && !input.replace) {
      throw new Error(
        'Install target already exists and differs. Call skills:prepare-install and confirm replace.',
      )
    }

    const location = this.resolveSkillPath(
      input.scope,
      prepared.preview.skillName,
      input.projectPath,
    )
    replaceDirectoryAtomically(location.skillPath, prepared.files)
    writeJsonFile(join(location.skillPath, METADATA_FILENAME), { source: 'curated' })

    if (input.scope === 'project' && input.projectPath) {
      this.rememberProject(input.projectPath)
    }

    const installed = this.readInstalledSkillAt(location, this.loadDisabledSkillNames())
    if (!installed) throw new Error(`Installed skill could not be read from ${location.skillPath}`)
    return installed
  }

  async create(input: CreateSkillInput): Promise<InstalledSkill> {
    const normalizedName = normalizeSkillName(input.name)
    if (!isValidSkillName(normalizedName)) {
      throw new Error('Skill name must be lowercase letters, digits, or hyphens (max 64 chars).')
    }

    const location = this.resolveSkillPath(input.scope, normalizedName, input.projectPath)
    await this.ensureCrossScopeUniqueSkillName(normalizedName)

    if (existsSync(location.skillPath)) {
      throw new Error(`Skill already exists at ${location.skillPath}`)
    }

    mkdirSync(location.skillPath, { recursive: true })
    const description = input.description?.trim() || 'Add a concise skill description.'
    const starter = [
      '---',
      `name: ${normalizedName}`,
      `description: ${description}`,
      '---',
      '',
      `# ${normalizedName}`,
      '',
      '## Quick Start',
      '',
      '- Describe how this skill should be used.',
      '',
    ].join('\n')

    writeFileSync(location.skillMdPath, starter, 'utf-8')
    for (const resource of input.resources ?? []) {
      mkdirSync(join(location.skillPath, resource), { recursive: true })
    }
    writeJsonFile(join(location.skillPath, METADATA_FILENAME), { source: 'manual' })

    if (input.scope === 'project' && input.projectPath) {
      this.rememberProject(input.projectPath)
    }

    const installed = this.readInstalledSkillAt(location, this.loadDisabledSkillNames())
    if (!installed) throw new Error(`Created skill could not be read from ${location.skillPath}`)
    return installed
  }

  delete(input: DeleteSkillInput): Promise<void> {
    const location = this.resolveSkillPath(
      input.scope,
      normalizeSkillName(input.skillName),
      input.projectPath,
    )
    if (existsSync(location.skillPath)) {
      rmSync(location.skillPath, { recursive: true, force: true })
    }

    const disabled = this.loadDisabledSkillNames()
    if (disabled.delete(location.skillName)) {
      this.writeDisabledSkillNames(disabled)
    }
    return Promise.resolve()
  }

  setEnabled(input: SetSkillEnabledInput): Promise<void> {
    const normalized = normalizeSkillName(input.skillName)
    const location = this.resolveSkillPath(input.scope, normalized, input.projectPath)
    if (!existsSync(location.skillMdPath)) {
      throw new Error(`Skill does not exist at ${location.skillMdPath}`)
    }

    const disabled = this.loadDisabledSkillNames()
    if (input.enabled) disabled.delete(normalized)
    else disabled.add(normalized)
    this.writeDisabledSkillNames(disabled)
    return Promise.resolve()
  }

  migrateLegacyPreview(): Promise<SkillMigrationPreview> {
    const items: SkillMigrationItem[] = []

    const collect = (scope: SkillScope, legacyRoot: string, projectPath?: string): void => {
      if (!existsSync(legacyRoot)) return
      for (const entry of readdirSync(legacyRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const name = normalizeSkillName(entry.name)
        if (!isValidSkillName(name)) continue
        const sourcePath = join(legacyRoot, entry.name)
        const sourceSkill = join(sourcePath, SKILL_FILENAME)
        if (!existsSync(sourceSkill)) continue
        const target = this.resolveSkillPath(scope, name, projectPath)
        items.push({
          scope,
          skillName: name,
          sourcePath,
          targetPath: target.skillPath,
          ...(projectPath ? { projectPath } : {}),
          conflict: existsSync(target.skillPath),
        })
      }
    }

    collect('user', this.legacyUserSkillsRoot)
    for (const projectPath of this.allProjectCandidates()) {
      collect('project', this.legacyProjectSkillsRoot(projectPath), projectPath)
    }

    return Promise.resolve({ hasLegacy: items.length > 0, items })
  }

  async migrateLegacyApply(input: ApplySkillMigrationInput): Promise<SkillMigrationPreview> {
    let migrated = 0
    let skipped = 0

    for (const item of input.items) {
      const sourcePath = item.skillPath
      const target = this.resolveSkillPath(item.scope, item.skillName, item.projectPath)
      if (!existsSync(sourcePath) || !existsSync(join(sourcePath, SKILL_FILENAME))) {
        skipped++
        continue
      }
      if (existsSync(target.skillPath)) {
        skipped++
        continue
      }
      const files = readDirectoryFiles(sourcePath)
      writeDirectoryFiles(target.skillPath, files)
      writeJsonFile(join(target.skillPath, METADATA_FILENAME), { source: 'legacy' })
      if (item.scope === 'project' && item.projectPath) {
        this.rememberProject(item.projectPath)
      }
      migrated++
    }

    const preview = await this.migrateLegacyPreview()
    return { ...preview, migrated, skipped }
  }

  listSyncConflicts(): SkillSyncConflict[] {
    return this.getSyncState().conflicts.filter((conflict) => !conflict.resolved)
  }

  resolveSyncConflict(conflictId: string, resolution: 'local' | 'remote'): Promise<void> {
    const state = this.getSyncState()
    const conflict = state.conflicts.find((entry) => entry.id === conflictId)
    if (!conflict) {
      throw new Error(`Skill sync conflict ${conflictId} not found.`)
    }

    if (resolution === 'remote') {
      const remoteMap = new Map<string, Buffer>(
        Object.entries(conflict.remoteFiles).map(([path, base64]) => [
          path,
          Buffer.from(base64, 'base64'),
        ]),
      )
      replaceDirectoryAtomically(conflict.targetPath, remoteMap)
    }

    const remaining = state.conflicts.filter((entry) => entry.id !== conflictId)
    this.setSyncState({
      ...state,
      conflicts: remaining,
      updatedAt: new Date().toISOString(),
    })
    return Promise.resolve()
  }

  async exportToDirectory(syncDir: string): Promise<SkillsExportResult> {
    const skillsRoot = join(syncDir, 'skills')
    const userRoot = join(skillsRoot, 'user')
    const projectsRoot = join(skillsRoot, 'projects')

    rmSync(skillsRoot, { recursive: true, force: true })
    mkdirSync(userRoot, { recursive: true })
    mkdirSync(projectsRoot, { recursive: true })

    const installed = await this.listInstalled()
    let skillFilesExported = 0
    let userSkillsExported = 0
    let projectSkillsExported = 0

    const projectManifest = new Map<string, ManifestProjectEntry>()

    for (const skill of installed) {
      const files = readDirectoryFiles(skill.skillPath)
      skillFilesExported += files.size

      if (skill.scope === 'user') {
        writeDirectoryFiles(join(userRoot, skill.skillName), files)
        userSkillsExported++
        continue
      }

      const projectPath = skill.projectPath ?? ''
      const key = createHash('sha1').update(projectPath.toLowerCase()).digest('hex').slice(0, 12)
      const entry = projectManifest.get(key) ?? {
        key,
        projectPath,
        skills: [],
      }
      entry.skills.push(skill.skillName)
      projectManifest.set(key, entry)

      writeDirectoryFiles(join(projectsRoot, key, skill.skillName), files)
      projectSkillsExported++
    }

    const manifest: SkillsManifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      projects: Array.from(projectManifest.values()).sort((a, b) => a.key.localeCompare(b.key)),
    }
    writeJsonFile(join(skillsRoot, 'manifest.json'), manifest)

    return {
      skillsExported: userSkillsExported + projectSkillsExported,
      userSkillsExported,
      projectSkillsExported,
      skillFilesExported,
    }
  }

  async importFromDirectory(syncDir: string): Promise<SkillsImportResult> {
    const skillsRoot = join(syncDir, 'skills')
    const userRoot = join(skillsRoot, 'user')
    const projectsRoot = join(skillsRoot, 'projects')
    const manifest = readJsonFile<SkillsManifest>(join(skillsRoot, 'manifest.json'))

    if (!existsSync(skillsRoot)) {
      return {
        skillsImported: 0,
        userSkillsImported: 0,
        projectSkillsImported: 0,
        skillConflicts: this.listSyncConflicts().length,
        skillConflictItems: this.listSyncConflicts(),
        projectSkillMappings: this.getSyncState().mappings,
      }
    }

    let userSkillsImported = 0
    let projectSkillsImported = 0
    const newConflicts: StoredSkillSyncConflict[] = []
    const mappings: ProjectSkillMapping[] = []
    const state = this.getSyncState()
    const pathByKey: Record<string, string> = { ...state.projectPathByKey }

    const existingByName = new Map(
      (await this.listInstalled()).map((skill) => [skill.skillName, skill]),
    )

    if (existsSync(userRoot)) {
      for (const entry of readdirSync(userRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const skillName = normalizeSkillName(entry.name)
        const target = this.resolveSkillPath('user', skillName)
        const remotePath = join('skills', 'user', skillName)
        const remoteFiles = readDirectoryFiles(join(userRoot, entry.name))
        const localFiles = readDirectoryFiles(target.skillPath)

        const duplicate = existingByName.get(skillName)
        const duplicateAtTarget = duplicate && duplicate.skillPath === target.skillPath
        if (duplicate && !duplicateAtTarget && !existsSync(target.skillPath)) {
          newConflicts.push(
            this.buildConflict(
              {
                skillName,
                scope: 'user',
                localPath: duplicate.skillPath,
                remotePath,
              },
              readDirectoryFiles(duplicate.skillPath),
              remoteFiles,
              target.skillPath,
            ),
          )
          continue
        }

        if (!existsSync(target.skillPath)) {
          writeDirectoryFiles(target.skillPath, remoteFiles)
          userSkillsImported++
          existingByName.set(skillName, {
            ...target,
            descriptionSource: 'none',
            enabled: true,
            source: 'unknown',
            updatedAt: new Date().toISOString(),
          })
          continue
        }

        const diff = diffFileMaps(localFiles, remoteFiles)
        if (diff.length === 0) continue

        newConflicts.push(
          this.buildConflict(
            {
              skillName,
              scope: 'user',
              localPath: target.skillPath,
              remotePath,
            },
            localFiles,
            remoteFiles,
            target.skillPath,
          ),
        )
      }
    }

    for (const projectEntry of manifest?.projects ?? []) {
      const candidatePaths = this.allProjectCandidates()
      const preferred =
        pathByKey[projectEntry.key] ||
        (existsSync(projectEntry.projectPath) ? projectEntry.projectPath : undefined) ||
        candidatePaths.find(
          (path) =>
            basename(path).toLowerCase() === basename(projectEntry.projectPath).toLowerCase(),
        )

      if (!preferred) {
        mappings.push({
          remoteProjectKey: projectEntry.key,
          remoteProjectPath: projectEntry.projectPath,
          skillCount: projectEntry.skills.length,
          status: 'pending',
        })
        continue
      }

      pathByKey[projectEntry.key] = preferred
      this.rememberProject(preferred)

      mappings.push({
        remoteProjectKey: projectEntry.key,
        remoteProjectPath: projectEntry.projectPath,
        localProjectPath: preferred,
        skillCount: projectEntry.skills.length,
        status: 'mapped',
      })

      const remoteProjectRoot = join(projectsRoot, projectEntry.key)
      if (!existsSync(remoteProjectRoot)) continue

      for (const skillDir of readdirSync(remoteProjectRoot, { withFileTypes: true })) {
        if (!skillDir.isDirectory()) continue
        const skillName = normalizeSkillName(skillDir.name)
        const target = this.resolveSkillPath('project', skillName, preferred)
        const remotePath = join('skills', 'projects', projectEntry.key, skillName)
        const remoteFiles = readDirectoryFiles(join(remoteProjectRoot, skillDir.name))
        const localFiles = readDirectoryFiles(target.skillPath)

        const duplicate = existingByName.get(skillName)
        const duplicateAtTarget = duplicate && duplicate.skillPath === target.skillPath
        if (duplicate && !duplicateAtTarget && !existsSync(target.skillPath)) {
          newConflicts.push(
            this.buildConflict(
              {
                skillName,
                scope: 'project',
                projectPath: preferred,
                localPath: duplicate.skillPath,
                remotePath,
              },
              readDirectoryFiles(duplicate.skillPath),
              remoteFiles,
              target.skillPath,
            ),
          )
          continue
        }

        if (!existsSync(target.skillPath)) {
          writeDirectoryFiles(target.skillPath, remoteFiles)
          projectSkillsImported++
          existingByName.set(skillName, {
            ...target,
            descriptionSource: 'none',
            enabled: true,
            source: 'unknown',
            updatedAt: new Date().toISOString(),
          })
          continue
        }

        const diff = diffFileMaps(localFiles, remoteFiles)
        if (diff.length === 0) continue

        newConflicts.push(
          this.buildConflict(
            {
              skillName,
              scope: 'project',
              projectPath: preferred,
              localPath: target.skillPath,
              remotePath,
            },
            localFiles,
            remoteFiles,
            target.skillPath,
          ),
        )
      }
    }

    const existingConflictByKey = new Map(
      state.conflicts.map((conflict) => [
        `${conflict.scope}|${conflict.projectPath ?? ''}|${conflict.skillName}`,
        conflict,
      ]),
    )
    for (const conflict of newConflicts) {
      existingConflictByKey.set(
        `${conflict.scope}|${conflict.projectPath ?? ''}|${conflict.skillName}`,
        conflict,
      )
    }

    const nextConflicts = Array.from(existingConflictByKey.values()).filter((c) => !c.resolved)
    const nextState: SkillsSyncState = {
      conflicts: nextConflicts,
      projectPathByKey: pathByKey,
      mappings,
      updatedAt: new Date().toISOString(),
    }
    this.setSyncState(nextState)

    const skillConflictItems = nextConflicts as SkillSyncConflict[]
    const pendingMappings = mappings.filter((mapping) => mapping.status === 'pending')

    return {
      skillsImported: userSkillsImported + projectSkillsImported,
      userSkillsImported,
      projectSkillsImported,
      skillConflicts: skillConflictItems.length,
      skillConflictItems,
      projectSkillMappings: pendingMappings,
    }
  }
}

export const skillsService = new SkillsService()
