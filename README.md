<p align="center">
  <samp>brandlinter &nbsp;·&nbsp; Stage 1 (RDAP · GitHub · Registries) &nbsp;──→&nbsp; Stage 2 (7 SERP Engines) &nbsp;──→&nbsp; Honest Verdict</samp>
</p>

<h1 align="center">brandlinter</h1>

<p align="center">
  <b>Lint your product and open-source names before you ship — across Google SERPs, domains, GitHub, and package registries.</b>
  <br>
  Pluggable CLI &amp; stdio MCP server · Node.js &ge; 20 · Zero API keys required
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/brandlinter"><img src="https://img.shields.io/npm/v/brandlinter?style=flat-square&color=cb3837" alt="npm version"></a>
  <a href="https://github.com/PramaAditya/brandlinter/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/PramaAditya/brandlinter/ci.yml?style=flat-square&label=CI" alt="CI status"></a>
  <img src="https://img.shields.io/badge/SERP_providers-7-6e40c9?style=flat-square" alt="7 SERP providers">
  <img src="https://img.shields.io/badge/zero__key-default-2ea44f?style=flat-square" alt="Zero-key default">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License"></a>
</p>

<br>

---

```text
$ npx brandlinter lint fastsync nomsift nymlint --niche "file sync" --top-k 1

| Name | Verdict | Score | GH Org | .com | SERP Exact | Top Competitor |
| --- | --- | --- | --- | --- | --- | --- |
| fastsync | CONFLICT | 15/100 | TAKEN | TAKEN | skipped | - |
| nomsift | CLEAN | 100/100 | FREE | FREE | 0 | - |
| nymlint | UNVERIFIED | 100/100 | FREE | FREE | skipped | - |
```

<br>

---

## The Naming Trap Every Builder Hits

You build something you're proud of. You pick a clean, obvious name — say, *FastSync*. The GitHub repo looks open, maybe `.io` is free, so you publish it and share the link.

Then someone Googles the name, and page one belongs to an established product that has been sitting there for years. Your project is invisible on day one — not because the code fell short, but because the name walked straight into an SEO wall.

Checking names manually turns into tab-hopping across registrars, GitHub, npm, PyPI, crates.io, and incognito search windows. And when you ask an AI coding agent to brainstorm, it invents clever names completely blind to what already owns page one.

**`brandlinter` turns naming into a deterministic lint step.**

Instead of checking one idea at a time, you (or your AI agent) drop up to 30 candidates into a two-stage funnel:

```mermaid
flowchart LR
    Ideas["Up to 30 Candidates\n(You or Your AI Agent)"] --> S1["Stage 1: Fast Screen\nRDAP + DoH · GitHub · npm / PyPI / crates"]
    S1 -->|"Top K cleanest finalists"| S2["Stage 2: Deep SEO Check\nAuto-Failover Across 7 SERP Engines"]
    S2 --> Verdict["Honest Verdict\nCLEAN · CAUTION · CONFLICT · UNVERIFIED"]
```

- **Fast and cheap first:** Stage 1 eliminates taken packages, starred GitHub repos, and registered domains — using direct authoritative RDAP (`.com`, `.net`, `.org`, `.dev`, `.app`) with `rdap.org` and DoH fallback — in seconds.
- **Protect your SERP quota:** Stage 2 searches only the `--top-k` cleanest finalists (default `5`) to catch page-1 exact domains, registrar near-misses (`localscreenshare.com` for `localscreen`), niche competitors, and dictionary traps.
- **Honest verdicts, never optimistic guesses:** If Stage 2 is skipped, a SERP provider errors, or any Stage 1 domain, registry, or GitHub org check returns `unknown`, `brandlinter` marks the name **`UNVERIFIED`** — never `CLEAN`.
- **Zero lock-in:** Runs out of the box with zero API keys, or upgrades per layer with self-hosted **OpenSERP** / **SearXNG**, paid **Serper** / **Brave** / **Google CSE** / **Exa**, and `GITHUB_TOKEN`.

