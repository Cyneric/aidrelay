# aidrelay — AI Developer Relay — Project Plan

**Product:** aidrelay (AI Developer Relay)
**Author:** Christian Blank <christianblank91@protonmail.com>
**Date:** 07.03.2026
**License:** Proprietary (closed source) with generous free tier
**Status:** Planning — Final

---

## 0. Key Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Name** | aidrelay — AI Developer Relay | Unique, "aid" double meaning, no conflicts |
| **License** | Proprietary / closed source | Revenue protection via LemonSqueezy license keys |
| **Payments** | LemonSqueezy | Built-in license key API + VAT handling, no self-hosted server needed |
| **Platform** | Windows-first | macOS/Linux added later, abstractions in place |
| **Framework** | Electron + TypeScript + React | Full TS stack, no Rust learning curve |
| **Git sync** | GitHub OAuth quick setup + advanced manual | Best of both worlds |
| **Open source components** | Adapter spec, rules format, stacks/templates | Community contributions without undermining revenue |
| **User auth** | No own accounts — third-party only | LemonSqueezy key + GitHub OAuth + Smithery API key |
| **MCP registries** | Smithery (primary) + PulseMCP + clipboard import | Unified search across sources |
| **Rules scope** | Global + project-based | Auto-detect projects + sync-to-project button |

---

## 1. Vision

A cross-platform desktop application that centralizes **both MCP server configuration and AI rules/preferences management** across all AI development tools. Configure once, sync everywhere — with proper secret handling, connection testing, profiles for different contexts, and cross-machine portability.

This is not just an MCP config manager. It's a **unified AI development environment manager** that handles the two biggest pain points developers face when using multiple AI coding tools: scattered MCP configs and fragmented rules/instructions.

**Target audience:** Developers who use multiple AI coding tools (Claude Code, Cursor, VS Code, Windsurf, JetBrains, etc.) and are tired of manually managing scattered JSON config files and duplicating rules across `.cursor/rules/`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, etc.

**Differentiators over existing tools:**

- Windows-first (no existing GUI tool is trustworthy on Windows)
- Closed source, proprietary — auditable architecture, published security practices
- Built by a known developer with a public track record (Blank IT Solutions)
- **Unified MCP + Rules management** (no existing tool does both)
- **Profile system** for context switching (work/personal/project-specific)
- **Rules editor with per-tool format generation** (write once, deploy to all tools)
- **Token budget estimation** for rules (know your cost before syncing)
- Connection testing (verify servers actually work)
- Git-based cross-machine sync (GitHub OAuth quick setup + advanced manual)
- Proper secret management (Windows Credential Manager, not plaintext JSON)
- LemonSqueezy-powered licensing with generous free tier

---

## 2. Competitive Landscape

| Tool | Stars | Windows | Open Source | Trust Level |
|------|-------|---------|-------------|-------------|
| Conductor | 8 | Build from source | Yes (MIT) | Low (new, 1 dev) |
| MCP Manager (MS Store) | N/A | Yes | No | Very low (unknown dev, 0 reviews) |
| mcp_editor (stkerr) | ~10 | Electron (buildable) | Yes | Low (hobby project) |
| mcp_editor (kucukkanat) | ~20 | Yes (NSIS build) | Yes | Low (small project) |
| **aidrelay** | — | **Primary target** | **Proprietary** | **High (known dev, auditable arch)** |

**Rules sync tools (CLI-only, no GUI):**

| Tool | Approach | GUI | Profiles | MCP mgmt |
|------|----------|-----|----------|----------|
| rulesync | CLI, `.rulesync/*.md` → generate per tool | No | No | No |
| ruler | CLI, `.ruler/` directory → distribute | No | No | No |
| ai-rulez | CLI, `.ai-rulez/` YAML config | No | Team profiles | MCP server built-in |
| ai-nexus | CLI, semantic routing for Claude Code | No | No | No |
| skillbook | CLI, central Git library → symlink | No | No | No |
| **aidrelay** | **GUI + CLI**, visual editor, profiles, MCP + rules | **Yes** | **Yes** | **Yes** |

**Key insight:** Multiple CLI tools exist for rules sync, but **none have a GUI** and **none combine MCP + rules management**. This is our differentiator — a single desktop app that replaces both the MCP config managers AND the rules sync tools.

---

## 3. Feature Tiers

### P0 — MVP (Core)

These features define the minimum viable product.

#### 3.1 Client Auto-Detection

Scan the filesystem for known AI tool config files. Report which clients are installed, their config paths, and current server count.

**Supported clients (MVP):**

| Client | Config Path (Windows) | Schema Key | Notes |
|--------|----------------------|------------|-------|
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` | `mcpServers` | MSIX variant: `%LOCALAPPDATA%\Packages\Claude_*/LocalCache/Roaming/Claude/` |
| Claude Code | `%USERPROFILE%\.claude.json` | `mcpServers` | Also `~/.claude/settings.json` |
| Cursor | `%USERPROFILE%\.cursor\mcp.json` | `mcpServers` | Global config |
| VS Code | `%APPDATA%\Code\User\mcp.json` | `servers` | Different schema key! |
| Windsurf | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | `mcpServers` | |
| JetBrains | Auto-config via IDE MCP settings | N/A | Copy-to-clipboard approach |
| Zed | `settings.json` → `context_servers` | `context_servers` | Different schema entirely |
| Codex CLI | `%USERPROFILE%\.codex\config.json` | TBD | Verify schema |

**Cross-platform paths (for later):**

| Client | macOS | Linux |
|--------|-------|-------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | N/A |
| Cursor | `~/.cursor/mcp.json` | `~/.cursor/mcp.json` |
| VS Code | `~/Library/Application Support/Code/User/mcp.json` | `~/.config/Code/User/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` |

#### 3.2 Config Import

Parse existing JSON configs from all detected clients. Merge into unified server registry with deduplication (match by server name + command).

#### 3.3 Unified Server Registry

Single source of truth stored locally (SQLite or JSON file in app data directory). Each server entry:

```typescript
interface McpServer {
  id: string;                          // UUID
  name: string;                        // User-facing name (e.g. "chrome-devtools")
  type: "stdio" | "sse" | "http";     // Transport type
  command: string;                     // e.g. "npx"
  args: string[];                      // e.g. ["-y", "chrome-devtools-mcp@latest"]
  env: Record<string, string>;         // Non-secret env vars
  secretEnvKeys: string[];             // Keys stored in OS credential store
  enabled: boolean;                    // Global toggle
  clientOverrides: Record<string, {    // Per-client toggles
    enabled: boolean;
  }>;
  tags: string[];                      // User-defined categories
  notes: string;                       // Free-form notes
  createdAt: string;                   // ISO timestamp
  updatedAt: string;                   // ISO timestamp
}
```

#### 3.4 Visual Server Editor

Two modes:

- **Form mode:** Structured fields for command, args, env vars, transport type. Add/remove env vars dynamically. Toggle secret storage per env var.
- **JSON mode:** Monaco editor with JSON schema validation. Bidirectional sync with form mode.

#### 3.5 Per-Server, Per-Client Toggle

Matrix view: rows = servers, columns = clients. Toggle each server on/off per client. Visual indicator for sync status (synced, out of sync, client not found).

#### 3.6 One-Click Sync

Write the correct JSON format to each client's config file. Each client gets a dedicated adapter that:

1. Reads the existing config (preserve non-MCP settings)
2. Merges in our managed servers
3. Writes back the file
4. Validates the output

**Schema adapters needed:**

- `mcpServers` format (Claude Desktop, Cursor, Windsurf, Claude Code)
- `servers` format (VS Code)
- `context_servers` format (Zed)
- Clipboard/manual format (JetBrains)

#### 3.7 Auto-Backup

Before every sync write, snapshot the target config file to a backup directory:

```
%APPDATA%/aidrelay/backups/
  claude-desktop/
    2026-03-07T14-30-00.json
    2026-03-07T15-00-00.json
  cursor/
    ...
