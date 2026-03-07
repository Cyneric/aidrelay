# aidrelay — Implementation Checklist

Track progress against [PLAN.md](./PLAN.md) section 8.

**Definition of done:** a step is complete only when the code is written, all
affected unit tests pass, and both `pnpm build` and `pnpm lint` succeed.

---

## Phase 1 — Scaffolding + Core

- [x] 1. Init Electron + Vite + React + TypeScript project with `electron-vite`
- [x] 2. Set up pnpm, ESLint, Prettier, Vitest, conventional commits
- [x] 3. Implement shared types (`McpServer`, `AiRule`, `Profile`, `ClientAdapter`, IPC channels)
- [ ] 4. Implement SQLite database layer with initial migration
- [ ] 5. Implement feature gates infrastructure (`FeatureGates`, `checkGate()`, `useFeatureGate()`)
- [ ] 6. Build first 3 client adapters (Windows paths only): Claude Desktop, Cursor, VS Code
- [ ] 7. Implement client auto-detection
- [ ] 8. Implement config import (read from all detected clients)
- [ ] 9. Implement safety-first sync (8-step pre-write sequence, pristine backup)
- [ ] 10. Basic UI shell: sidebar nav, dashboard with client cards

## Phase 2 — Server Management

- [ ] 11. Server CRUD in SQLite
- [ ] 12. Server list page with TanStack Table
- [ ] 13. Server editor (form mode) with env var management
- [ ] 14. Server editor (JSON mode) with Monaco
- [ ] 15. Per-server enable/disable toggle
- [ ] 16. Per-client toggle matrix
- [ ] 17. Sync button (per client + sync all) with backup + conflict detection
- [ ] 18. Add remaining client adapters: Windsurf, Claude Code, Zed, JetBrains, Codex CLI
- [ ] 19. Activity log (write-side: log all actions)
- [ ] 20. Activity log page (read-side: table with filters)

## Phase 3 — Rules + Profiles

- [ ] 21. Rules CRUD in SQLite
- [ ] 22. Rules list page with categories and token estimates
- [ ] 23. Rule editor (Markdown + live preview, split view)
- [ ] 24. Token counter (word-based heuristic, updates on keystroke)
- [ ] 25. Token budget bar per client (visual progress with warning threshold)
- [ ] 26. Rules format converter (`.md` → `.mdc`, `AGENTS.md`, etc.)
- [ ] 27. Rules sync to client-specific paths
- [ ] 28. Rule import from existing projects (bulk scan)
- [ ] 29. Profile CRUD in SQLite
- [ ] 30. Profile list page with switching, inheritance, and diff view

## Phase 4 — Security + Secrets

- [ ] 31. Integrate `keytar` for Windows Credential Manager
- [ ] 32. Secret management UI (mark env vars as secret, store/retrieve)
- [ ] 33. Secret injection at sync time
- [ ] 34. LemonSqueezy license integration (validate, activate, cache via safeStorage)
- [ ] 35. Feature gate enforcement across all Pro features
- [ ] 36. V8 bytecode compilation for license checking code
- [ ] 37. File watcher for external config changes (chokidar)
- [ ] 38. i18n setup with English + German

## Phase 5 — Cloud + Registry

- [ ] 39. Git sync: GitHub OAuth quick setup flow
- [ ] 40. Git sync: Advanced manual setup (any Git provider)
- [ ] 41. Push/pull with conflict detection and merge
- [ ] 42. Smithery registry API client
- [ ] 43. Registry browser page
- [ ] 44. One-click install from registry (Pro feature)
- [ ] 45. Import/export stacks (servers + rules bundles)
- [ ] 46. MCP server connection testing (spawn, initialize, verify)

## Phase 6 — Polish + Release

- [ ] 47. System tray with profile quick-switch
- [ ] 48. Settings page (Git remote, licensing, preferences)
- [ ] 49. History/revert UI (per-client timeline with restore)
- [ ] 50. electron-builder packaging (Windows NSIS installer)
- [ ] 51. Code signing (Windows Authenticode)
- [ ] 52. ASAR integrity verification
- [ ] 53. GitHub Actions CI/CD pipeline
- [ ] 54. Auto-update via electron-updater + GitHub Releases
- [ ] 55. Landing page, screenshots, documentation
- [ ] 56. LemonSqueezy store setup (product, variants, checkout)
- [ ] 57. First public release (v0.1.0)
