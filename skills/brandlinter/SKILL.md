---
name: brandlinter
description: "Verify and lint product, startup, and open-source name candidates against SEO collisions, domain registries, GitHub namespaces, package ecosystems, and app stores using brandlinter MCP tools. Use for verification/linting — do not auto-run tools during open-ended concept brainstorming."
---

# brandlinter — Agent Naming Workflow

## Companion Skill & Gate (NO Premature Tool Calls)

For open-ended brainstorming, positioning discovery, or OSS rebrand strategy, use the companion **`brand-naming`** skill first (`skills/brand-naming/SKILL.md`).

- **Do NOT call `brandlinter` MCP tools** until the user asks to check, lint, or verify candidates (or explicitly asks for pre-verified names upfront).
- Avoid generic 2-word English compounds (`FastSync`, `OpenView`, `CloudFlow`) and single-word dictionary traps whose top 3 Google results are Wikipedia/Merriam-Webster.
- Move to the linting funnel below once candidates are ready to verify.

## Phase B: Two-Stage Linting Funnel

1. **Stage 1 (`lint_availability`):**
   - Pass up to **30 candidates in one batch** (`tlds: ["com", "dev", "io", "org"]`, `registries` matching the project's ecosystem).
   - Pass `includeApps: true` for mobile/desktop apps (checks Apple App Store exact & near/phonetic matches) and `includeSocial: true` when social handles matter.
   - Eliminate candidates where the primary package registry is taken, an exact GitHub repo has `>= 100` stars, or primary TLDs are taken.
2. **Stage 2 (`lint_seo`):**
   - Promote only the **top 5–10 cleanest candidates** from Stage 1.
   - **NEVER split `lint_seo` into multiple parallel tool calls** when backed by self-hosted OpenSERP — send all finalists in **one single batch call** (max 10) to avoid overloading the SERP server into `HTTP 502`.
   - Include `nicheKeywords` (2–3 words describing the product category, e.g., `["second monitor", "pen tablet"]`).
   - Read the built-in `seoVerdict`, `exactDomainInSerp`, `nearDomainMatches`, and `dictionaryTrap` fields directly (no manual log parsing needed; `brandlinter` automatically fails over to secondary configured providers on `502`/timeout).
3. **Iterate or Present:**
   - Reject any candidate with `exactDomainInSerp: true` or dominant brand overlap; flag `nearDomainMatches` and phonetic App Store collisions honestly as `CAUTION`.
   - **Mobile app store & social sanity checks for finalists:**
     - App Store near-match recall depends on Apple's search: run a quick web search for `"<name>" site:apps.apple.com` and `"<name>" site:play.google.com` (Google Play is not queried by `--apps`) before recommending mobile/desktop app names.
     - Automated social checks can hit bot blocks (e.g., Reddit returning `HTTP 200` with `<title>Blocked</title>` or LinkedIn returning `HTTP 403`): confirm finalist social handles directly when handles matter.
   - If fewer than 3 `CLEAN` candidates survive, brainstorm 1 more focused batch using what Stage 1/2 eliminated.
   - Present a comparison table with: Name, Verdict (`CLEAN`/`CAUTION`), Score, Domains, GitHub, Registry/Apps, and Top SERP Competitors.
