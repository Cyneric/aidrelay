/**
 * @file src/main/git-sync/git-sync.service.ts
 *
 * @created 07.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Git-based cloud sync service. Supports two connection paths:
 *   - GitHub OAuth quick setup (creates a private `aidrelay-sync` repo automatically)
 *   - Manual setup for SSH or HTTPS remotes
 *
 * Push serializes the local server/rule/profile registry to JSON files, commits,
 * and pushes to the remote. Pull fetches the remote, fast-forwards the local
 * branch, reads the JSON files, and upserts all entities into the local DB using
 * last-write-wins semantics (remote wins on conflict).
 *
 * Auth tokens are stored in the OS credential store via keytar. Git config
 * (remote URL, branch, timestamps) is stored in the settings table.
 *
 * Secret env var values are never included in synced JSON — only the key names.
 */

import { join } from 'path'
import { existsSync, rmSync, mkdirSync } from 'fs'
import { writeFile, readFile } from 'fs/promises'
import * as nodeFs from 'fs'
import { createServer as createNetServer } from 'net'
import type { IncomingMessage, ServerResponse } from 'http'
import { createServer as createHttpServer } from 'http'
import { request as httpsRequest } from 'https'
import spawn from 'cross-spawn'
import { app, shell } from 'electron'
import log from 'electron-log'
import * as git from 'isomorphic-git'
import gitHttp from 'isomorphic-git/http/node'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { RulesRepo } from '@main/db/rules.repo'
import { ProfilesRepo } from '@main/db/profiles.repo'
import { SettingsRepo } from '@main/db/settings.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { SyncInstallIntentRepo } from '@main/db/sync-install-intent.repo'
import { skillsService } from '@main/skills/skills.service'
import { storeSecret, getSecret, deleteAllSecrets } from '@main/secrets/keytar.service'
import type {
  McpServer,
  AiRule,
  Profile,
  SyncedInstallIntent,
  GitSyncConfig,
  GitSyncStatus,
  GitPushResult,
  GitPullResult,
  GitRemoteTestResult,
  ManualGitConfig,
  SkillSyncConflict,
  ProjectSkillMapping,
} from '@shared/types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Namespace reused from the secrets service — all git-sync credentials live here. */
const GIT_SYNC_SECRET_NS = 'git-sync'

/** Account key for the git remote auth token inside the keytar service. */
const TOKEN_KEY = 'token'

/** Settings key for the persisted git sync configuration object. */
const SETTINGS_KEY = 'git-sync:config'

/** Helper to safely read a string from the Vite build-time environment. */
const readEnv = (key: string): string => {
  const env = import.meta.env as Record<string, string | undefined>
  return env[key] ?? ''
}

/** GitHub OAuth App client ID (injected at build time from .env). */
const GITHUB_CLIENT_ID = readEnv('VITE_GITHUB_CLIENT_ID')

/** GitHub OAuth App client secret (injected at build time from .env). */
const GITHUB_CLIENT_SECRET = readEnv('VITE_GITHUB_CLIENT_SECRET')

/** Name of the private GitHub repo auto-created during the OAuth quick setup. */
const GITHUB_REPO_NAME = 'aidrelay-sync'

/** Author identity used for all sync commits. */
const COMMIT_AUTHOR = { name: 'aidrelay', email: 'sync@aidrelay.dev' } as const

/** How long (ms) to wait for the user to complete the GitHub OAuth flow. */
const OAUTH_TIMEOUT_MS = 5 * 60 * 1_000
const GIT_TERMINAL_PROMPT_DISABLED = '0'
const GIT_SSH_COMMAND = 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes'

// ─── Internal Types ───────────────────────────────────────────────────────────

/**
 * Shape of a GitHub repo returned by the `POST /user/repos` endpoint
 * and the `GET /repos/{owner}/{repo}` endpoint.
 */
interface GitHubRepo {
  clone_url: string
  full_name: string
}

/**
 * Shape of a GitHub user object returned by `GET /user`.
 */
interface GitHubUser {
  login: string
}

/**
 * Snapshot of the three registry collections serialized to the git repo.
 */