```

Configurable retention (default: 30 days, max 50 backups per client).

#### 3.8 Secret Management

API keys and tokens stored in the OS credential store instead of plaintext JSON.

- **Windows:** Credential Manager (via `keytar` or `electron-keychain`)
- **macOS:** Keychain (future)
- **Linux:** Secret Service / libsecret (future)

Flow:

1. User marks an env var as "secret" in the editor
2. Value is stored in OS credential store under namespace `aidrelay/{serverName}/{envKey}`
3. At sync time, secrets are injected into the generated JSON
4. Secrets never stored in our own database/config file

---

### P1 — Power User Features

#### 3.9 Rules & Preferences Management (NEW — major differentiator)

The second pillar of the app. Manage AI coding rules/instructions from a single place and deploy them to all tools in their native format.

**The problem (validated by community):**
- Claude Code uses `CLAUDE.md` + `.claude/rules/*.md`
- Cursor uses `.cursor/rules/*.mdc` (with YAML frontmatter for globs, alwaysApply)
- VS Code / Copilot uses `.github/copilot-instructions.md`
- Windsurf uses `.windsurfrules`
- Gemini CLI uses `GEMINI.md` or `.gemini/settings.json`
- Codex uses `.codex/AGENTS.md`
- AGENTS.md is emerging as a cross-tool standard

Tools like `rulesync`, `ruler`, `ai-rulez`, and `ai-nexus` all exist as CLI solutions proving demand is massive. None have a GUI.

**Data model:**

```typescript
interface AiRule {
  id: string;
  name: string;                          // e.g. "typescript-strict"
  description: string;                   // Human-readable purpose
  content: string;                       // The actual rule content (Markdown)
  category: string;                      // e.g. "code-style", "security", "testing"
  tags: string[];
  enabled: boolean;                      // Global toggle
  priority: "critical" | "high" | "normal" | "low";
  
  // Scope
  scope: "global" | "project";           // Global = user-level, Project = workspace-level
  projectPath?: string;                  // Only for scope="project" — target project directory
  
  // Targeting
  fileGlobs: string[];                   // e.g. ["**/*.ts", "**/*.tsx"] for auto-attach
  alwaysApply: boolean;                  // Cursor-specific: always include in context
  
  // Per-client toggles
  clientOverrides: Record<ClientId, {
    enabled: boolean;
  }>;
  
  // Metadata
  tokenEstimate: number;                 // Approximate token count (auto-calculated)
  createdAt: string;
  updatedAt: string;
}
```

**Features:**
- Visual Markdown editor for rules with live preview
- Per-rule toggle per client (same matrix pattern as MCP servers)
- **Global vs project scope toggle** per rule
- Token count estimation per rule (word-based heuristic: word count * 1.3)
- Total token budget view: "Your active rules for Cursor cost ~4,200 tokens"
- Import existing rules from any tool (parse CLAUDE.md, .mdc files, AGENTS.md, etc.)
- Export/sync: generate the correct format for each tool (scope-aware)
- Rule categories with drag-and-drop ordering
- Duplicate detection (flag rules with similar content across imports)

**Scope behavior:**
- **Global rules** sync to user-level config paths (apply everywhere)
- **Project rules** sync to project-level paths within a specific workspace directory
- Rules page has a scope toggle: **[Global Rules]** | **[Project Rules ▾ C:\dev\onet-frontend]**
- "Sync to project" button: file picker to choose target project directory
- Project auto-detection: scan recent VS Code and Cursor workspace paths for known project directories

**Rules output paths per client (scope-aware):**

| Client | Global Path | Project Path (in project root) |
|--------|------------|-------------------------------|
| Claude Code | `~/.claude/rules/{name}.md` | `.claude/rules/{name}.md` |
| Claude Code | N/A | `CLAUDE.md` |
| Cursor | `~/.cursor/rules/{name}.mdc` | `.cursor/rules/{name}.mdc` |
| VS Code / Copilot | User settings | `.github/copilot-instructions.md` |
| Windsurf | User config | `.windsurfrules` |
| Gemini CLI | `~/.gemini/` | `GEMINI.md` |
| Codex | N/A | `.codex/AGENTS.md` |
| Cross-tool | N/A | `AGENTS.md` |

#### 3.10 Profiles (NEW — major differentiator)

Named configuration profiles that bundle a specific set of MCP servers + rules + client toggles. Switch instantly between contexts.

```typescript
interface Profile {
  id: string;
  name: string;                          // e.g. "Work - ONET", "Personal", "Freelance"
  description: string;
  icon: string;                          // Emoji or icon identifier
  color: string;                         // Accent color for visual distinction
  
  // What's included
  serverOverrides: Record<string, {      // Server ID → override
    enabled: boolean;
    clientOverrides?: Record<ClientId, { enabled: boolean }>;
  }>;
  ruleOverrides: Record<string, {        // Rule ID → override
    enabled: boolean;
    clientOverrides?: Record<ClientId, { enabled: boolean }>;
  }>;
  
  // Inherit from another profile
  parentProfileId?: string;              // Template/base profile
  
  createdAt: string;
  updatedAt: string;
}
```

**Features:**
- Create unlimited named profiles ("Work - Bruker", "Freelance - Yalla", "Personal", "Gaming Projects")
- Each profile has its own server + rule toggle states
- Profile inheritance: create a new profile "from template" based on an existing one
- One-click profile switching: applies all server + rule overrides and syncs to all clients
- Visual indicator in title bar / tray showing active profile
- Profile-specific env var overrides (e.g., different API keys for work vs personal)
- Quick-switch via keyboard shortcut or tray icon

**Use cases:**
- **Work vs Personal:** Different MCP servers (company GitHub, internal tools) and rules (company coding standards)
- **Project-specific:** ONET project has strict React 19 rules; freelance project uses different stack
- **Client projects:** Each freelance client might have their own coding standards and tooling
- **Experimentation:** "Testing" profile with experimental MCP servers that you don't want polluting your main setup

#### 3.11 Server Connection Testing

Spawn the MCP server process, send an `initialize` request via MCP protocol, verify it responds with capabilities. Show pass/fail/timeout status per server.

Implementation:

- For stdio servers: spawn process, write JSON-RPC `initialize` to stdin, read response from stdout
- For SSE/HTTP servers: send HTTP request to the configured URL
- Timeout: 10 seconds (configurable)
- Show last test result + timestamp in server list

#### 3.10 File Watcher

Watch all managed client config files for external changes. When a change is detected:

- Parse the new config
- Diff against our registry
- Show notification: "Cursor config changed externally. Import changes?"
- User can accept (merge into registry) or dismiss

Use `chokidar` (or `fs.watch` with debouncing) for file watching.

#### 3.11 Activity Log

Timestamped log of all actions:

- Server added/edited/deleted
- Sync performed (which clients, success/failure)
- Config imported
- External change detected
- Backup created

Stored in SQLite. Viewable in-app with filtering by action type and date range.

#### 3.12 Import/Export (Stacks)

Export a set of servers as a portable JSON bundle ("stack"). Secrets are auto-stripped on export.

```typescript
interface McpStack {
  name: string;
  description: string;
  version: string;
  servers: Omit<McpServer, "id" | "secretEnvKeys" | "clientOverrides">[];
  exportedAt: string;
}
```

Import from file or URL. On import, prompt user to fill in any required env vars.

#### 3.13 MCP Server Discovery & Installation (Unified Search)

Three paths to add MCP servers, all accessible from the "Add Server" flow:

**Path 1: Registry Search (unified across sources)**

Query multiple registries simultaneously and deduplicate results:

- **Smithery Registry** (primary) — ~7,300+ servers, semantic search, verified badges
  - API: `https://registry.smithery.ai/servers?q={query}` (requires free API key)
  - Returns: `qualifiedName`, `displayName`, `description`, `verified`, `useCount`, `remote`
  - Supports filters: `owner:`, `repo:`, `is:deployed`, `is:verified`
- **PulseMCP** (secondary) — ~8,590+ servers, daily-updated directory
  - Broader coverage, catches newer/community servers not yet on Smithery
- **Official MCP Registry** (upstream reference) — `registry.modelcontextprotocol.io`
  - Designed for programmatic consumption by subregistries
  - Used as fallback / cross-reference source

UI: Unified search bar → results from all sources merged + deduped → source badges ([Smithery ✓], [PulseMCP], [Official]) → one-click "Add to aidrelay" → prompt for required env vars → optionally mark secrets for credential store.

**Path 2: Manual Entry**

- Form mode: structured fields for command, args, env vars, transport type
- JSON mode: paste raw JSON in Monaco editor with validation
- Both modes support marking env vars as secrets

**Path 3: Clipboard Import**

Almost every MCP server README contains a ready-to-paste JSON config block:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@some/mcp-server"],
      "env": { "API_KEY": "your-key" }
    }
  }
}
```
Auto-detect this format from clipboard, parse it, and pre-fill the server form. User just needs to fill in any API keys. This covers the 90% case where someone reads a GitHub README and wants to add the server.

**Registry API keys management:**
- Smithery API key: free, stored in Windows Credential Manager
- PulseMCP: check if public or key required (resolve in Phase 5)
- Settings page has a "Registry Connections" section to manage these keys

#### 3.17 Git-Based Cloud Sync

Push/pull the server registry + rules (minus secrets) to a private Git repo for cross-machine portability.

- User configures a Git remote URL + auth (SSH key or HTTPS token)
- On sync: commit current registry, push to remote
- On pull: fetch, merge, resolve conflicts (last-write-wins or manual)
- Secrets stay local (only `secretEnvKeys` array is synced, not values)

Use `isomorphic-git` (pure JS, no native deps) for Git operations.

#### 3.18 Community-Requested Features (validated by forum posts / GitHub issues)

These are features the community has been explicitly asking for:

**a) Token budget estimation and warnings**
- Per-rule token count (auto-calculated on save)
- Per-client total token budget: "Cursor: 4,200 tokens in active rules"
- Warning when approaching known limits (Cursor has ~20K token limit for rules)
- Recommendation to use file globs / auto-attach instead of alwaysApply for large rules

**b) Rule format auto-conversion**
- Import `.mdc` → internal markdown (strip Cursor-specific frontmatter)
- Import `CLAUDE.md` → split into individual rules
- Import `AGENTS.md` → parse sections into rules
- Export handles all format differences automatically

**c) Bulk import from existing project**
- Point at a project directory
- Auto-detect all rule files (`.cursor/rules/`, `CLAUDE.md`, `AGENTS.md`, `.windsurfrules`, etc.)
- Import all into the registry, dedup, and tag by source

**d) Project-level vs global rules**
- Distinguish between user-level rules (global, apply everywhere) and project-level rules (scoped to a workspace)
- When syncing, generate project-level files in the project directory and global rules in the user config directory
- Cursor supports both global (`~/.cursor/rules/`) and project (`.cursor/rules/`) scopes

**e) Rule templates / community library**
- Browse curated rule templates (TypeScript strict mode, React best practices, security, etc.)
- Install from a public registry (could be our own, or aggregate from GitHub)
- Share rules as stacks (same export mechanism as MCP server stacks)

**f) Config validation**
- Validate JSON syntax before writing to client configs
- Warn about common issues (duplicate server names, missing env vars, invalid paths)
- Dry-run mode: show what would change without writing

---

### P2 — Nice to Have

#### 3.15 Profiles

Multiple server configurations for different contexts (e.g. "Work", "Personal", "ONET Project"). Switch profiles to change which servers are active. Each profile is a named subset of the registry with its own client toggle matrix.

#### 3.16 CLI Companion

Headless mode for automation and scripting:

```bash
aidrelay sync                    # Sync all clients
aidrelay add <name> <command>    # Add a server
aidrelay list                    # List servers
aidrelay test <name>             # Test a server
aidrelay export <stack-name>     # Export stack
aidrelay import <file-or-url>    # Import stack
```

Ship as a separate npm package that shares the core library.

#### 3.17 System Tray

Background process with tray icon. Quick actions: sync all, view status, open main window. Optional auto-sync on file changes.

#### 3.18 Auto-Update Notifications

Check npm registry for newer versions of installed MCP servers. Show badge on servers with available updates.

---

## 4. Tech Stack

### 4.1 Desktop Shell

**Electron** (full TypeScript, no Rust dependency)

| Concern | Decision |
|---------|----------|
| Framework | Electron 34+ (latest stable) |
| Build tool | electron-builder (NSIS installer for Windows, DMG for macOS) |
| Process model | Main process (Node.js) for file I/O, credential store, Git. Renderer process for UI. |
| IPC | Electron's contextBridge + ipcMain/ipcRenderer with typed channels |

### 4.2 Frontend (Renderer Process)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript (strict mode) | Non-negotiable |
| Framework | React 19 | Daily driver |
| Build | Vite | Fast HMR, known quantity |
| Styling | Tailwind CSS 4 + shadcn/ui | Default stack, polished components |
| State | Zustand | Lightweight, familiar |
| Forms | React Hook Form + Zod | Server config validation |
| Code editor | Monaco Editor (`@monaco-editor/react`) | JSON editing with schema validation |
| Routing | TanStack Router | Multi-page navigation |
| Tables | TanStack Table | Server list, toggle matrix |
| Toasts | Sonner | Default preference |
| Icons | Lucide React | Consistent with shadcn |
| i18n | i18next + react-i18next | English + German from day one |
| Testing | Vitest + React Testing Library | Unit + component tests |

### 4.3 Backend (Main Process)

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Data persistence | `better-sqlite3` | Fast, single-file, no server. Stores registry, activity log, settings. |
| Secret storage | `keytar` | Cross-platform OS credential store access |
| File watching | `chokidar` | Reliable fs watching with debouncing |
| Git operations | `isomorphic-git` | Pure JS Git client, no native deps |
| MCP testing | `child_process` + JSON-RPC | Spawn server, send initialize, check response |
| Logging | `electron-log` | File + console logging |
| Auto-update | `electron-updater` | GitHub Releases-based auto-update |
| Config paths | `electron.app.getPath()` + platform detection | Cross-platform path resolution |

### 4.4 Development Tooling

| Tool | Purpose |
|------|---------|
| pnpm | Package manager |
| Turborepo | Monorepo management (if CLI companion added later) |
| ESLint + Prettier | Linting and formatting |
| Vitest | Unit testing |
| Playwright | E2E testing (Electron support) |
| Conventional Commits | `feat:`, `fix:`, `refactor:`, etc. |
| GitHub Actions | CI/CD for builds and releases |
| electron-builder | Cross-platform packaging |

---

## 5. Architecture

### 5.1 High-Level Architecture

```
┌──────────────────────────────────────────────────┐
│                  Electron App                     │
│                                                   │
│  ┌─────────────────┐    ┌──────────────────────┐ │
│  │ Renderer Process │    │   Main Process       │ │
│  │                  │    │                      │ │
│  │  React 19 + UI   │◄──►  IPC Bridge (typed)  │ │
│  │  Zustand Store    │    │                      │ │
│  │  TanStack Router  │    │  ┌────────────────┐ │ │
│  │  Monaco Editor    │    │  │ Client Adapters │ │ │
│  │                  │    │  │ (detect/r/w)    │ │ │
│  └─────────────────┘    │  └────────────────┘ │ │
│                          │  ┌────────────────┐ │ │
│                          │  │ SQLite DB      │ │ │
│                          │  │ (registry, log)│ │ │
│                          │  └────────────────┘ │ │
│                          │  ┌────────────────┐ │ │
│                          │  │ Keytar         │ │ │
│                          │  │ (OS creds)     │ │ │
│                          │  └────────────────┘ │ │
│                          │  ┌────────────────┐ │ │
│                          │  │ Chokidar       │ │ │
│                          │  │ (file watcher) │ │ │
│                          │  └────────────────┘ │ │
│                          │  ┌────────────────┐ │ │
│                          │  │ isomorphic-git │ │ │
│                          │  │ (cloud sync)   │ │ │
│                          │  └────────────────┘ │ │
│                          └──────────────────────┘ │
└──────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │  Claude   │  │  Cursor  │  │  VS Code │  ...
   │  Desktop  │  │          │  │          │
   │  .json    │  │  .json   │  │  .json   │
   └──────────┘  └──────────┘  └──────────┘
```

### 5.2 Client Adapter Pattern

Each supported AI tool gets a dedicated adapter implementing a common interface:

```typescript
interface ClientAdapter {
  /** Unique identifier */
  readonly id: ClientId;

  /** Display name */
  readonly displayName: string;

  /** Icon asset path */
  readonly icon: string;

  /** Detect if client is installed, return config path(s) */
  detect(): Promise<ClientDetectionResult>;

  /** Read current MCP server config from client */
  read(configPath: string): Promise<McpServerMap>;

  /** Write MCP server config to client (merge with existing) */
  write(configPath: string, servers: McpServerMap): Promise<void>;

  /** Validate the written config */
  validate(configPath: string): Promise<ValidationResult>;
}

