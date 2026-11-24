---
title: "Phase 2: Pluggable SERP Providers & Scorer (TDD)"
status: done
priority: high
created_at: 2026-11-24T12:10:02+07:00
completed_at: 2026-11-24T12:18:00+07:00
tags:
  - phase-2
  - serp
  - scorer
  - cli
---

# Phase 2: Pluggable SERP Providers & Scorer (TDD)

**Target:** Implement pluggable SERP collision providers (self-hosted, BYOK SaaS, and zero-key fallback) plus the 0–100 collision scoring rubric and `brandlinter seo` / `brandlinter lint` commands via TDD.

## Technical Design

- **SERP Auto-Resolution (`providers/serp/resolver.ts`):** `OPENSERP_URL` -> `SEARXNG_URL` -> `SERPER_API_KEY` -> `BRAVE_API_KEY` -> `GOOGLE_CSE_API_KEY` -> `EXA_API_KEY` -> `duckduckgo` (tagged `confidence: "low"`), overridable via `BRANDLINTER_SERP_PROVIDER` or `--serp-provider`.
- **OpenSERP Adapter (`openserp.ts`):** Calls `/mega/search`, parses `domain_info.sld`, `rank`, `snippet`; concurrency `2`, timeout `45s`, optional `OPENSERP_AUTH_HEADER`.
- **Collision Scoring Rubric (`core/scorer.ts`, starts at `100`):**
  - Exact domain in SERP Top 10 (`{name}.{com,app,io,dev,ai,org}`): `-50` (auto `FAIL`)
  - Established brand in SERP Top 5: `-40` (`FAIL`)
  - Dictionary/generic trap in SERP Top 3 (Wikipedia/Wiktionary/Merriam-Webster): `-30`
  - Niche overlap (`"{name}" {niche}` active competitor): `-30` (`FAIL`)
  - Popular GitHub repo: `>= 100` stars (`-35`), `10–99` stars (`-15`)
  - GitHub org/user taken: `-15`; primary registry taken: `-25`; primary TLD taken: `-10` each; unquoted autocorrect collision: `-20`
  - Verdicts: `CLEAN` (`80–100`), `CAUTION` (`50–79`), `CONFLICT` (`< 50` or fatal flag).

- [x] **Red -> Green (`serp/resolver.ts`):** `SerpProvider` interface + auto-detection & override tests passing.
- [x] **Red -> Green (Self-hosted SERP):** `openserp.ts` and `searxng.ts` tested against JSON fixtures.
- [x] **Red -> Green (BYOK & Fallback SERP):** `serper.ts`, `brave.ts`, `google-cse.ts`, `exa.ts`, `duckduckgo.ts` tested against mocked fixtures (10 tests passing).
- [x] **Red -> Green (`core/scorer.ts`):** Penalty rubric & verdict thresholds tested (4 tests passing).
- [x] **CLI (`seo` & `lint`):** `src/core/pipeline.ts`, `seo` & `lint` commands built (`dist/cli.js` 36.06 KB).
- [ ] **Red -> Green (`core/scorer.ts`):** Test penalty rubric and verdicts (`AnyDisplay` vs `anydisplay.app`, dictionary traps, 0-star vs 100-star repos).
- [ ] **CLI (`seo` & `lint`):** Implement `brandlinter seo` and `brandlinter lint` (2-stage funnel promoting top `K` Stage 1 candidates to Stage 2).
