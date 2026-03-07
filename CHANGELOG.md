# Changelog

All notable changes to aidrelay are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.1.0] — 2026-03-07

### First public release

#### Added

**Core infrastructure**
- Electron 34 + electron-vite scaffold with TypeScript strict mode
- Three-process architecture: main, preload (contextBridge), renderer
- SQLite database via better-sqlite3 with versioned migrations
- Typed IPC channel map shared across all processes
- ESLint + Prettier + Husky pre-commit hooks
- Vitest test suite with React Testing Library

**MCP server management**
- Full server CRUD (create, read, update, delete) backed by SQLite
- Server list with TanStack Table (search, sort, filter)
- Server editor — form mode with env var management
- Server editor — JSON mode with Monaco Editor
- Per-server enable/disable toggle
- Per-client toggle matrix (enable/disable a server for specific tools)
- MCP server connection test (stdio spawn + JSON-RPC initialize, Pro)

**Client adapters** — detects installation and manages config for:
- Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`)
- Cursor (`%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` and `~/.cursor/mcp.json`)
- VS Code (Copilot MCP settings)
- Windsurf
- Claude Code
- Zed
- JetBrains IDEs
- Codex CLI

**Safety-first sync**
- 8-step pre-write safety sequence: detect → validate → backup → merge → write temp → rename → verify → log
- Per-client backup history (up to 50 sync backups + permanent pristine backup)
- Atomic writes via temp-file rename
- File watcher (chokidar) — detects external config changes and prompts to import

**AI rules management**
- Rules CRUD with Markdown editor and live preview
- Token budget estimation (word-based heuristic, ~1.3 tokens/word)
- Token budget bar per client with warning threshold
- Rules format converter (`.md` → `.mdc`, `AGENTS.md`, `.cursorrules`, etc.)
- Rules sync to client-specific paths
- Bulk rule import from existing project directories
- Rule scoping: global / project / workspace

**Profiles**
- Profile CRUD (create, edit, delete)
- Profile activation — applies the profile's server and rule set to all clients
- Profile inheritance (child profiles inherit parent overrides)
- Profile diff view — shows what changes when switching
- System tray profile quick-switch

**Secrets management**
- Environment variable secrets stored in Windows Credential Manager via `keytar`
- Secret values injected at sync time — never stored in SQLite or written to disk in plaintext
- Lock/mask/peek UI in the env var editor

**Licensing**
- license-provider license key activation + validation
- Result cached via `electron.safeStorage` (AES-256 on Windows)
- 7-day background re-validation with 7-day grace period for offline use
- Feature gates enforced in main process and renderer (maxServers, maxRules, maxProfiles, gitSync, registryInstall, stackExport, serverTesting)
- UpgradePrompt component for Pro-gated features

**Registry**
- Smithery MCP registry search
- One-click install from registry (Pro)

**Stacks (import/export)**
- Export selected servers + rules as a portable JSON bundle
- Import stacks from JSON — deduplication by name

**Git sync** (Pro)
- GitHub OAuth quick-setup flow
- Manual Git remote configuration (any provider)
- Push / pull with conflict detection (last-write-wins)

**i18n**
- English and German translations via i18next + react-i18next
- Automatic language detection from browser/OS locale

**Backup history UI**
- Per-client timeline of config snapshots
- One-click restore (creates a safety backup of current config first)

**Settings page**
- General preferences (language)
- License activation / deactivation
- Git remote configuration
- About section with update checker

**Auto-update**
- electron-updater integration — checks for updates 10 s after startup
- Progress events broadcast to renderer
- "Restart & Install" action in Settings

**Packaging**
- electron-builder NSIS installer for Windows (x64)
- ASAR packaging with native addon unpacking
- GitHub Actions CI (test on push/PR) + release pipeline (build + publish on tag)

---

[0.1.0]: https://github.com/christianblank91/aidrelay/releases/tag/v0.1.0