type ClientId =
  | "claude-desktop"
  | "claude-code"
  | "cursor"
  | "vscode"
  | "windsurf"
  | "zed"
  | "jetbrains"
  | "codex-cli";

interface ClientDetectionResult {
  installed: boolean;
  configPaths: string[];       // May have multiple (global + project)
  version?: string;            // If detectable
  serverCount: number;
}

type McpServerMap = Record<string, McpServerConfig>;

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  type?: "stdio" | "sse" | "http";
  url?: string;                // For SSE/HTTP transports
}
```

### 5.3 IPC Channel Design

Typed IPC channels between renderer and main process:

```typescript
// Shared types (both processes import these)
interface IpcChannels {
  // Clients
  "clients:detect-all": () => Promise<ClientStatus[]>;
  "clients:read-config": (clientId: ClientId) => Promise<McpServerMap>;
  "clients:sync": (clientId: ClientId, servers: McpServerMap) => Promise<SyncResult>;
  "clients:sync-all": () => Promise<SyncResult[]>;

  // Servers
  "servers:list": () => Promise<McpServer[]>;
  "servers:get": (id: string) => Promise<McpServer | null>;
  "servers:create": (server: CreateServerInput) => Promise<McpServer>;
  "servers:update": (id: string, updates: UpdateServerInput) => Promise<McpServer>;
  "servers:delete": (id: string) => Promise<void>;
  "servers:test": (id: string) => Promise<TestResult>;

