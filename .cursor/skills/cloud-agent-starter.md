<!--
/**
 * @file .cursor/skills/cloud-agent-starter.md
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Minimal starter skill for Cursor Cloud agents working on
 * aidrelay. Covers practical setup, execution, and testing workflows.
 */
-->

# Cloud Agent Starter Skill (Minimal)

Use this skill first when you start a task in `aidrelay`.

## 1) Fast start: environment + app boot

### Preconditions
- Use Node `>=20` and pnpm `>=9` (see `package.json` engines).
- Work from repo root.

### Install + verify toolchain
1. `pnpm install`
2. `pnpm -v`
3. `node -v`

### Run the app
1. `pnpm dev`
2. Confirm Electron window opens and renderer shows:
   - `aidrelay`
   - `AI Developer Relay`
   - `Phase 1 scaffold complete — renderer loaded successfully.`

### Required quality checks before finishing
1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`

---

## 2) Login/auth practicals for Cloud agents

Current scaffold has **no in-app login UI** yet. Treat auth like this:

- **GitHub CLI checks (if task needs GitHub metadata):**
  - `gh auth status`
  - If authenticated, continue with read-only `gh` commands.
- **License/Git OAuth/registry keys are planned phases:**
  - Do not block on missing UI flows.
  - Mock responses in tests or bridge stubs (see section 4).

---

## 3) Codebase-area workflows (what to run, what to test)

## 3.1 Shared contracts (`src/shared/*`)
- Scope: domain types, IPC channel signatures.
- Typical edits: `src/shared/types.ts`, `src/shared/channels.ts`.
- High-signal checks:
  1. `pnpm typecheck`
  2. `pnpm test`
  3. `pnpm lint`
- Why: breaks here cascade into both main and renderer builds.

## 3.2 Main process (`src/main/*`)
- Scope: Electron lifecycle, window security, logging, main-only services.
- Current entry: `src/main/index.ts`.
- Run workflow:
  1. `pnpm dev`
  2. Verify main process starts without Electron errors.
  3. If changed runtime behavior, exercise the window manually.
- Checks:
  1. `pnpm typecheck`
  2. `pnpm lint`
  3. `pnpm build`

## 3.3 Preload bridge (`src/preload/*`)
- Scope: safe `contextBridge` API exposed to renderer.
- Current bridge: `window.api` (stub).
- Run workflow:
  1. Update preload API shape.
  2. Update matching shared channel/types.
  3. Run renderer tests that use `window.api`.
- Checks:
  1. `pnpm test`
  2. `pnpm typecheck`
  3. `pnpm lint`

## 3.4 Renderer (`src/renderer/*`)
- Scope: React UI, styling, renderer-side utilities, renderer tests.
- Run workflow:
  1. `pnpm dev`
  2. Validate UI manually in Electron window.
  3. Capture screenshot evidence for visual changes.
  4. Check renderer console for errors (via DevTools/CDP when needed).
- Checks:
  1. `pnpm test`
  2. `pnpm lint`
  3. `pnpm typecheck`

---

## 4) Feature flags and login mocking (current practical approach)

Feature gates are currently represented in shared contracts but not fully wired in runtime services yet. Use lightweight mocks:

- **Renderer tests:** override `window.api` methods in test setup or per-test.
- **Main/IPC-adjacent tests:** mock gate checks and license responses at module boundaries.
- **Manual QA:** when a gated UI flow does not yet exist, test fallback/default rendering path and document assumptions in your final notes.

Keep mocks small and local to each test. Do not introduce global test infrastructure unless multiple files already require it.

---

## 5) Common Cloud workflow tips

- Always read `TASK.md` first to stay in sequence with plan steps.
- Prefer targeted commands before full-suite commands during iteration:
  - fast loop: `pnpm typecheck` or targeted `vitest` run
  - finish loop: lint + test + build
- For renderer changes, leave `pnpm dev` running and rely on hot reload.
- Respect Electron security defaults: no `nodeIntegration` in renderer, keep `contextIsolation` enabled.

---

## 6) How to update this skill when new runbook knowledge appears

When you discover a new reliable testing trick or failure-recovery step:

1. Add it to the relevant codebase-area section above (shared/main/preload/renderer).
2. Prefer concrete commands and expected outcomes over generic advice.
3. Mark whether the step is:
   - local fast loop, or
   - required final verification.
4. Keep the skill minimal: remove stale steps when tooling or architecture changes.
5. In the PR/task summary, include one line: `Skill updated: <what changed and why>`.

This keeps onboarding fast for the next Cloud agent and prevents repeated setup mistakes.