<br>

---

## Try It in 10 Seconds (Zero Config)

No API keys, signup, or config files required:

```bash
# Screen a batch across domains, GitHub, npm, and PyPI (Stage 1 only)
npx brandlinter check fastsync nymlint nomsift --tlds com,dev,io --registries npm,pypi

# Run the full 2-stage funnel (Stage 1 -> Top 2 -> Stage 2 SEO collision check)
npx brandlinter lint fastsync nymlint nomsift --niche "file sync" --top-k 2

# Inspect active providers, config warnings, and probe self-hosted endpoints
npx brandlinter doctor
```

<br>

---

## Use With Your AI Agent (MCP + Skill)

`brandlinter` follows one split: **the brain stays in your agent, the hands live in the tool.** Your agent already knows your codebase and positioning — `brandlinter` gives it live, deterministic verification over `stdio` MCP.

### 1. Add the MCP Server

Drop this into your MCP configuration (**Antigravity**, **OMP**, **Claude Desktop / Claude Code**, or **Cursor**):

```json
{
  "mcpServers": {
    "brandlinter": {
      "command": "npx",
      "args": ["-y", "brandlinter@latest", "mcp"],
      "env": {
        "OPENSERP_URL": "https://your-openserp-instance.com"
      }
    }
  }
}
```

> Want zero-key mode? Omit `env` completely. Prefer another SERP backend? Swap `OPENSERP_URL` for `SEARXNG_URL`, `SERPER_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX`, or `EXA_API_KEY`.

| Client | Typical MCP Config Path |
| :--- | :--- |
| **Antigravity** | `~/.gemini/config/mcp_config.json` |
| **OMP** | `~/.omp/agent/mcp.json` |
| **Cursor** | `~/.cursor/mcp.json` |
| **Claude Desktop** | `claude_desktop_config.json` |

> **Windows note:** If your MCP host cannot resolve `npx` directly, use `"command": "cmd.exe"` with `"args": ["/d", "/c", "npx", "-y", "brandlinter@latest", "mcp"]`.

### 2. Install the Agent Skill

The MCP server gives your agent the tools; [`skills/brandlinter/SKILL.md`](skills/brandlinter/SKILL.md) teaches it *when and how* to use them. It keeps brainstorming conversational and grounded in real user language (no tool calls) until you ask to verify, then runs Stage 1, batches Stage 2 (`lint_seo`, max 10) in a single call, and reports the built-in verdicts verbatim.

```bash
# Option A: via skills.sh / Agent Skills CLI
npx skills add PramaAditya/brandlinter

# Option B: directly from npm (targets: agents | claude | omp | cursor)
npx brandlinter install-skill --target agents
```

> *"Brainstorm 25 name ideas for this repo and lint them with brandlinter so we don't collide on SEO, GitHub, or npm."*

<br>

---

## Pluggable Providers & Auto-Failover

Start free and upgrade individual layers whenever you want higher accuracy or throughput:

| Layer | Zero-Key Default | Self-Hosted | Paid / BYOK |
| :--- | :--- | :--- | :--- |
| **SERP / SEO** | `duckduckgo` (fallback) | `openserp`, `searxng` | `serper`, `brave`, `google-cse`, `exa` |
| **Domains** | `rdap` (direct `.com`/`.net`/`.org`/`.dev`/`.app` + `rdap.org` & DoH) | — | `porkbun` *(optional adapter; config-ready)* |
| **Code & Packages** | GitHub (public), `npm`, `PyPI` (PEP 503), `crates.io` | — | `GITHUB_TOKEN` (higher repo search limits) |
| **Optional Signals** | Apple App Store (`--apps`), Social (`--social`: X, YouTube, Reddit, Bluesky, LinkedIn) | — | — |

With `BRANDLINTER_SERP_PROVIDER=auto` (default), `brandlinter` walks configured SERP backends in order and **automatically fails over** on error:
`openserp` → `searxng` → `serper` → `brave` → `google-cse` → `exa` → `duckduckgo`.