  // Secrets
  "secrets:set": (serverName: string, key: string, value: string) => Promise<void>;
  "secrets:get": (serverName: string, key: string) => Promise<string | null>;
  "secrets:delete": (serverName: string, key: string) => Promise<void>;

  // Backups
  "backups:list": (clientId: ClientId) => Promise<BackupEntry[]>;
  "backups:restore": (backupPath: string, clientId: ClientId) => Promise<void>;

  // Activity Log
  "log:query": (filters: LogFilters) => Promise<ActivityLogEntry[]>;

  // Stacks
  "stacks:export": (serverIds: string[], name: string) => Promise<string>; // Returns JSON
  "stacks:import": (json: string) => Promise<ImportResult>;

  // Registry (Smithery)
  "registry:search": (query: string) => Promise<RegistryServer[]>;
  "registry:install": (registryId: string) => Promise<McpServer>;

  // Git Sync
  "git:configure": (remote: string, auth: GitAuth) => Promise<void>;
  "git:configure-github": () => Promise<void>;  // GitHub OAuth quick setup
  "git:push": () => Promise<void>;
  "git:pull": () => Promise<PullResult>;

  // Licensing (LemonSqueezy)
  "license:validate": (key: string) => Promise<LicenseStatus>;
  "license:activate": (key: string) => Promise<ActivationResult>;
  "license:deactivate": () => Promise<void>;
  "license:status": () => Promise<LicenseStatus>;
  "license:feature-gates": () => Promise<FeatureGates>;

  // Rules
  "rules:list": () => Promise<AiRule[]>;
  "rules:get": (id: string) => Promise<AiRule | null>;
  "rules:create": (rule: CreateRuleInput) => Promise<AiRule>;
  "rules:update": (id: string, updates: UpdateRuleInput) => Promise<AiRule>;
  "rules:delete": (id: string) => Promise<void>;
  "rules:import-from-project": (dirPath: string) => Promise<ImportResult>;
  "rules:sync": (clientId: ClientId) => Promise<SyncResult>;
  "rules:estimate-tokens": (content: string) => Promise<number>;

  // Profiles
  "profiles:list": () => Promise<Profile[]>;
  "profiles:get": (id: string) => Promise<Profile | null>;
  "profiles:create": (profile: CreateProfileInput) => Promise<Profile>;
  "profiles:update": (id: string, updates: UpdateProfileInput) => Promise<Profile>;
  "profiles:delete": (id: string) => Promise<void>;
  "profiles:activate": (id: string) => Promise<SyncResult[]>;  // Returns sync results for all clients
  "profiles:diff": (id: string) => Promise<ProfileDiff>;        // Preview what changes on activation

