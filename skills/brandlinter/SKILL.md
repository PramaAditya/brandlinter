---
name: brandlinter
description: "Brainstorm and lint product, startup, and open-source names against SEO collisions, domain registries, GitHub namespaces, and package ecosystems using brandlinter MCP tools."
---

# brandlinter — Agent Naming Workflow

Use this skill whenever the user asks to name, rename, or rebrand a software product, CLI tool, library, or open-source repository.

## 1. Naming Constraints (Before Calling Tools)

- **Avoid generic 2-word English compounds** (`AnyDisplay`, `OpenView`, `FastSync`) — they almost always collide with existing `.app`/`.com` SaaS products on Google page 1.
- **Avoid dictionary traps** — single common English words whose Top 3 Google results are Wikipedia/Merriam-Webster.
- **Prefer:** 2-syllable coined neologisms, Greek/Latin roots + technical suffixes (`nym`, `nom`, `lint`, `sift`, `scout`), or crisp portmanteaus that are easy to spell and type in a terminal.

## 2. Two-Stage Funnel Workflow

1. **Generate 20–30 candidates** tailored to the project's core capability and target ecosystem (`npm`, `pypi`, `crates`).
2. **Stage 1 (`lint_availability`):**
   - Pass all 20–30 candidates in **one batch** (`tlds: ["com", "dev", "io", "org"]`, `registries` matching the project's language).
   - Eliminate candidates where the primary package registry is taken, a GitHub repo has `>= 50` stars, or primary TLDs are taken.
3. **Stage 2 (`lint_seo`):**
   - Promote only the **top 5–8 cleanest candidates** from Stage 1.
   - Include `nicheKeywords` (2–3 words describing the domain, e.g., `["display protocol"]`).
   - Reject any candidate with an **exact-match domain** on Google page 1 (`exactDomainInSerp: true`) or dominant brand overlap.
4. **Iterate or Present:**
   - If fewer than 3 `CLEAN` candidates survive, run 1 more brainstorm batch using insights from Stage 1/2.
   - Present a comparison table with: Name, Verdict (`CLEAN`/`CAUTION`), Score, Domains, GitHub, Registry, and Top SERP Competitors.