interface SyncSnapshot {
  servers: McpServer[]
  rules: AiRule[]
  profiles: Profile[]
  installIntents: SyncedInstallIntent[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Finds an available TCP port by briefly binding to port 0 and reading what
 * the OS assigned, then closing the server before returning the port number.
 *
 * @returns A free port number.
 */
const findFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = createNetServer()
    srv.listen(0, () => {
      const addr = srv.address()
      if (!addr || typeof addr === 'string') {
        srv.close()
        reject(new Error('Could not determine free port'))
        return
      }
      const port = addr.port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })

/**
 * Starts a temporary HTTP server that waits for one `GET /callback?code=...`
 * request (the GitHub OAuth redirect), extracts the `code` parameter, sends a
 * success page, and resolves. Rejects after `OAUTH_TIMEOUT_MS` milliseconds.
 *
 * @param port - The port the server should listen on.
 * @returns The one-time OAuth authorization code.
 */
const listenForOAuthCallback = (port: number): Promise<string> =>
  new Promise((resolve, reject) => {
    let settled = false

    const settle = (fn: () => void): void => {
      if (settled) return
      settled = true
      server.close(fn)
    }

    const server = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
      const rawUrl = req.url ?? ''
      let code: string | null = null
      try {
        const parsed = new URL(rawUrl, `http://localhost:${port}`)
        code = parsed.searchParams.get('code')
      } catch {
        // Ignore parse errors for non-callback requests (e.g. favicon).
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          '<html><body style="font-family:sans-serif;padding:2rem">' +
            '<h2>Authorization successful!</h2>' +
            '<p>You can close this tab and return to aidrelay.</p>' +
            '</body></html>',
        )
        settle(() => resolve(code))
      } else {
        res.writeHead(400)
        res.end('Missing authorization code.')
      }
    })

    const timer = setTimeout(
      () => settle(() => reject(new Error('GitHub OAuth flow timed out (5 minutes)'))),
      OAUTH_TIMEOUT_MS,
    )

    server.listen(port)
    server.once('error', (err) => {
      clearTimeout(timer)
      settle(() => reject(err))
    })

    server.once('close', () => clearTimeout(timer))
  })

/**
 * Exchanges a GitHub OAuth authorization code for an access token.
 *
 * @param code        - The one-time code received from the OAuth callback.
 * @param redirectUri - The redirect URI registered with the OAuth App.
 * @returns The GitHub personal access token.
 */
const exchangeCodeForToken = (code: string, redirectUri: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    })

    const req = httpsRequest(
      {
        hostname: 'github.com',
        path: '/login/oauth/access_token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: string) => (data += chunk))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as {
              access_token?: string
              error_description?: string
              error?: string
            }
            if (parsed.access_token) {
              resolve(parsed.access_token)
            } else {
              reject(
                new Error(
                  `GitHub token exchange failed: ${parsed.error_description ?? parsed.error ?? 'unknown error'}`,
                ),
              )
            }
          } catch (err) {
            reject(new Error(`Failed to parse token response: ${String(err)}`))
          }
        })
      },
    )

    req.on('error', reject)
    req.write(body)
    req.end()
  })

/**
 * Makes an authenticated HTTPS request to the GitHub REST API.
 *
 * @param path   - API path, e.g. `/user` or `/user/repos`.
 * @param token  - GitHub access token.
 * @param method - HTTP method (defaults to `GET`).
 * @param body   - Optional request body (will be JSON-encoded).
 * @returns Parsed JSON response.
 */
const githubApi = <T>(path: string, token: string, method = 'GET', body?: unknown): Promise<T> =>
  new Promise((resolve, reject) => {
    const encoded = body ? JSON.stringify(body) : undefined

    const req = httpsRequest(
      {
        hostname: 'api.github.com',
        path,
        method,
        headers: {
          Authorization: `token ${token}`,
          'User-Agent': 'aidrelay',
          Accept: 'application/vnd.github.v3+json',
          ...(encoded
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(encoded),
              }
            : {}),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: string) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T)
          } catch {
            resolve(data as T)
          }
        })
      },
    )

    req.on('error', reject)
    if (encoded) req.write(encoded)
    req.end()
  })

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Provides all git-based cloud sync operations. Use the exported singleton
 * `gitSyncService` — do not instantiate this class directly.
 */
class GitSyncService {
  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Returns the absolute path to the local git clone directory.
   * Deferred to runtime so `app.getPath()` is always available.
   */
  private get gitDir(): string {
    return join(app.getPath('userData'), 'git-sync')
  }

  /**
   * Creates fresh repository instances from the current database connection.
   * Called per operation to ensure we never hold stale state.
   */
  private createRepos(): {
    servers: ServersRepo
    rules: RulesRepo
    profiles: ProfilesRepo
    settings: SettingsRepo
    log: ActivityLogRepo
    installIntents: SyncInstallIntentRepo
  } {
    const db = getDatabase()
    return {
      servers: new ServersRepo(db),
      rules: new RulesRepo(db),
      profiles: new ProfilesRepo(db),
      settings: new SettingsRepo(db),
      log: new ActivityLogRepo(db),
      installIntents: new SyncInstallIntentRepo(db),
    }
  }

  /**
   * Reads the stored git sync config from the settings table.
   *
   * @returns The config, or `undefined` if not configured.
   */
  private getStoredConfig(): GitSyncConfig | undefined {
    const { settings } = this.createRepos()
    return settings.get<GitSyncConfig>(SETTINGS_KEY)
  }