  // File Watcher Events (main → renderer)
  "watcher:config-changed": (clientId: ClientId, diff: ConfigDiff) => void;
}
```

### 5.4 Data Layer

**SQLite schema (better-sqlite3):**

```sql
-- Server registry
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'stdio',
  command TEXT NOT NULL,
  args TEXT NOT NULL DEFAULT '[]',           -- JSON array
  env TEXT NOT NULL DEFAULT '{}',            -- JSON object (non-secret)
  secret_env_keys TEXT NOT NULL DEFAULT '[]', -- JSON array of key names
  enabled INTEGER NOT NULL DEFAULT 1,
  client_overrides TEXT NOT NULL DEFAULT '{}', -- JSON object
  tags TEXT NOT NULL DEFAULT '[]',           -- JSON array
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Activity log
CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,                       -- 'server.created', 'sync.performed', etc.
  details TEXT NOT NULL DEFAULT '{}',         -- JSON with action-specific data
  client_id TEXT,                             -- NULL for non-client actions
  server_id TEXT                              -- NULL for non-server actions
);

-- Backup history
CREATE TABLE backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  backup_type TEXT NOT NULL DEFAULT 'sync', -- 'sync', 'pristine', 'manual'
  created_at TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash TEXT NOT NULL                   -- SHA-256 for conflict detection
);

-- AI Rules
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,                    -- Markdown rule content
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT NOT NULL DEFAULT '[]',          -- JSON array
  enabled INTEGER NOT NULL DEFAULT 1,
  priority TEXT NOT NULL DEFAULT 'normal',  -- 'critical', 'high', 'normal', 'low'
  scope TEXT NOT NULL DEFAULT 'global',     -- 'global' or 'project'
  project_path TEXT,                        -- Only for scope='project'
  file_globs TEXT NOT NULL DEFAULT '[]',    -- JSON array of glob patterns
  always_apply INTEGER NOT NULL DEFAULT 0,
  client_overrides TEXT NOT NULL DEFAULT '{}',
  token_estimate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Profiles
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#6366f1',
  is_active INTEGER NOT NULL DEFAULT 0,    -- Only one active at a time
  parent_profile_id TEXT,
  server_overrides TEXT NOT NULL DEFAULT '{}', -- JSON
  rule_overrides TEXT NOT NULL DEFAULT '{}',   -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_profile_id) REFERENCES profiles(id)
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp);
CREATE INDEX idx_activity_log_action ON activity_log(action);
CREATE INDEX idx_backups_client ON backups(client_id);
```

### 5.5 Safety-First Config Protection

**This is the #1 trust requirement.** If we ever corrupt a user's existing config, they'll never use the tool again.

#### Principle: Never destructive, always reversible

**Managed vs unmanaged tracking:**
- Every server/rule we create or import gets tagged with `managedBy: "aidrelay"` in our registry
- When syncing to a client config, we only touch entries we manage
- Entries that exist in the client config but NOT in our registry are preserved untouched
- This means if a user manually added a server to Cursor, we never remove it

**Pre-write safety sequence (every sync operation):**

```
1. READ    → Read current client config file
2. PARSE   → Parse JSON, extract existing content
3. BACKUP  → Write full copy to backup dir with timestamp
4. MERGE   → Overlay only our managed entries onto existing config
5. VALIDATE → Validate merged JSON is syntactically correct
6. WRITE   → Atomic write (write to .tmp, rename to target)
7. VERIFY  → Re-read and compare to expected output
8. LOG     → Record sync action in activity log
```

If any step fails, abort and restore from the backup created in step 3.

**Pristine backup:**
- On first-ever detection of a client, before we touch anything, create a "pristine" backup
- This is the user's original config before aidrelay existed
- Always available via "Restore to original" in the UI
- Never overwritten or aged out

**Backup retention:**
- Default: keep last 50 backups per client + pristine backup
- Configurable retention period (default 30 days)
- Backup directory: `%APPDATA%/aidrelay/backups/{client-id}/`
- Each backup: `{ISO-timestamp}.json` (full file copy)

**History / revert UI:**
- Per-client timeline view showing all sync operations
- Each entry shows: timestamp, what changed (servers added/removed/toggled), file size
- "Preview" button: show diff between backup and current config
- "Restore" button: replaces current client config with the selected backup
- "Restore to pristine" button: go back to before aidrelay ever touched this client

**Atomic writes:**
- Write to `{config-path}.aidrelay.tmp` first
- Only rename to actual config path after successful write + validation
- If the app crashes mid-write, the `.tmp` file is cleaned up on next launch

**Conflict detection:**
- When syncing, compare the current file hash with the last known hash
- If they differ (user or another tool modified the file since our last sync), warn:
  "Cursor config was modified externally since last sync. Review changes before overwriting?"
- Options: "Merge" (overlay our changes), "Import" (pull external changes into registry), "Skip"

#### 5.6 Secret Management

1. **Secrets never in app storage.** Windows Credential Manager only. The SQLite DB stores `secret_env_keys` (key names) but never values.
2. **Secrets injected at sync time.** When writing to a client config, secrets are read from the credential store and merged into the env object.
3. **Stacks strip secrets on export.** Export includes `secretEnvKeys` array but not values. Import prompts user to fill in missing secrets.
4. **Git sync excludes secrets.** Only the registry structure is pushed. Secret values stay local.
5. **No network calls except explicit.** Smithery registry and Git sync are opt-in. The app works fully offline.
6. **Backups may contain secrets** (because client config files contain them). Backups stay in a local, non-synced directory.

#### 5.7 Git Cloud Sync Architecture

**Dual-path approach:** Quick setup via GitHub OAuth + advanced manual for any provider.

**Path A: Quick Setup (GitHub OAuth)**
1. User clicks "Connect with GitHub" button
2. OAuth flow via LemonSqueezy or direct GitHub OAuth app
3. App auto-creates a private repo `aidrelay-sync` in the user's GitHub account
4. Clones to `%APPDATA%/aidrelay/git-sync/`
5. Done — zero friction, 3 clicks

**Path B: Advanced Setup (any Git provider)**
1. User creates a private repo manually (GitHub, GitLab, Gitea, Bitbucket, self-hosted)
2. Pastes HTTPS URL into aidrelay settings
3. Provides auth token (stored in Windows Credential Manager)
4. aidrelay clones the repo to `%APPDATA%/aidrelay/git-sync/`

**What syncs:**
- Server registry (definitions, toggles, tags — NOT secret values)
- Rules (content, metadata, categories, priorities)
- Profiles (definitions, override maps)
- App settings (non-sensitive preferences)

**What never syncs:**
- Secret values (only `secretEnvKeys` array travels, values stay local)
- Backup history (local only)
- Activity log (local only)
- License keys (local only)

**Sync operations:**
- **Push:** Commit current state, push to remote. Auto-triggered on server/rule/profile changes (debounced).
- **Pull:** Fetch from remote, merge into local registry. Last-write-wins for conflicts (with conflict log).
- **Manual sync:** Button in settings to force push/pull.

**Implementation:** `isomorphic-git` (pure JS, no native deps, works in Electron main process).

#### 5.8 Platform Strategy

**Windows-first.** macOS and Linux support will be added later.

- All config path detection targets Windows paths only
- Windows Credential Manager for secrets (via `keytar`)
- NSIS installer via `electron-builder`
- Cross-platform abstraction layer exists in the architecture (interfaces, not hardcoded paths) so adding macOS/Linux later is straightforward
- No path separator hardcoding — use `path.join()` everywhere
- Client adapters have a `platform` field but only `win32` is implemented initially

#### 5.9 Authentication Architecture

**No aidrelay backend. No user accounts. All auth is third-party.**

aidrelay is fully local-first. There is no aidrelay server, no user database, no account creation. All authentication is delegated to third-party services via their own APIs.

```
┌─────────────────────────────────────────────────────┐
│                  aidrelay (local app)                │
│                                                      │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │ LemonSqueezy Key  │───►│ LemonSqueezy API       │ │
│  │ (safeStorage)     │    │ activate / validate    │ │
│  └──────────────────┘    └────────────────────────┘ │
│                                                      │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │ GitHub OAuth Token│───►│ GitHub API             │ │
│  │ (keytar)          │    │ create repo, push/pull │ │
│  └──────────────────┘    └────────────────────────┘ │
│                                                      │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │ Git manual token  │───►│ Any Git provider       │ │
│  │ (keytar)          │    │ GitLab/Gitea/Bitbucket │ │
│  └──────────────────┘    └────────────────────────┘ │
│                                                      │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │ Smithery API Key  │───►│ Smithery Registry API  │ │
│  │ (keytar)          │    │ search, get details    │ │
│  └──────────────────┘    └────────────────────────┘ │
│                                                      │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │ PulseMCP          │───►│ PulseMCP API           │ │
│  │ (no auth / key)   │    │ public search          │ │
│  └──────────────────┘    └────────────────────────┘ │
│                                                      │
│  ┌──────────────────┐                                │
│  │ MCP Server Secrets│    (user's own API keys for   │
│  │ (keytar)          │     Brave, GitHub, etc.       │
│  └──────────────────┘    injected at sync time)      │
└─────────────────────────────────────────────────────┘
```

**Auth flow details:**

1. **License (LemonSqueezy):** User enters license key → app calls `/v1/licenses/activate` → caches result in `electron.safeStorage` → re-validates every 7 days → grace period on network failure
2. **GitHub OAuth:** User clicks "Connect with GitHub" → opens system browser → OAuth callback on `http://localhost:{random_port}` → token stored in keytar → used for Git operations only
3. **Manual Git:** User pastes HTTPS token in settings → stored in keytar → used for push/pull
4. **Smithery:** User pastes API key in settings → stored in keytar → used as Bearer token in registry API calls
5. **MCP secrets:** User enters API keys per-server in the server editor → stored in keytar under `aidrelay/{serverName}/{envKey}` → injected into client configs at sync time

