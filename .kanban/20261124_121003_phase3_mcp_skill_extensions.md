---
title: "Phase 3: MCP Server, Skill & Opt-In Extensions (TDD)"
status: done
priority: medium
created_at: 2026-11-24T12:10:03+07:00
completed_at: 2026-11-24T12:19:00+07:00
tags:
  - phase-3
  - mcp
  - skill
  - extensions
---

# Phase 3: MCP Server, Skill & Opt-In Extensions (TDD)

**Target:** Expose `brandlinter` as a `stdio` MCP server for Antigravity, OMP, Claude, and Cursor, add opt-in brand extensions, and ship `skills/brandlinter/SKILL.md`.

## Technical Design

- **MCP Server (`src/mcp/server.ts`):** Strictly reserve `stdout` for JSON-RPC frames; route diagnostics to `stderr`. Expose `lint_availability` (max 30), `lint_seo` (max 10), `lint_names` (combined 2-stage funnel, `topK` default 5), and `doctor`.
- **Opt-In Extensions (`providers/optional/`):** `porkbun.ts` (`PORKBUN_API_KEY`/`PORKBUN_SECRET_KEY`), `appstores.ts` (iTunes Search API with configurable `BRANDLINTER_COUNTRY` default `us` + Play Store best-effort), `social.ts` (X, YouTube, Reddit, Bluesky, LinkedIn), and `trademark.ts` (heuristic/non-legal-advice links).

- [x] **Red -> Green (`src/mcp/server.ts`):** Zod schemas, batch limits, `stdout` hygiene, and 4 MCP tools (`lint_availability`, `lint_seo`, `lint_names`, `doctor`) tested & passing.
- [x] **Red -> Green (Opt-in providers):** `porkbun.ts`, `appstores.ts`, `social.ts`, `trademark.ts` tested & passing (4 tests).
- [x] **Agent Skill (`skills/brandlinter/SKILL.md`):** Written for Antigravity, OMP, and Claude Code.
- [x] **Live smoke test:** MCP `stdio` handshake (`initialize` + `tools/list`) verified on `dist/cli.js mcp`.
- [ ] **Agent Skill (`skills/brandlinter/SKILL.md`):** Write naming strategy + 2-stage funnel instructions for Antigravity, OMP, and Claude Code.
- [ ] **Live smoke test:** Verify end-to-end inside Antigravity / OMP with self-hosted OpenSERP (`OPENSERP_URL`) and zero-key fallback mode.
