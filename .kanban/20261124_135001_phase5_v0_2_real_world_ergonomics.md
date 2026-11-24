---
title: "Phase 5 (v0.2.0): Real-World Ergonomics, SERP Failover & App Store Wiring (TDD)"
status: todo
priority: high
created_at: 2026-11-24T13:50:01+07:00
tags:
  - phase-5
  - v0-2
  - serp
  - mcp
  - skill
  - scorer
---

# Phase 5 (v0.2.0): Real-World Ergonomics, SERP Failover & App Store Wiring (TDD)

**Target:** Address 7 friction points discovered during real-world dogfooding (OMP session `01a20c25`) — separating brainstorming from linting in `SKILL.md`, automatic SERP failover, compact MCP payloads with SEO verdicts, Exa keyword mode, RDAP `.dev`/`.app` speed, near-miss/phonetic warnings, and wiring `includeApps`/`includeSocial`.

## Technical Design

- **Brainstorm vs Lint Gate (`skills/brandlinter/SKILL.md`):** Explicitly split Phase A (concept/positioning brainstorming — DO NOT call MCP tools) from Phase B (linting — call only when user asks to check/verify). Warn agents never to split `lint_seo` into parallel calls against self-hosted OpenSERP (avoids 502 overload).
- **SERP Failover Chain (`src/providers/serp/resolver.ts` + `src/core/pipeline.ts`):** Build ordered list of all configured providers (`openserp` -> `searxng` -> `serper` -> `brave` -> `google-cse` -> `exa`). On transient provider errors (`HTTP 502/503/429` or timeout), retry once with short backoff and automatically fail over to the next configured provider, annotating `fallbackFrom` in `SeoCheckResult`.
- **Exa & RDAP Accuracy (`src/providers/serp/exa.ts`, `src/providers/domain/rdap.ts`):** Use `type: "keyword"` for exact-name queries in Exa to eliminate semantic drift; add `User-Agent` and avoid wasted `rdap.org` 403 hops on TLDs where direct registry/DoH is faster.
- **Compact MCP Responses + SEO Verdict (`src/mcp/server.ts`, `src/core/scorer.ts`):** Return compact structured results by default (`compact: true`) with `seoVerdict`, `exactDomainInSerp`, `nearDomainMatches`, `dictionaryTrap`, and Top 5 `{ rank, domain, title }` (never spilling >14 KB JSON logs); add `verbose?: boolean` opt-in for full raw payloads.
- **Near-Miss & App Store Wiring (`src/core/pipeline.ts`, `src/core/scorer.ts`, `src/providers/optional/appstores.ts`):** Wire `includeApps` and `includeSocial` into `runAvailabilityCheck`, CLI (`--apps`, `--social`), and MCP (`lint_availability`, `lint_names`). Flag prefix/near-domain SERP matches (e.g., `localscreenshare.com` for `localscreen`) and edit-distance `<= 1` App Store phonetic collisions (e.g., `Tabspan` vs `TapSpan`) as `CAUTION` warnings.

## Checklist

- [ ] **Skill Gate (`skills/brandlinter/SKILL.md`):** Separate Phase A (brainstorming, no MCP calls) vs Phase B (linting on explicit check request) and forbid parallel `lint_seo` fan-out on self-hosted OpenSERP.
- [ ] **Red -> Green (SERP Failover):** Write mocked 502/timeout failover tests and implement multi-provider failover chain (`fallbackFrom` metadata) in `resolver.ts` + `pipeline.ts`.
- [ ] **Red -> Green (Exa Keyword & RDAP Speed):** Switch Exa exact queries to `type: "keyword"` and optimize `.dev`/`.app` RDAP handling (avoid repeated 403 fallback latency) with unit tests.
- [ ] **Red -> Green (Compact MCP + SEO Verdict):** Return `seoVerdict` + compact Top 5 summary from `lint_seo` / `lint_availability` / `lint_names` (`verbose?: boolean` opt-in) with schema & payload-size tests.
- [ ] **Red -> Green (Near-Miss & App Stores Wiring):** Wire `includeApps` / `includeSocial` into CLI & MCP, and add prefix-domain + Levenshtein `<= 1` phonetic near-miss warnings in `scorer.ts`.

## Verification (2026-11-24)

- `npx tsc --noEmit` clean; `npx vitest run` 104 tests passing across 12 files (new: `tests/serp-failover.test.ts`, `tests/near-miss-and-compact.test.ts`).
- Live failover: `OPENSERP_URL=https://openserp.invalid node dist/cli.js seo sideslate --json` returned `provider: "exa"`, `fallbackFrom: "openserp"`.
- Live MCP `lint_names` (2 candidates, `includeApps`, niche keywords) returned a 2,943-byte compact payload with `seoVerdict`, `verdict`, and `fallbackFrom`. The same run proved the real self-hosted OpenSERP was answering `HTTP 502` (`curl /mega/search` confirmed), so failover handled an actual outage.
- RDAP: `pubapi.registry.google` answered `.dev` 404 / `.app` 200 directly; Exa `type: "keyword"` returned zero results for `"tabspan"` instead of Stack Overflow `tab-width` noise.
- Known limit: App Store near-match recall depends on Apple's search API; iTunes does not surface `TapSpan` for the query `tabspan`, so the skill still recommends one `site:apps.apple.com` check for finalists.