- **Retry once, then fail over:** Transient failures (`HTTP 429/500/502/503/504`, timeouts, connection resets) retry once; the batch then advances to the next provider so later candidates skip the broken backend.
- **Full provenance:** Every SERP answer reports `provider` plus `fallbackFrom` whenever a backup answered.
- **Strict overrides:** Setting `--provider exa` (or `BRANDLINTER_SERP_PROVIDER=exa`) never silently substitutes another engine.

Config loads from CLI overrides > environment > `.env` > `brandlinter.config.json` > `~/.config/brandlinter/config.json`. See [`.env.example`](.env.example) for all variables.

<br>

---

## CLI & MCP Reference

### CLI Commands

| Command | Description |
| :--- | :--- |
| `brandlinter check <names...>` | Stage 1 batch screen (domains, GitHub org + repo stars, npm/PyPI/crates) |
| `brandlinter seo <names...>` | Stage 2 SERP collision check (`--niche`, `--provider`) |
| `brandlinter lint <names...>` | Full 2-stage funnel promoting `--top-k` finalists from Stage 1 to Stage 2 |
| `brandlinter mcp` | Start the `stdio` MCP server (`lint_availability`, `lint_seo`, `lint_names`, `doctor`) |
| `brandlinter install-skill` | Install bundled `SKILL.md` for `agents`, `claude`, `omp`, or `cursor` |
| `brandlinter doctor [--no-probe]` | Inspect redacted config, warnings, and probe self-hosted SERP endpoints |

Common flags: `--tlds com,dev,io,org`, `--registries npm,pypi,crates`, `--niche "keywords"`, `--provider auto|openserp|...`, `--apps`, `--social`, `--top-k 5`, `--format table|markdown|json`, `--json`.

### MCP Compact Payload

MCP tools return a **compact signal summary** by default so a 10-name SEO batch stays small in agent context (pass `verbose: true` to any tool for full raw payloads):

| Field | Meaning |
| :--- | :--- |
| `verdict` / `seoVerdict` | `CLEAN`, `CAUTION`, `CONFLICT`, or `UNVERIFIED` |
| `exactDomainInSerp` | A `{name}.{tld}` domain owns a page-1 slot |
| `nearDomainMatches` | Page-1 registrar twins (`localscreenshare.com` for `localscreen`) |
| `dictionaryTrap` | Wikipedia or major dictionaries dominate the top 3 results |
| `apps[].nearMatches` | App Store titles within one edit or shared prefix (`TapSpan` for `Tabspan`) |
| `top` / `nicheTop` | Top 5 exact hits and top 3 niche hits (`rank`, `domain`, `title`) |
| `fallbackFrom` | Original SERP provider when a failover engine answered |

> App Store near-match detection depends on Apple's search recall. For finalists, a quick `site:apps.apple.com` web search remains a cheap sanity check.

<br>

---

## Development & Contributing

Built with strict **Test-Driven Development (TDD)** using Vitest and offline mocked HTTP fixtures (104 tests across 12 suites).

```bash
npm install
npm test
npm run typecheck
npm run build
```

- Architecture & design specification: [`PLAN.md`](PLAN.md)
- TDD & provider contribution rules: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Release & npm provenance policy: [`RELEASING.md`](RELEASING.md)
- Security boundaries & reporting: [`SECURITY.md`](SECURITY.md)

<br>

---

<p align="center">
  <a href="PLAN.md">Architecture</a> · <a href="skills/brandlinter/SKILL.md">Agent Skill</a> · <a href="CONTRIBUTING.md">Contributing</a> · <a href="SECURITY.md">Security</a> · <a href="https://www.npmjs.com/package/brandlinter">npm</a>
</p>

<p align="center">
  <sub><a href="LICENSE">MIT License</a> · Built by <a href="https://github.com/PramaAditya">Prama Aditya Putra</a></sub>
</p>
