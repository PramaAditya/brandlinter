---
name: brand-naming
description: "Brainstorm product, startup, app, and open-source names from real user intent before verifying them with brandlinter. Use for open-ended naming ideation, positioning exploration, or pitching an OSS rebrand — not for running availability/SEO lints directly."
---

# brand-naming — User-Intent Naming & Rebrand Ideation

Companion skill to `brandlinter`. Use this skill during **divergent ideation and positioning**; hand off to `brandlinter` only when candidates are ready for deterministic verification.

## Hard Guardrail: Do NOT Lint Prematurely

- **Do NOT call `brandlinter` MCP tools** while still exploring positioning, audience, or initial directions. Stay fast and conversational.
- Only hand off to `brandlinter` once the user says directions click, explicitly asks to verify/check/lint names, or asks for pre-verified finalists upfront.

---

## Step 1: Reject Spec-First Naming — Ground in Real User Language

The most common failure mode is naming from internal architecture, protocol specs, or implementation details (e.g., reading `PROTOCOL.md` and generating tidy engineering compounds like `WireSlate` or `Outpane` that sound neat to the author but miss real users).

Before proposing names, gather or infer concrete evidence of how target users describe the problem:
- A real Reddit, Hacker News, or forum thread asking for a solution
- Competitor reviews, complaints, or GitHub Topics users search to find alternatives
- The exact phrases a frustrated user types into Google

Extract two positioning constraints from that evidence:
1. **Multi-Persona Umbrella:** Identify every major user group (e.g., stylus/drawing users *and* everyday portable-monitor users). Pick an umbrella that welcomes all primary personas — neither too narrow (locking out half the audience) nor so generic it vanishes into search noise.
2. **Roadmap Headroom:** Avoid tying the name to v1 limitations (single OS, single device type, or single-client architecture) if the roadmap expands later.

---

## Step 2: Ideate Across 5 Distinct Archetypes

Never default to 20 variations of the same generic 2-word English compound (`FastSync`, `CloudFlow`, `OpenDisplay`) — those collide heavily on Google page 1 and app stores. Present a focused set spanning genuinely different naming shapes:

1. **Action / Imperative Phrases** *(often overlooked, high upside)*
   - Plain everyday commands or phrases naming the exact moment of value (e.g., *Use That Screen*, *Read It Later*).
   - Immediately clear to non-technical users, effortless to remember, and frequently **100% collision-free** across Google, mobile app stores, and social handles because most builders compete over 2-word compounds.
2. **Tactile / Experiential Metaphors**
   - Evoke the physical surface, gesture, or interaction without narrowing to a single feature (e.g., *SideSlate*, *Astropad*).
3. **Open / Local Trust**
   - Signal local-first, cross-platform, zero-cloud reliability (e.g., *LocalSend*, *Deskflow*).
4. **Hardware / Standard Feel**
   - Borrow quiet, durable authority for open specs or protocols without sounding like internal jargon (e.g., *DisplayPort*-style clarity).
5. **Coined / Short Neologisms**
   - Crisp 2-syllable inventions or tight portmanteaus that are easy to spell in a terminal and own Google page 1 (e.g., *Parsec*, *Weylus*).

---

## Step 3: Pass Every Candidate Through Two Human Filters

Before showing a shortlist or moving to verification, filter each name against:

- **The Reddit Comment Test:** Drop the name into a real recommendation sentence (*"Forget [Competitor], just use **___** — works over USB or Wi-Fi."*). If it feels stiff, awkward to spell, or requires a paragraph to explain, cut or rework it.
- **The Tagline Split Rule:** Do not cram every feature into the name. Let the name carry the core action or feel, and let the one-line tagline carry the specifics (pen pressure, encryption, open protocol, OS support).

---

## Step 4: Handoff to `brandlinter` (Verification)

Once directions click and the user asks to check candidates, switch to the **`brandlinter`** skill for the 2-stage funnel (`lint_availability` -> single-batch `lint_seo`), and keep these real-world verification checks in mind for finalists:

- **Mobile App Stores:** Enable `includeApps: true` (Apple App Store) *and* run quick `"<name>"` checks on `site:apps.apple.com` and `site:play.google.com` for finalists.
- **Phonetic Twins:** Flag sound-alike collisions explicitly as `CAUTION` (e.g., `TabSpan` vs. an existing iOS app named `TapSpan`).
- **Social Handle False Positives:** Automated checks can misread bot-blocked responses (e.g., Reddit returning `HTTP 200` with `<title>Blocked</title>` or LinkedIn returning `HTTP 403`). Verify finalist handles directly when social presence matters.

---

## Rebranding an Existing Product or OSS Repo?

Read [`references/oss-rebrand.md`](references/oss-rebrand.md) before drafting a rebrand proposal or pitching a maintainer.
