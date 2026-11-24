---
name: brandlinter
description: "Verify and lint product, startup, and open-source name candidates against SEO collisions, domain registries, GitHub namespaces, package ecosystems, and app stores using brandlinter MCP tools. Use for verification/linting — do not auto-run tools during open-ended concept brainstorming."
---

# brandlinter — Agent Naming Workflow

## Phase A: Concept Brainstorming (NO MCP Tool Calls)

When the user asks for initial name ideas, explores product positioning, or has not yet asked to verify/check/lint names:

- **Do NOT call `brandlinter` MCP tools yet.** Stay fast and conversational while aligning on audience, angle, and the actual problem.
- **Start from the user's own words.** Ask for or work from real evidence of the target user's problem — a forum/Reddit/HN thread, an issue, a support ticket, a review, or a paragraph describing the pain in their voice. Name candidates should emerge from *their* vocabulary, not from naming formulas.
- **Do not impose a naming style.** Avoid prescribing syllable counts, Latin/Greek roots, or "adjective+noun" recipes; those over-steer toward AI-sounding names. Reflect the words real users already use for the problem, then let the concepts lead.
- **Avoid generic 2-word English compounds** (`FastSync`, `OpenView`, `CloudFlow`) — they almost always collide with existing `.app`/`.com` SaaS products on Google page 1.
- **Avoid dictionary traps** — single common English words whose Top 3 Google results are Wikipedia/Merriam-Webster.
- Only move to **Phase B** once the user asks to check, lint, or verify candidates (or explicitly asks for pre-verified names upfront).

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
   - App Store near-match recall depends on Apple's own search: for each finalist, run one web search for `"<name>" site:apps.apple.com` before recommending it.
   - If fewer than 3 `CLEAN` candidates survive, brainstorm 1 more focused batch using what Stage 1/2 eliminated.
   - Present a comparison table with: Name, Verdict (`CLEAN`/`CAUTION`), Score, Domains, GitHub, Registry/Apps, and Top SERP Competitors.
