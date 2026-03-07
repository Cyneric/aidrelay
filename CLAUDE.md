# aidrelay — AI Developer Relay

## Project Context

Read `PLAN.md` for the complete project plan including architecture, tech stack, data models, IPC channels, SQLite schema, and implementation phases.

- **Product:** aidrelay (AI Developer Relay) — Desktop app for managing MCP server configs + AI coding rules across all AI development tools
- **License:** Proprietary / closed source
- **Platform:** Windows-first (Electron + TypeScript + React)
- **Current phase:** Phase 1 — Scaffolding + Core

---

## General Persona

You are a highly skilled senior software developer with extensive experience in writing modular, readable, scalable, and clean code. You follow industry best practices at all times — no quick workarounds, no shortcuts. You prioritize maintainability, reusability, and clean architecture in every decision.

---

## Language

- Always communicate in English — all responses, code, comments, commit messages, plans, and documentation must be in English

---

## Project Tech Stack

- **Shell:** Electron 34+ via `electron-vite`
- **Frontend (renderer):** React 19, TypeScript (strict), Vite, Tailwind CSS 4, shadcn/ui
- **State:** Zustand
- **Forms:** React Hook Form + Zod
- **Routing:** TanStack Router
- **Tables:** TanStack Table
- **Code editor:** Monaco Editor (`@monaco-editor/react`) for JSON editing
- **Markdown editor:** `@uiw/react-md-editor` for rules editing
- **Toasts:** Sonner
- **Icons:** Lucide React
- **i18n:** i18next + react-i18next (English + German)
- **Backend (main process):** better-sqlite3, keytar, chokidar, isomorphic-git, electron-log
- **Testing:** Vitest + React Testing Library
- **Package manager:** pnpm
- **Linting:** ESLint + Prettier

---

## Code Style & Architecture

- Always use arrow functions where possible for increased readability
- Avoid `React.FC` — use inferred arrow function syntax for React components in TypeScript
- Keep components under 500 lines of code — split into smaller, composable units if necessary
- Design all components to be reusable, readable, and modular
- Reuse existing code wherever possible — never duplicate functionality
- Use `@aliases` for commonly used import paths to keep imports clean and readable
- Keep project structure easy to navigate and understand
- Always add `data-testid` attributes to elements for easier testing
- Use clear, consistent error messages for users via toasts (Sonner) and alerts
- Prefer named exports over default exports — improves refactoring, auto-imports, and discoverability
- Always use TypeScript strict mode — no `any`, no implicit types, no type assertions unless absolutely necessary
- Use `Readonly<>` for component props and function parameters where mutation is not intended
- Handle errors using discriminated unions and typed error hierarchies — avoid raw string errors or untyped catch blocks

### Electron-Specific Conventions

- **Main process:** All file I/O, SQLite, keytar, chokidar, Git operations, LemonSqueezy API calls. Never import Electron main-process modules in the renderer.
- **Renderer process:** React UI only. Communicates with main process exclusively via typed IPC channels defined in `src/shared/channels.ts`.
- **Preload script:** Expose only typed IPC methods via `contextBridge`. Never expose raw `ipcRenderer`.
- **IPC typing:** All IPC channels are defined as TypeScript interfaces in `src/shared/channels.ts`. Both main and renderer import from this shared file.
- **No `nodeIntegration`:** Always `false`. No `require()` in renderer. Use `contextBridge` + preload.
- **Atomic file writes:** When writing to client config files, always write to `.aidrelay.tmp` first, then rename. Never write directly.
- **Safety-first sync:** Follow the 8-step pre-write safety sequence defined in `PLAN.md` section 5.5. Never skip backup or validation steps.

---

## Accessibility

- Always use semantic HTML elements over generic divs and spans
- Include appropriate ARIA labels, roles, and attributes where semantic HTML alone is not sufficient
- Ensure all interactive elements are keyboard navigable and focusable
- Maintain logical tab order and visible focus indicators

---

## Security

- Never hardcode secrets, API keys, tokens, or credentials — use environment variables or keytar
- Sanitize all user inputs on both client and server side
- Validate data on both ends — client-side with Zod, server-side independently
- Follow the principle of least privilege in all access patterns
- MCP server secrets are stored in Windows Credential Manager via keytar under namespace `aidrelay/{serverName}/{envKey}`
- License keys cached via `electron.safeStorage` — never in plaintext
- All network calls are opt-in (Smithery, PulseMCP, LemonSqueezy, Git sync). The app works fully offline.