**Why no own accounts:**
- No backend to build, host, or maintain
- No user data to protect (GDPR simplicity)
- No password management, no session handling, no email verification
- All value is local — the app works fully offline except for license validation and Git sync
- If we later need accounts (team features, cloud dashboard), we can add them then

#### 5.10 Monetization Architecture

**Feature flags baked in from day one.** Even if we ship fully free initially, the architecture supports tiering without refactoring.

```typescript
type PlanTier = "free" | "pro";

interface FeatureGates {
  maxServers: number;          // free: 10, pro: Infinity
  maxRules: number;            // free: 10, pro: Infinity
  maxProfiles: number;         // free: 2, pro: Infinity
  gitSync: boolean;            // free: false, pro: true
  serverTesting: boolean;      // free: false, pro: true
  registryInstall: boolean;    // free: browse, pro: install
  stackExport: boolean;        // free: false, pro: true
  tokenBudgetDetailed: boolean;// free: basic count, pro: per-client breakdown
  activityLogDays: number;     // free: 7, pro: Infinity
  ruleTemplates: boolean;      // free: false, pro: true
}

const FREE_GATES: Readonly<FeatureGates> = {
  maxServers: 10,
  maxRules: 10,
  maxProfiles: 2,
  gitSync: false,
  serverTesting: false,
  registryInstall: false,
  stackExport: false,
  tokenBudgetDetailed: false,
  activityLogDays: 7,
  ruleTemplates: false,
};

const PRO_GATES: Readonly<FeatureGates> = {
  maxServers: Infinity,
  maxRules: Infinity,
  maxProfiles: Infinity,
  gitSync: true,
  serverTesting: true,
  registryInstall: true,
  stackExport: true,
  tokenBudgetDetailed: true,
  activityLogDays: Infinity,
  ruleTemplates: true,
};
```

**Free tier is genuinely useful:**
- MCP server management (up to 10)
- Rules management (up to 10)
- 2 profiles (e.g. work + personal)
- Sync to all clients
- Secret management
- Auto-backup + revert
- Full config safety

**Pro tier (~$5-8/mo or ~$49/yr):**
- Unlimited servers, rules, profiles
- Git cloud sync
- Server connection testing
- Smithery registry install
- Stack export/import
- Detailed token budgets
- Full activity log
- Rule templates library
- Priority support

**Implementation approach:**
- Feature gate checks via a `useFeatureGate(feature)` hook (renderer) and `checkGate(feature)` function (main)
- **LemonSqueezy** for payments, license key generation, validation API, and EU VAT handling
- License validation flow:
  1. App launch → read cached license from `electron.safeStorage`
  2. If cache valid and < 7 days old → apply cached tier
  3. If cache expired or missing → call LemonSqueezy License API (`/v1/licenses/validate`)
  4. If valid → cache result (encrypted via safeStorage), apply tier
  5. If invalid/expired → fall back to free tier
  6. If network error → grace period (7 more days using cached tier)
- V8 bytecode compilation via `electron-vite` for license checking code (raises reverse-engineering barrier)
- ASAR integrity verification to detect app tampering
- Code signing via electron-builder (Windows Authenticode)
- **Closed source** — the app binary is distributed, source code is not public

**Open source components** (separate repos under `@aidrelay` npm scope):
- `@aidrelay/adapter-spec` — ClientAdapter interface + format spec (MIT). Community can contribute adapters for new AI tools without access to the main codebase.
- `@aidrelay/rules-format` — Rules format specification (MIT). Defines the `.md` + frontmatter standard for interoperable AI coding rules.
- `@aidrelay/stacks` — Example stacks and rule template library (MIT). Curated community collection of MCP server bundles and rule presets.

These open specs build community and ecosystem around aidrelay without undermining the business model. When a new AI tool launches, the community can submit an adapter via PR to the spec repo.

---

## 6. UI Layout

### 6.1 Navigation

Sidebar navigation with these pages:

```
[Logo] aidrelay
──────────────────
  Dashboard          ← Overview: active profile, client status, server/rule count
  Servers            ← MCP server registry CRUD + toggle matrix
  Rules              ← AI rules/preferences editor + toggle matrix
  Clients            ← Detected clients, sync controls, status
  Profiles           ← Named profiles (work/personal/project), switching
  Registry           ← Smithery marketplace browser + rule templates
  Stacks             ← Import/export presets (servers + rules bundles)
  Activity Log       ← Timestamped action history
──────────────────
  Settings           ← Git sync, licensing, preferences, about
```

### 6.2 Key Views

**Dashboard:**
- Active profile indicator (prominent, colored badge)
- Cards for each detected client (icon, name, server count, rule count, sync status, last synced)
- Quick-sync button (sync all)
- Quick profile switcher (dropdown)
- Recent activity feed (last 10 entries)
- Token budget summary per client