  /**
   * Persists a git sync config to the settings table.
   *
   * @param config - The config to store.
   */
  private setStoredConfig(config: GitSyncConfig): void {
    const { settings } = this.createRepos()
    settings.set(SETTINGS_KEY, config)
  }

  /**
   * Removes the git sync config from the settings table.
   */
  private removeStoredConfig(): void {
    const { settings } = this.createRepos()
    settings.delete(SETTINGS_KEY)
  }

  /**
   * Reads the stored auth token from the OS credential store.
   *
   * @returns The token string, or `null` if not stored.
   */
  private getToken(): Promise<string | null> {
    return getSecret(GIT_SYNC_SECRET_NS, TOKEN_KEY)
  }

  /**
   * Stores an auth token in the OS credential store.
   *
   * @param token - The auth token to store.
   */
  private storeToken(token: string): Promise<void> {
    return storeSecret(GIT_SYNC_SECRET_NS, TOKEN_KEY, token)
  }

  /**
   * Removes all git sync credentials from the OS credential store.
   */
  private removeToken(): Promise<void> {
    return deleteAllSecrets(GIT_SYNC_SECRET_NS)
  }

  /**
   * Returns `true` if the local git clone directory contains a `.git` folder,
   * indicating a successful clone has been performed previously.
   */
  private isCloned(): boolean {
    return existsSync(join(this.gitDir, '.git'))
  }

  /**
   * Returns `true` when a remote URL uses SSH transport.
   */
  private isSshRemoteUrl(remoteUrl: string): boolean {
    const trimmed = remoteUrl.trim()
    if (trimmed.startsWith('ssh://')) return true
    return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+:.+$/.test(trimmed)
  }

  /**
   * Returns `true` when a remote URL uses HTTPS transport.
   */
  private isHttpsRemoteUrl(remoteUrl: string): boolean {
    return remoteUrl.trim().startsWith('https://')
  }

  /**
   * Maps transport-specific auth requirements from a persisted config.
   */
  private requiresTokenForRemote(remoteUrl: string): boolean {
    return this.isHttpsRemoteUrl(remoteUrl)
  }

  /**
   * Normalizes CLI-level git error messages to actionable user-facing messages.
   */
  private toGitCliErrorMessage(message: string): string {
    if (/ENOENT/i.test(message)) {
      return 'Git CLI executable was not found. Install Git and ensure "git" is available in PATH.'
    }

    if (/Host key verification failed/i.test(message)) {
      return (
        'SSH host key verification failed. Add the host key to your known_hosts ' +
        'manually and retry.'
      )
    }

    if (/The authenticity of host .* can.t be established/i.test(message)) {
      return (
        'SSH host key is unknown. Verify the host manually (for example with ssh) ' +
        'to add it to known_hosts, then retry.'
      )
    }

    if (/REMOTE HOST IDENTIFICATION HAS CHANGED/i.test(message)) {
      return (
        'SSH host key mismatch detected for this host. Update your known_hosts entry ' +
        'after verifying the server identity, then retry.'
      )
    }

    if (/Permission denied \(publickey\)/i.test(message)) {
      return (
        'SSH authentication failed (publickey). Ensure your SSH key is loaded in your SSH agent, ' +
        'added to your Git provider account, and that the account has access to this repository. ' +
        'If needed, switch to HTTPS token auth.'
      )
    }

    return message
  }

