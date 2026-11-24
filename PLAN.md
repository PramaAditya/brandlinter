# brandlinter — Architecture & Spec

> **A pluggable, agent-native CLI and MCP server for linting product, startup, and open-source names against SEO collisions, domain registries, GitHub namespaces, and package ecosystems.**

> **Task Tracking:** Granular tasks, checklists, and live status live in [.kanban/](.kanban/). This file is the stable architecture & design reference.

---

## 1. Core Design Principles

1. **Brain in the Agent, Hands in the Tool:** `brandlinter` does not embed an LLM. The host agent (Antigravity, OMP, Claude, Cursor) brainstorms candidates via `skills/brandlinter/SKILL.md`; `brandlinter` runs deterministic parallel verification.
2. **Two-Stage Funnel:** Stage 1 (`lint_availability`) screens 15–30 candidates against fast/free sources (DoH, RDAP, GitHub, npm/PyPI/crates.io). Stage 2 (`lint_seo`) checks only the top 5–8 finalists against pluggable SERP providers.
3. **Zero-Config Default, BYOK & Self-Hosted Ready:** Works out of the box with zero keys, and upgrades seamlessly with **OpenSERP**, **SearXNG**, **Serper**, **Brave**, **Google CSE**, **Exa**, **Porkbun**, or `GITHUB_TOKEN`.
4. **Evidence Over False Positives:** Explicitly distinguishes `available`, `taken`, and `unknown` (rate-limit/timeout/unsupported TLD).
5. **Test-Driven Development (TDD):** Every module and provider is built **test-first** (Red -> Green -> Refactor) using Vitest with mocked HTTP fixtures.

---

## 2. System Architecture

```mermaid
flowchart TB
    User["User / Product Brief"] --> Agent["Host Agent (Antigravity / OMP / Claude / Cursor)"]
    Skill["skills/brandlinter/SKILL.md"] -.-> Agent
    Agent -->|MCP stdio| MCP["MCP Server (src/mcp)"]
    Human["Terminal / CI"] -->|CLI| CLI["CLI (src/cli)"]
    MCP --> Core["Core Engine (src/core)"]
    CLI --> Core
    Core --> Stage1["Stage 1: DoH/RDAP + GitHub + npm/PyPI/crates"]
    Core --> Stage2["Stage 2: Pluggable SERP (OpenSERP/SearXNG/Serper/Brave/Exa/DDG)"]
    Stage1 --> Scorer["Collision Scorer (0-100) & Verdict"]
    Stage2 --> Scorer
```

---

## 3. Tech Stack & Directory Structure

- **Runtime:** TypeScript (Node.js >= 20 / Bun compatible), `@modelcontextprotocol/sdk`, `zod`, `tsup`, `vitest`.
- **Layout:** `src/core/` (`config.ts`, `sanitize.ts`, `concurrency.ts`, `scorer.ts`, `pipeline.ts`), `src/providers/` (`domain/`, `serp/`, `ecosystem/`, `optional/`), `src/cli/`, `src/mcp/`, `skills/brandlinter/SKILL.md`, `tests/`.
- **Security Invariants:** Strict slug validation (`^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]?$`), no shell interpolation for untrusted input (`execFile` only for `gh`/`whois`), no secret leakage in output, `stdout` reserved for JSON-RPC in `mcp` mode.

---

## 4. Roadmap Summary

| Phase | Scope | Status | Card |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Core Engine, Stage 1 Providers (DoH/RDAP, GitHub, npm/PyPI/crates) & CLI (`check`, `doctor`) | `done` | [20261124_121001_phase1_core_stage1_cli.md](.kanban/20261124_121001_phase1_core_stage1_cli.md) |
| **Phase 2** | Pluggable SERP Providers (`openserp`, `searxng`, `serper`, `brave`, `exa`, `ddg`) & Scorer (`seo`, `lint`) | `done` | [20261124_121002_phase2_serp_providers_scorer.md](.kanban/20261124_121002_phase2_serp_providers_scorer.md) |
| **Phase 3** | MCP Server (`stdio`), `SKILL.md`, & Opt-In Extensions (`porkbun`, `appstores`, `social`, `trademark`) | `done` | [20261124_121003_phase3_mcp_skill_extensions.md](.kanban/20261124_121003_phase3_mcp_skill_extensions.md) |
| **Phase 4** | `README.md`, GitHub Actions CI & npm Provenance Release | `done` | [20261124_121004_phase4_docs_oss_release.md](.kanban/20261124_121004_phase4_docs_oss_release.md) |
| **Phase 5** | v0.2.0: Real-World Ergonomics (`SKILL.md` gate, SERP failover, compact MCP, Exa keyword, App Store & near-miss) | `todo` | [20261124_135001_phase5_v0_2_real_world_ergonomics.md](.kanban/20261124_135001_phase5_v0_2_real_world_ergonomics.md) |