**Servers:**
- Table with: name, type, command, tags, enabled toggle, test status, actions (edit, delete)
- "Add Server" button → dropdown with three paths:
  - "Search Registries" → opens unified registry search (Smithery + PulseMCP)
  - "Manual Entry" → opens editor drawer with form mode / JSON mode tabs
  - "Import from Clipboard" → auto-detects `mcpServers` JSON format, pre-fills form
- Editor has form mode / JSON mode tabs
- Env var section with "mark as secret" toggle per var

**Rules:**
- Scope toggle at top: **[Global Rules]** | **[Project Rules ▾]** with project directory dropdown
- Table with: name, category, file globs, token estimate, enabled toggle, priority, scope badge, actions
- Add Rule button → opens markdown editor
- Editor: split view (markdown source + live preview) via `@uiw/react-md-editor`
- Scope selector in editor: Global or Project (with directory picker)
- Token counter in editor footer (updates as you type)
- Category sidebar/filter
- Import button: point at project dir or paste from clipboard
- "Sync to project" button: file picker to choose target project directory
- Per-client toggle matrix (same as servers)
- Total token budget bar per client (visual progress bar with warning threshold)
- Project auto-detection: show recently opened VS Code / Cursor workspace paths

**Clients:**
- List of detected clients with:
  - Install status (installed, not found, config path)
  - Server count + rule count
  - Sync status badge (synced, out of sync, never synced)
  - Sync button (per client)
  - View config button (opens in Monaco, read-only)

**Profiles:**
- List of profiles with name, icon, color, description
- Active profile highlighted
- "Activate" button per profile
- Create new (blank or from template/existing profile)
- Edit profile: shows which servers + rules are enabled/disabled as overrides
- Visual diff: "Switching to this profile will enable 3 servers and disable 2 rules"

**Toggle Matrix (embedded in Servers or standalone):**
- Rows: servers. Columns: clients.
- Checkbox at each intersection.
- Header row with "sync all" per client.

---

## 7. Project Structure

```
aidrelay/
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint, test, typecheck
│       └── release.yml             # Build + publish to GitHub Releases
├── src/
│   ├── main/                       # Electron main process
│   │   ├── index.ts                # Entry point, window creation
│   │   ├── ipc/                    # IPC handler registration
│   │   │   ├── index.ts
│   │   │   ├── clients.ipc.ts
│   │   │   ├── servers.ipc.ts
│   │   │   ├── rules.ipc.ts
│   │   │   ├── profiles.ipc.ts
│   │   │   ├── secrets.ipc.ts
│   │   │   ├── backups.ipc.ts
│   │   │   ├── log.ipc.ts
│   │   │   ├── stacks.ipc.ts
│   │   │   ├── registry.ipc.ts
│   │   │   ├── licensing.ipc.ts
│   │   │   └── git-sync.ipc.ts
│   │   ├── clients/                # Client adapter implementations
│   │   │   ├── types.ts            # ClientAdapter interface
│   │   │   ├── registry.ts         # Adapter registry
│   │   │   ├── claude-desktop.adapter.ts
│   │   │   ├── claude-code.adapter.ts
│   │   │   ├── cursor.adapter.ts
│   │   │   ├── vscode.adapter.ts
│   │   │   ├── windsurf.adapter.ts
│   │   │   ├── zed.adapter.ts
│   │   │   ├── jetbrains.adapter.ts
│   │   │   └── codex-cli.adapter.ts
│   │   ├── db/                     # SQLite database layer
│   │   │   ├── connection.ts
│   │   │   ├── migrations/
│   │   │   │   └── 001_initial.sql
│   │   │   ├── servers.repo.ts
│   │   │   ├── rules.repo.ts
│   │   │   ├── profiles.repo.ts
│   │   │   ├── activity-log.repo.ts
│   │   │   ├── backups.repo.ts
│   │   │   └── settings.repo.ts
│   │   ├── secrets/                # OS credential store
│   │   │   └── keytar.service.ts
│   │   ├── sync/                   # Sync orchestration
│   │   │   ├── sync.service.ts
│   │   │   ├── rules-sync.service.ts  # Rules format conversion + deployment
│   │   │   └── backup.service.ts
│   │   ├── rules/                  # Rules engine
│   │   │   ├── rules.service.ts
│   │   │   ├── token-counter.ts    # Token estimation for rules
│   │   │   ├── format-converter.ts # .md ↔ .mdc ↔ AGENTS.md conversion
│   │   │   └── rule-importer.ts    # Import from project directories
│   │   ├── profiles/               # Profile management
│   │   │   └── profiles.service.ts
│   │   ├── watcher/                # File system watching
│   │   │   └── config-watcher.service.ts
│   │   ├── testing/                # MCP server health checks
│   │   │   └── server-tester.service.ts
│   │   ├── registry/               # Smithery API client
│   │   │   └── smithery.client.ts
│   │   ├── licensing/              # LemonSqueezy license validation
│   │   │   ├── licensing.service.ts
│   │   │   └── feature-gates.ts    # FeatureGates definitions + check functions
│   │   └── git-sync/               # Git-based cloud sync
│   │       └── git-sync.service.ts
│   ├── renderer/                   # React frontend
│   │   ├── index.html
│   │   ├── main.tsx                # React entry point
│   │   ├── App.tsx                 # Root component + router
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Shell.tsx
│   │   │   ├── servers/
│   │   │   │   ├── ServerList.tsx
│   │   │   │   ├── ServerEditor.tsx
│   │   │   │   ├── ServerForm.tsx
│   │   │   │   ├── ServerJsonEditor.tsx
│   │   │   │   ├── EnvVarEditor.tsx
│   │   │   │   └── ToggleMatrix.tsx
│   │   │   ├── rules/
│   │   │   │   ├── RuleList.tsx
│   │   │   │   ├── RuleEditor.tsx         # Markdown editor + preview
│   │   │   │   ├── RuleImporter.tsx       # Bulk import from project dir
│   │   │   │   ├── TokenBudgetBar.tsx     # Visual token budget per client
│   │   │   │   └── RuleToggleMatrix.tsx
│   │   │   ├── profiles/
│   │   │   │   ├── ProfileList.tsx
│   │   │   │   ├── ProfileEditor.tsx
│   │   │   │   ├── ProfileSwitcher.tsx    # Quick-switch component
│   │   │   │   └── ProfileDiffView.tsx    # Show what changes on switch
│   │   │   ├── clients/
│   │   │   │   ├── ClientCard.tsx
│   │   │   │   ├── ClientList.tsx
│   │   │   │   └── SyncStatusBadge.tsx
│   │   │   ├── registry/
│   │   │   │   ├── RegistryBrowser.tsx
│   │   │   │   └── RegistryServerCard.tsx
│   │   │   ├── stacks/
│   │   │   │   ├── StackExporter.tsx
│   │   │   │   └── StackImporter.tsx
│   │   │   ├── log/
│   │   │   │   └── ActivityLogTable.tsx
│   │   │   └── common/
│   │   │       ├── StatusBadge.tsx
│   │   │       └── ConfirmDialog.tsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ServersPage.tsx
│   │   │   ├── RulesPage.tsx
│   │   │   ├── ClientsPage.tsx
│   │   │   ├── ProfilesPage.tsx
│   │   │   ├── RegistryPage.tsx
│   │   │   ├── StacksPage.tsx
│   │   │   ├── ActivityLogPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── stores/
│   │   │   ├── servers.store.ts
│   │   │   ├── rules.store.ts
│   │   │   ├── profiles.store.ts
│   │   │   ├── clients.store.ts
│   │   │   └── ui.store.ts
│   │   ├── lib/
│   │   │   ├── ipc.ts              # Typed IPC client wrapper
│   │   │   ├── schemas.ts          # Zod schemas (shared validation)
│   │   │   └── constants.ts
│   │   └── i18n/
│   │       ├── index.ts
│   │       ├── en.json
│   │       └── de.json
│   ├── shared/                     # Types shared between main + renderer
│   │   ├── types.ts
│   │   ├── channels.ts             # IPC channel type definitions
│   │   └── schemas.ts              # Zod schemas used by both processes
│   └── preload/
│       └── index.ts                # contextBridge exposure
├── resources/                      # App icons, client logos
│   ├── icon.png
│   └── client-icons/
├── __tests__/                      # Integration tests
├── electron-builder.yml            # Build configuration
├── vite.config.ts                  # Vite config for renderer
├── tsconfig.json
├── tsconfig.main.json
├── tsconfig.renderer.json
├── package.json
├── pnpm-lock.yaml
├── LICENSE                         # Proprietary
├── CLAUDE.md                       # AI coding instructions
├── .cursorrules                    # Cursor AI instructions
└── README.md
```