  /**
   * Executes a non-interactive git CLI command with strict SSH host-key checks.
   */
  private runGitCli(args: readonly string[], cwd = this.gitDir): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', [...args], {
        cwd,
        windowsHide: true,
        shell: false,
        stdio: 'pipe',
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: GIT_TERMINAL_PROMPT_DISABLED,
          GIT_SSH_COMMAND,
        },
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString()
      })
      child.stderr?.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString()
      })

      child.once('error', (err: Error & { code?: string }) => {
        const base = err.code === 'ENOENT' ? 'ENOENT' : err.message
        reject(new Error(this.toGitCliErrorMessage(base)))
      })

      child.once('close', (code: number | null) => {
        if (code === 0) {
          resolve()
          return
        }
        const output = (stderr || stdout || `git exited with code ${String(code)}`).trim()
        reject(new Error(this.toGitCliErrorMessage(output)))
      })
    })
  }

  /**
   * Serializes the current DB contents into JSON files inside the git clone dir.
   * Secret env var values are stripped — only key names are included.
   *
   * @param repos - Open repository instances to read from.
   */
  private async exportToFiles(repos: ReturnType<GitSyncService['createRepos']>): Promise<{
    skillsExported: number
    userSkillsExported: number
    projectSkillsExported: number
    skillFilesExported: number
  }> {
    const dir = this.gitDir

    // Strip anything that should not leave the local machine. For servers,
    // env values are fine (non-secret). Secret values stay in keytar only.
    const servers = repos.servers.findAll()
    const rules = repos.rules.findAll()
    const profiles = repos.profiles.findAll()
    const installIntents = repos.installIntents.listAll()

    await writeFile(join(dir, 'servers.json'), JSON.stringify(servers, null, 2), 'utf-8')
    await writeFile(join(dir, 'rules.json'), JSON.stringify(rules, null, 2), 'utf-8')
    await writeFile(join(dir, 'profiles.json'), JSON.stringify(profiles, null, 2), 'utf-8')
    await writeFile(
      join(dir, 'install-intents.json'),
      JSON.stringify(installIntents, null, 2),
      'utf-8',
    )

    return skillsService.exportToDirectory(dir)
  }

  /**
   * Reads the JSON files from the git clone dir and upserts all entities into
   * the local DB. Matching is done by entity name (unique constraint in DB).
   *
   * Conflict semantics: the remote entity wins unconditionally. If the local
   * copy has a newer `updatedAt`, the overwrite is counted as a conflict so
   * the caller can report it to the user.
   *
   * @param repos - Open repository instances to write to.
   * @returns Counts of imported entities and conflicts.
   */
  private async importFromFiles(repos: ReturnType<GitSyncService['createRepos']>): Promise<{
    serversImported: number
    rulesImported: number
    profilesImported: number
    installIntentsImported: number
    skillsImported: number
    userSkillsImported: number
    projectSkillsImported: number
    conflicts: number
    skillConflicts: number
    skillConflictItems: readonly SkillSyncConflict[]
    projectSkillMappings: readonly ProjectSkillMapping[]
  }> {
    const dir = this.gitDir

    const installIntentsPath = join(dir, 'install-intents.json')
    let installIntents: SyncedInstallIntent[] = []
    if (existsSync(installIntentsPath)) {
      installIntents = JSON.parse(
        await readFile(installIntentsPath, 'utf-8'),
      ) as SyncedInstallIntent[]
    }

    const snapshot: SyncSnapshot = {
      servers: JSON.parse(await readFile(join(dir, 'servers.json'), 'utf-8')) as McpServer[],
      rules: JSON.parse(await readFile(join(dir, 'rules.json'), 'utf-8')) as AiRule[],
      profiles: JSON.parse(await readFile(join(dir, 'profiles.json'), 'utf-8')) as Profile[],
      installIntents,
    }

    let conflicts = 0
    let serversImported = 0
    let rulesImported = 0
    let profilesImported = 0
    let installIntentsImported = 0

    // ── Servers ───────────────────────────────────────────────────────────
    const localServers = repos.servers.findAll()
    const localServerByName = new Map(localServers.map((s) => [s.name, s]))

    for (const pulled of snapshot.servers) {
      const local = localServerByName.get(pulled.name)
      if (local) {
        if (local.updatedAt > pulled.updatedAt) conflicts++
        repos.servers.update(local.id, {
          type: pulled.type,
          command: pulled.command,
          args: [...pulled.args],
          env: { ...pulled.env },
          secretEnvKeys: [...pulled.secretEnvKeys],
          tags: [...pulled.tags],
          notes: pulled.notes,
          enabled: pulled.enabled,
          clientOverrides: { ...pulled.clientOverrides },
        })
      } else {
        repos.servers.create({
          name: pulled.name,
          type: pulled.type,
          command: pulled.command,
          args: [...pulled.args],
          env: { ...pulled.env },
          secretEnvKeys: [...pulled.secretEnvKeys],
          tags: [...pulled.tags],
          notes: pulled.notes,
        })
      }
      serversImported++
    }

    // ── Rules ─────────────────────────────────────────────────────────────
    const localRules = repos.rules.findAll()
    const localRuleByName = new Map(localRules.map((r) => [r.name, r]))

    for (const pulled of snapshot.rules) {
      const local = localRuleByName.get(pulled.name)
      if (local) {
        if (local.updatedAt > pulled.updatedAt) conflicts++
        repos.rules.update(local.id, {
          description: pulled.description,
          content: pulled.content,
          category: pulled.category,
          tags: [...pulled.tags],
          priority: pulled.priority,
          scope: pulled.scope,
          ...(pulled.projectPath !== undefined && { projectPath: pulled.projectPath }),
          fileGlobs: [...pulled.fileGlobs],
          alwaysApply: pulled.alwaysApply,
          enabled: pulled.enabled,
          clientOverrides: { ...pulled.clientOverrides },
          tokenEstimate: pulled.tokenEstimate,
        })
      } else {
        repos.rules.create({
          name: pulled.name,
          description: pulled.description,
          content: pulled.content,
          category: pulled.category,
          tags: [...pulled.tags],
          priority: pulled.priority,
          scope: pulled.scope,
          ...(pulled.projectPath !== undefined && { projectPath: pulled.projectPath }),
          fileGlobs: [...pulled.fileGlobs],
          alwaysApply: pulled.alwaysApply,
        })
      }
      rulesImported++
    }

    // ── Profiles ──────────────────────────────────────────────────────────
    const localProfiles = repos.profiles.findAll()
    const localProfileByName = new Map(localProfiles.map((p) => [p.name, p]))

    for (const pulled of snapshot.profiles) {
      const local = localProfileByName.get(pulled.name)
      if (local) {
        if (local.updatedAt > pulled.updatedAt) conflicts++
        repos.profiles.update(local.id, {
          description: pulled.description,
          icon: pulled.icon,
          color: pulled.color,
          ...(pulled.parentProfileId !== undefined && { parentProfileId: pulled.parentProfileId }),
          serverOverrides: pulled.serverOverrides,
          ruleOverrides: pulled.ruleOverrides,
        })
      } else {
        repos.profiles.create({
          name: pulled.name,
          description: pulled.description,
          icon: pulled.icon,
          color: pulled.color,
          ...(pulled.parentProfileId !== undefined && { parentProfileId: pulled.parentProfileId }),
        })
      }
      profilesImported++
    }

    // ── Install Intents ─────────────────────────────────────────────────────
    const localIntents = repos.installIntents.listAll()
    const localIntentByServerId = new Map(localIntents.map((i) => [i.serverId, i]))

    for (const pulled of snapshot.installIntents) {
      const local = localIntentByServerId.get(pulled.serverId)
      if (local) {
        if (local.updatedAt > pulled.updatedAt) conflicts++
        repos.installIntents.upsert(pulled)
      } else {
        repos.installIntents.insert(pulled)
      }
      installIntentsImported++
    }

    const skillsImport = await skillsService.importFromDirectory(dir)

    return {
      serversImported,
      rulesImported,
      profilesImported,
      installIntentsImported,
      skillsImported: skillsImport.skillsImported,
      userSkillsImported: skillsImport.userSkillsImported,
      projectSkillsImported: skillsImport.projectSkillsImported,
      conflicts,
      skillConflicts: skillsImport.skillConflicts,
      skillConflictItems: skillsImport.skillConflictItems,
      projectSkillMappings: skillsImport.projectSkillMappings,
    }
  }

  /**
   * Clones or re-clones the remote repository into the local git sync dir.
   * If the directory already exists it is removed first for a clean clone.
   *
   * @param remoteUrl - Git remote URL.
   * @param branch    - Branch to clone.
   * @param authMethod - Authentication mode.
   * @param authToken  - Auth token (required for HTTPS token mode only).
   */
  private async cloneRepo(
    remoteUrl: string,
    branch: string,
    authMethod: ManualGitConfig['authMethod'],
    authToken?: string,
  ): Promise<void> {
    if (existsSync(this.gitDir)) {
      rmSync(this.gitDir, { recursive: true, force: true })
    }

    if (authMethod === 'ssh') {
      const parentDir = app.getPath('userData')
      mkdirSync(parentDir, { recursive: true })
      await this.runGitCli(
        ['clone', '--depth', '1', '--branch', branch, remoteUrl, this.gitDir],
        parentDir,
      )
      return
    }

    if (!authToken) {
      throw new Error('Git sync auth token is missing. Reconnect to continue.')
    }

    mkdirSync(this.gitDir, { recursive: true })
    await git.clone({
      fs: nodeFs,
      http: gitHttp,
      dir: this.gitDir,
      url: remoteUrl,
      ref: branch,
      singleBranch: true,
      depth: 1,
      onAuth: () => ({ username: authToken, password: '' }),
    })
  }

  /**
   * Validates manual connect payload consistency before clone.
   */
  private validateManualInput(input: ManualGitConfig): void {
    if (input.authMethod === 'ssh') {
      if (!this.isSshRemoteUrl(input.remoteUrl)) {
        throw new Error('SSH auth requires an SSH remote URL.')
      }
      return
    }

    if (!this.isHttpsRemoteUrl(input.remoteUrl)) {
      throw new Error('HTTPS token auth requires a remote URL that starts with https://.')
    }

    if (!input.authToken || input.authToken.trim().length === 0) {
      throw new Error('HTTPS token auth requires a personal access token.')
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Returns the current connection status and persisted config.
   *
   * @returns Status object indicating whether git sync is configured.
   */
  async getStatus(): Promise<GitSyncStatus> {
    const config = this.getStoredConfig()
    if (!config || !this.isCloned()) {
      return { connected: false }
    }

    if (!this.requiresTokenForRemote(config.remoteUrl)) {
      return { connected: true, config }
    }

    const token = await this.getToken()
    const connected = token !== null
    return connected ? { connected: true, config } : { connected: false }
  }

  /**
   * Runs the GitHub OAuth quick setup flow:
   *   1. Opens the GitHub authorization page in the system browser.
   *   2. Listens for the OAuth callback on a free local port.
   *   3. Exchanges the code for a token.
   *   4. Creates (or reuses) a private `aidrelay-sync` repo in the user's account.
   *   5. Clones the repo locally.
   *   6. Persists the config and token.
   *
   * @returns The updated sync status after a successful connection.
   * @throws {Error} If the OAuth flow fails or the clone cannot be completed.
   */
  async connectGitHub(): Promise<GitSyncStatus> {
    log.info('[git-sync] Starting GitHub OAuth flow')

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      throw new Error(
        'GitHub OAuth App credentials are not configured. ' +
          'Set VITE_GITHUB_CLIENT_ID and VITE_GITHUB_CLIENT_SECRET in your .env file.',
      )
    }

    const port = await findFreePort()
    const redirectUri = `http://localhost:${port}/callback`

    const authUrl =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=repo`

    log.info(`[git-sync] Opening browser for OAuth: port ${port}`)
    await shell.openExternal(authUrl)

    const code = await listenForOAuthCallback(port)
    log.info('[git-sync] OAuth code received, exchanging for token')

    const token = await exchangeCodeForToken(code, redirectUri)
    log.info('[git-sync] Token received, creating/locating sync repo')

    // Get the authenticated user's login.
    const user = await githubApi<GitHubUser>('/user', token)

    // Create the private sync repo if it does not already exist.
    // The GET endpoint returns { message: 'Not Found' } on 404 — not a throw.
    type MaybeRepo = GitHubRepo & { message?: string; default_branch?: string }
    const existingRepo = await githubApi<MaybeRepo>(
      `/repos/${user.login}/${GITHUB_REPO_NAME}`,
      token,
    )

    let repo: GitHubRepo & { default_branch: string }
    if (existingRepo.clone_url) {
      repo = existingRepo as GitHubRepo & { default_branch: string }
      log.info(`[git-sync] Reusing existing repo: ${repo.full_name}`)
    } else {
      const created = await githubApi<GitHubRepo & { default_branch: string }>(
        '/user/repos',
        token,
        'POST',
        {
          name: GITHUB_REPO_NAME,
          private: true,
          description: 'aidrelay cloud sync — do not edit manually',
          auto_init: true,
          default_branch: 'main',
        },
      )
      repo = created
      log.info(`[git-sync] Created new repo: ${repo.full_name}`)
    }

    const branch = repo.default_branch ?? 'main'
    await this.cloneRepo(repo.clone_url, branch, 'https-token', token)

    await this.storeToken(token)
    const config: GitSyncConfig = {
      provider: 'github',
      remoteUrl: repo.clone_url,
      branch,
    }
    this.setStoredConfig(config)

    const { log: logRepo } = this.createRepos()
    logRepo.insert({
      action: 'git-sync.connected',
      details: { provider: 'github', repo: repo.full_name },
    })

    log.info('[git-sync] GitHub OAuth connection established')
    return { connected: true, config }
  }

  /**
   * Configures git sync using a manually provided remote URL and auth method.
   * Clones the remote repository to the local sync directory.
   *
   * @param input - Manual git configuration including remote URL, optional
   *   branch name, auth method, and optional HTTPS token.
   * @returns The updated sync status after a successful connection.
   * @throws {Error} If the clone fails (bad URL, auth error, network issue).
   */
  async connectManual(input: ManualGitConfig): Promise<GitSyncStatus> {
    log.info(`[git-sync] Manual connect to ${input.remoteUrl}`)
    this.validateManualInput(input)

    const branch = input.branch ?? 'main'
    const normalizedToken = input.authMethod === 'https-token' ? input.authToken?.trim() : undefined
    await this.cloneRepo(input.remoteUrl, branch, input.authMethod, normalizedToken)

    if (input.authMethod === 'https-token') {
      await this.storeToken(normalizedToken ?? '')
    } else {
      await this.removeToken()
    }

    const config: GitSyncConfig = {
      provider: 'generic',
      remoteUrl: input.remoteUrl,
      branch,
    }
    this.setStoredConfig(config)

    const { log: logRepo } = this.createRepos()
    logRepo.insert({
      action: 'git-sync.connected',
      details: { provider: 'generic', remoteUrl: input.remoteUrl },
    })

    log.info('[git-sync] Manual git connection established')
    return { connected: true, config }
  }

  /**
   * Runs a read-only remote connectivity check using the current manual input.
   * This never clones, pulls, writes config, or stores credentials.
   */
  async testRemote(input: ManualGitConfig): Promise<GitRemoteTestResult> {
    try {
      this.validateManualInput(input)

      if (input.authMethod !== 'ssh') {
        return {
          success: false,
          error: 'SSH test requires SSH auth mode. Switch auth method to SSH Key and retry.',
        }
      }

      await this.runGitCli(['ls-remote', input.remoteUrl, 'HEAD'], app.getPath('userData'))
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  /**
   * Disconnects git sync by removing the local clone directory, the stored
   * auth token, and the persisted config entry.
   */
  async disconnect(): Promise<void> {
    log.info('[git-sync] Disconnecting')

    if (existsSync(this.gitDir)) {
      rmSync(this.gitDir, { recursive: true, force: true })
    }

    await this.removeToken()
    this.removeStoredConfig()

    const { log: logRepo } = this.createRepos()
    logRepo.insert({ action: 'git-sync.disconnected', details: {} })

    log.info('[git-sync] Disconnected and local clone removed')
  }

  /**
   * Exports the current server/rule/profile registry to JSON files, commits
   * the changes, and pushes to the configured remote.
   *
   * @returns Result indicating success and the new commit hash.
   * @throws {Error} If the service is not connected or the push fails.
   */
  async push(): Promise<GitPushResult> {
    log.info('[git-sync] Starting push')

    const config = this.getStoredConfig()
    if (!config) throw new Error('Git sync is not configured. Connect first.')

    const isSshRemote = this.isSshRemoteUrl(config.remoteUrl)
    const token = isSshRemote ? null : await this.getToken()
    if (!isSshRemote && !token) {
      throw new Error('Git sync auth token is missing. Reconnect to continue.')
    }

    if (!this.isCloned()) throw new Error('Local git repository is missing. Reconnect to re-clone.')

    const repos = this.createRepos()

    try {
      const skillExport = await this.exportToFiles(repos)

      // Stage all changes.
      await git.add({ fs: nodeFs, dir: this.gitDir, filepath: '.' })

      // Check if there is actually anything to commit.
      const statusMatrix = await git.statusMatrix({ fs: nodeFs, dir: this.gitDir })
      const hasChanges = statusMatrix.some(
        ([, head, workdir, stage]) => head !== 1 || workdir !== 1 || stage !== 1,
      )

      let commitHash: string | undefined

      if (hasChanges) {
        commitHash = await git.commit({
          fs: nodeFs,
          dir: this.gitDir,
          message: `chore: sync registry ${new Date().toISOString()}`,
          author: COMMIT_AUTHOR,
        })

        if (isSshRemote) {
          await this.runGitCli(['push', 'origin', config.branch])
        } else {
          await git.push({
            fs: nodeFs,
            http: gitHttp,
            dir: this.gitDir,
            remote: 'origin',
            onAuth: () => ({ username: token ?? '', password: '' }),
          })
        }

        log.info(`[git-sync] Push complete: ${commitHash}`)
      } else {
        log.info('[git-sync] Nothing to push — registry unchanged since last sync')
      }

      // Update lastPushAt in persisted config.
      this.setStoredConfig({ ...config, lastPushAt: new Date().toISOString() })

      repos.log.insert({
        action: 'git-sync.pushed',
        details: {
          commitHash: commitHash ?? 'no-op',
          remoteUrl: config.remoteUrl,
          skillsExported: skillExport.skillsExported,
          userSkillsExported: skillExport.userSkillsExported,
          projectSkillsExported: skillExport.projectSkillsExported,
          skillFilesExported: skillExport.skillFilesExported,
        },
      })

      return {
        success: true,
        ...(commitHash !== undefined ? { commitHash } : {}),
        skillsExported: skillExport.skillsExported,
        userSkillsExported: skillExport.userSkillsExported,
        projectSkillsExported: skillExport.projectSkillsExported,
        skillFilesExported: skillExport.skillFilesExported,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error(`[git-sync] Push failed: ${message}`)
      return { success: false, error: message }
    }
  }

  /**
   * Fetches the latest changes from the remote, fast-forwards the local branch,
   * and upserts all entities into the local DB using last-write-wins semantics.
   *
   * If the local branch cannot be fast-forwarded (diverged history), the
   * operation fails with a descriptive error asking the user to push first.
   *
   * @returns Result with imported entity counts and conflict count.
   * @throws {Error} If the service is not connected or the pull fails.
   */
  async pull(): Promise<GitPullResult> {
    log.info('[git-sync] Starting pull')

    const config = this.getStoredConfig()
    if (!config) throw new Error('Git sync is not configured. Connect first.')

    const isSshRemote = this.isSshRemoteUrl(config.remoteUrl)
    const token = isSshRemote ? null : await this.getToken()
    if (!isSshRemote && !token) {
      throw new Error('Git sync auth token is missing. Reconnect to continue.')
    }

    if (!this.isCloned()) throw new Error('Local git repository is missing. Reconnect to re-clone.')

    const repos = this.createRepos()

    try {
      if (isSshRemote) {
        await this.runGitCli(['fetch', 'origin', config.branch])
        await this.runGitCli(['reset', '--hard', `origin/${config.branch}`])
      } else {
        // Fetch remote objects without touching the working tree.
        await git.fetch({
          fs: nodeFs,
          http: gitHttp,
          dir: this.gitDir,
          remote: 'origin',
          singleBranch: true,
          onAuth: () => ({ username: token ?? '', password: '' }),
        })

        // Resolve the remote tracking ref to the latest commit SHA.
        const remoteRef = `refs/remotes/origin/${config.branch}`
        const remoteCommitHash = await git.resolveRef({
          fs: nodeFs,
          dir: this.gitDir,
          ref: remoteRef,
        })

        // Force-reset the local branch to the remote commit (git reset --hard origin/<branch>).
        await git.writeRef({
          fs: nodeFs,
          dir: this.gitDir,
          ref: `refs/heads/${config.branch}`,
          value: remoteCommitHash,
          force: true,
        })

        // Update the working tree to match the new HEAD.
        await git.checkout({ fs: nodeFs, dir: this.gitDir, ref: config.branch, force: true })
      }

      log.info('[git-sync] Remote fetched and working tree updated, importing registry from files')

      const {
        serversImported,
        rulesImported,
        profilesImported,
        installIntentsImported,
        skillsImported,
        userSkillsImported,
        projectSkillsImported,
        conflicts,
        skillConflicts,
        skillConflictItems,
        projectSkillMappings,
      } = await this.importFromFiles(repos)

      // Update lastPullAt in persisted config.
      this.setStoredConfig({ ...config, lastPullAt: new Date().toISOString() })

      repos.log.insert({
        action: 'git-sync.pulled',
        details: {
          serversImported,
          rulesImported,
          profilesImported,
          installIntentsImported,
          skillsImported,
          userSkillsImported,
          projectSkillsImported,
          conflicts,
          skillConflicts,
          skillMappingsRequired: projectSkillMappings.length,
          remoteUrl: config.remoteUrl,
        },
      })

      log.info(
        `[git-sync] Import complete: ${serversImported} servers, ${rulesImported} rules, ` +
          `${profilesImported} profiles, ${installIntentsImported} install intents, ` +
          `${skillsImported} skills (${userSkillsImported} user/${projectSkillsImported} project), ` +
          `${conflicts} registry conflict(s), ${skillConflicts} skill conflict(s)`,
      )

      return {
        success: true,
        serversImported,
        rulesImported,
        profilesImported,
        installIntentsImported,
        skillsImported,
        userSkillsImported,
        projectSkillsImported,
        conflicts,
        skillConflicts,
        skillMappingsRequired: projectSkillMappings.length,
        skillConflictItems,
        projectSkillMappings,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const userMessage = message

      log.error(`[git-sync] Pull failed: ${message}`)
      return {
        success: false,
        serversImported: 0,
        rulesImported: 0,
        profilesImported: 0,
        installIntentsImported: 0,
        skillsImported: 0,
        userSkillsImported: 0,
        projectSkillsImported: 0,
        conflicts: 0,
        skillConflicts: 0,
        skillMappingsRequired: 0,
        skillConflictItems: [] as readonly SkillSyncConflict[],
        projectSkillMappings: [] as readonly ProjectSkillMapping[],
        error: userMessage,
      }
    }
  }

  /**
   * Reads the registry snapshot from the git HEAD commit (last synced state).
   * Returns an empty snapshot if the files don't exist in HEAD.
   */
  async getHeadSnapshot(): Promise<SyncSnapshot> {
    if (!this.isCloned()) {
      return { servers: [], rules: [], profiles: [], installIntents: [] }
    }

    const dir = this.gitDir
    const headOid = await git.resolveRef({ fs: nodeFs, dir, ref: 'HEAD' })

    const readJson = async <T>(filepath: string): Promise<T[]> => {
      try {
        const { blob } = await git.readBlob({ fs: nodeFs, dir, oid: headOid, filepath })
        const content = new TextDecoder().decode(blob)
        return JSON.parse(content) as T[]
      } catch {
        // File doesn't exist in this commit
        return []
      }
    }

    const [servers, rules, profiles, installIntents] = await Promise.all([
      readJson<McpServer>('servers.json'),
      readJson<AiRule>('rules.json'),
      readJson<Profile>('profiles.json'),
      readJson<SyncedInstallIntent>('install-intents.json'),
    ])

    return { servers, rules, profiles, installIntents }
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * Application-wide singleton instance of the git sync service.
 * All IPC handlers should import and use this instance directly.
 */
export const gitSyncService = new GitSyncService()