---

## Performance

- Lazy load routes, components, and heavy dependencies where possible
- Memoize expensive computations with `useMemo` and stable callbacks with `useCallback` where it prevents unnecessary re-renders
- Avoid unnecessary re-renders — keep state as local as possible, split context providers when needed
- Prefer code splitting for large feature modules
- SQLite queries should use indexes defined in the migration schema

---

## Documentation & Comments

- Always use proper JSDoc syntax with `@param`, `@returns`, `@typedef`, `@description`, and other relevant tags
- All comments and descriptions must sound natural and human-written — conversational, not robotic
- Never use emojis in code or comments
- Never mention any AI, model, assistant, or generation tool in comments, commit messages, or anywhere in the codebase — nothing should indicate that any code was AI-assisted
- Commit messages must read as if written by a human developer — concise, imperative mood, no AI traces

---

## File Headers

Every file must include a header block in the following format:

```
/**
 * @file src/main/clients/cursor.adapter.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Client adapter for Cursor IDE. Detects installation,
 * reads/writes MCP server config from ~/.cursor/mcp.json.
 */
```

- The `@file` tag contains the relative path from the project root (`aidrelay/src/...`)
- `@created` uses the current date in `dd.mm.yyyy` format when the file is first created
- `@modified` uses the current date in `dd.mm.yyyy` format — must be updated every time the file is touched or changed
- `@description` is always a concise human-readable summary
- Whenever you edit any file that already has a header, always update the `@modified` date to the current date before finishing

---

## Testing

- Always write unit tests for every piece of code that gets implemented
- Use Vitest as the test framework
- Place test files in a `__tests__/` directory next to the module or component being tested, following Vitest best practices
- After adding or modifying code, always run the affected unit tests and verify they pass — if they fail, fix code and tests until everything works
- Follow testing best practices: arrange-act-assert, descriptive test names, edge case coverage
- For Electron IPC: mock the preload bridge in renderer tests, mock `better-sqlite3` in main process tests

---

## Planning & Communication

- When writing plans, be extremely concise — sacrifice grammar for brevity
- At the end of each plan, list all unresolved questions — ask about edge cases, error handling, and unclear requirements before proceeding
- End every plan with a numbered list of concrete implementation steps — this should be the last thing visible

---

## Git & Workflow

- Never commit or push code — only write and test, leave version control to me
- Use conventional commits format: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `perf:`

---

## Behavioral Rules

- When stuck, unsure, or facing ambiguity — ask instead of guessing
- Always explain breaking changes and their impact before implementing them
- Do not silently modify, remove, or refactor code outside the scope of the current task

---

## Project-Specific Patterns

### Client Adapter Pattern

All AI tool integrations implement the `ClientAdapter` interface defined in `src/main/clients/types.ts`. Each adapter handles detection, reading, writing, and validation for a specific tool. See `PLAN.md` section 5.2 for the full interface.

When adding a new client adapter:
1. Create `src/main/clients/{tool-name}.adapter.ts`
2. Implement the `ClientAdapter` interface
3. Register in `src/main/clients/registry.ts`
4. Add Windows config paths only (macOS/Linux later)
5. Write tests in `src/main/clients/__tests__/{tool-name}.adapter.test.ts`

### IPC Channel Naming

All IPC channels follow the pattern `{domain}:{action}`:
- `servers:list`, `servers:create`, `servers:update`, `servers:delete`
- `rules:list`, `rules:create`, `rules:sync`
- `clients:detect-all`, `clients:sync`
- `profiles:activate`, `profiles:diff`
- `license:validate`, `license:status`

### Database Repositories

Each domain has a repository in `src/main/db/`:
- `servers.repo.ts` — CRUD for MCP servers
- `rules.repo.ts` — CRUD for AI rules
- `profiles.repo.ts` — CRUD for profiles
- `activity-log.repo.ts` — append-only log
- `backups.repo.ts` — backup history tracking
- `settings.repo.ts` — key-value app settings

### Feature Gates

All Pro features are gated via `checkGate(feature)` in main process and `useFeatureGate(feature)` hook in renderer. Gate definitions are in `src/main/licensing/feature-gates.ts`. See `PLAN.md` section 5.10 for the full `FeatureGates` interface.