---

## 8. Implementation Plan

### Phase 1 — Scaffolding + Core (Weeks 1-2)

1. Init Electron + Vite + React + TypeScript project with `electron-vite`
2. Set up pnpm, ESLint, Prettier, Vitest, conventional commits
3. Implement shared types (McpServer, AiRule, Profile, ClientAdapter, IPC channels)
4. Implement SQLite database layer with initial migration
5. Implement feature gates infrastructure (`FeatureGates`, `checkGate()`, `useFeatureGate()`)
6. Build first 3 client adapters (Windows paths only): Claude Desktop, Cursor, VS Code
7. Implement client auto-detection
8. Implement config import (read from all detected clients)
9. Implement safety-first sync (8-step pre-write sequence, pristine backup)
10. Basic UI shell: sidebar nav, dashboard with client cards

### Phase 2 — Server Management (Weeks 3-4)

11. Server CRUD in SQLite
12. Server list page with TanStack Table
13. Server editor (form mode) with env var management
14. Server editor (JSON mode) with Monaco
15. Per-server enable/disable toggle
16. Per-client toggle matrix
17. Sync button (per client + sync all) with backup + conflict detection
18. Add remaining client adapters: Windsurf, Claude Code, Zed, JetBrains, Codex CLI
19. Activity log (write-side: log all actions)
20. Activity log page (read-side: table with filters)

### Phase 3 — Rules + Profiles (Weeks 5-6)

21. Rules CRUD in SQLite
22. Rules list page with categories and token estimates
23. Rule editor (Markdown + live preview, split view)
24. Token counter (word-based heuristic, updates on keystroke)
25. Token budget bar per client (visual progress with warning threshold)
26. Rules format converter (`.md` → `.mdc`, `AGENTS.md`, etc.)
27. Rules sync to client-specific paths
28. Rule import from existing projects (bulk scan)
29. Profile CRUD in SQLite
30. Profile list page with switching, inheritance, and diff view

### Phase 4 — Security + Secrets (Weeks 7-8)

31. Integrate `keytar` for Windows Credential Manager
32. Secret management UI (mark env vars as secret, store/retrieve)
33. Secret injection at sync time
34. LemonSqueezy license integration (validate, activate, cache via safeStorage)
35. Feature gate enforcement across all Pro features
36. V8 bytecode compilation for license checking code
37. File watcher for external config changes (chokidar)
38. i18n setup with English + German

### Phase 5 — Cloud + Registry (Weeks 9-10)

39. Git sync: GitHub OAuth quick setup flow
40. Git sync: Advanced manual setup (any Git provider)
41. Push/pull with conflict detection and merge
42. Smithery registry API client
43. Registry browser page
44. One-click install from registry (Pro feature)
45. Import/export stacks (servers + rules bundles)
46. MCP server connection testing (spawn, initialize, verify)

### Phase 6 — Polish + Release (Weeks 11-12)

47. System tray with profile quick-switch
48. Settings page (Git remote, licensing, preferences)
49. History/revert UI (per-client timeline with restore)
50. electron-builder packaging (Windows NSIS installer)
51. Code signing (Windows Authenticode)
52. ASAR integrity verification
53. GitHub Actions CI/CD pipeline
54. Auto-update via electron-updater + GitHub Releases
55. Landing page, screenshots, documentation
56. LemonSqueezy store setup (product, variants, checkout)
57. First public release (v0.1.0)

---

## 9. Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | **Name** | **aidrelay** — AI Developer Relay |
| 2 | **Electron boilerplate** | Use `electron-vite` — handles multi-process Vite config, V8 bytecode, ASAR integrity |
| 3 | **Secret storage** | `keytar` for Windows Credential Manager. Native dep is acceptable for security. |
| 4 | **Data persistence** | `better-sqlite3` — needed for activity log, rules, profiles, complex queries |
| 5 | **License model** | Proprietary / closed source with generous free tier |
| 6 | **Payment provider** | LemonSqueezy — built-in license key API, VAT handling, no self-hosted server |
| 7 | **Git sync** | Dual-path: GitHub OAuth quick setup + advanced manual (any provider) |
| 8 | **Open source components** | `@aidrelay/adapter-spec`, `@aidrelay/rules-format`, `@aidrelay/stacks` (all MIT) |
| 9 | **Platform** | Windows-first. Cross-platform abstractions in place, macOS/Linux later. |
| 10 | **Token counting** | Word-based heuristic (word count * 1.3). Accurate enough for budget estimation. |
| 11 | **Markdown editor** | `@uiw/react-md-editor` for split view (source + preview). Monaco for JSON only. |
| 12 | **User auth** | No own accounts. LemonSqueezy key-based + GitHub OAuth + Smithery API key. All third-party. |
| 13 | **MCP registries** | Unified search: Smithery (primary) + PulseMCP (secondary) + clipboard import |
| 14 | **Rules scope** | Global + project-based. Auto-detect projects + "Sync to project" directory picker. |
| 15 | **Add server flow** | Three paths: registry search, manual entry, clipboard import |

## 10. Remaining Open Items

| # | Question | Impact | When to decide |
|---|----------|--------|---------------|
| 1 | Claude Desktop MSIX path globbing | Medium | Phase 1 — building Windows adapter |
| 2 | VS Code MCP discovery conflict warning | Low | Phase 2 — building VS Code adapter |
| 3 | LemonSqueezy pricing ($49/yr? $5/mo? Both?) | Medium | Before Phase 6 launch |
| 4 | Domain registration (`aidrelay.dev` or `aidrelay.io`) | Low | Anytime before launch |
| 5 | Landing page tech (Next.js static? Simple HTML?) | Low | Phase 6 |
| 6 | PulseMCP API auth requirements (public or key needed?) | Low | Phase 5 — building registry |
| 7 | GitHub OAuth App registration (callback URL: `localhost:{port}`) | Medium | Phase 5 — building Git sync |

None of these are blocking for starting Phase 1.
