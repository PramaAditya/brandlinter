# brandlinter

**Lint your product and open-source names before you ship — across Google SERPs, domains, GitHub, and package registries.**

---

## The Naming Trap Every Builder Hits

You build something you're proud of. You pick a clean, obvious name — say, *FastSync*. The GitHub repo is free. Maybe even `.dev` is open. You publish it, share the link, and wait for people to find it.

Then someone Googles the name, and page one belongs entirely to `fastsync.app` — an established SaaS product that has been sitting there for years. Your open-source project is invisible on day one, not because the code wasn't good, but because the name walked straight into an SEO wall.

Checking names properly usually turns into an exhausting loop of tab-hopping: a registrar here, GitHub search there, npm, PyPI, crates.io, then ten incognito Google searches. And when you ask an AI coding agent to help brainstorm, it generates clever ideas completely blind to what already owns page one.

**`brandlinter` turns naming into a deterministic lint step.**

Instead of guessing or checking one name at a time, you (or your AI agent) throw 20–30 candidates into a fast two-stage funnel:

```mermaid
flowchart LR
    Ideas["20-30 Name Ideas\n(You or Your AI Agent)"] --> S1["Stage 1: Fast Screen\nDoH + RDAP · GitHub · npm / PyPI / crates"]
    S1 -->|"Top K cleanest finalists"| S2["Stage 2: Deep SEO Check\nOpenSERP · SearXNG · Serper · Brave · Exa · DDG"]
    S2 --> Verdict["Honest Verdict\nCLEAN · CAUTION · CONFLICT · UNVERIFIED"]
```

- **Fast and cheap first:** Stage 1 eliminates taken packages, popular repos, and registered domains (using RDAP, not just DNS) in seconds.
- **Protect your SERP quota:** Stage 2 only searches the cleanest finalists to catch page-1 exact-domain competitors and dictionary traps.
- **Honest verdicts, never optimistic guesses:** If a search provider times out, rate-limits, or a candidate wasn't SERP-checked, `brandlinter` marks it **`UNVERIFIED`** — never `CLEAN`.
- **Zero lock-in:** Works out of the box with zero API keys, or plugs into your self-hosted **OpenSERP** / **SearXNG** or paid **Serper** / **Brave** / **Google CSE** / **Exa** keys.

---

## Try It in 10 Seconds (Zero Config)

No API keys required to see how it works:

```bash
# Screen a batch of ideas across domains, GitHub, npm, and PyPI
npx brandlinter check nymlint nomsift fastsync --tlds com,dev,io --registries npm,pypi

# Run the full 2-stage funnel (Stage 1 -> Top K -> SEO collision check)
npx brandlinter lint fastsync nymlint nomsift --niche "file sync" --format markdown

# Check which providers are active and probe self-hosted endpoints
npx brandlinter doctor
```

---

## Use With Your AI Agent (MCP + Skill)

`brandlinter` follows a simple split: **the brain stays in your agent, the hands live in the tool.** Your agent already understands your codebase and product positioning — `brandlinter` gives it live, deterministic verification.

### 1. Add the MCP Server

Drop this into your MCP config (**Antigravity**, **OMP**, **Claude Desktop / Claude Code**, or **Cursor**):

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

> Want zero-key mode? Omit `env` completely. Prefer another backend? Swap `OPENSERP_URL` for `SEARXNG_URL`, `SERPER_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX`, or `EXA_API_KEY`.

| Client | Typical MCP Config Path |
| :--- | :--- |
| **Antigravity** | `~/.gemini/config/mcp_config.json` |
| **OMP** | `~/.omp/agent/mcp.json` |
| **Cursor** | `~/.cursor/mcp.json` |
| **Claude Desktop** | `claude_desktop_config.json` |

> **Windows note:** If your MCP host does not resolve `npx` directly, use `"command": "cmd.exe"` with `"args": ["/d", "/c", "npx", "-y", "brandlinter@latest", "mcp"]`.

### 2. Install the Agent Skill

Adding the MCP server gives your agent the tools; installing [`skills/brandlinter/SKILL.md`](skills/brandlinter/SKILL.md) teaches it *how and when* to use them: it stays in a **brainstorm phase** (no tool calls, working from real user language such as a forum thread) until you ask to verify, then runs the two-stage funnel, batches `lint_seo` in a single call, and reports the built-in verdicts instead of re-deriving them.

```bash
# Option A: via skills.sh / Vercel Agent Skills
npx skills add PramaAditya/brandlinter

# Option B: directly from the npm package (targets: agents | claude | omp | cursor)
npx brandlinter install-skill --target agents
```

Then just ask your agent:
> *"Brainstorm 25 name ideas for this repo and lint them with brandlinter so we don't collide on SEO, GitHub, or npm."*

---

## Pluggable Providers

Start free, and upgrade individual layers whenever you want higher accuracy or throughput:

| Layer | Zero-Key Default | Self-Hosted | Paid / BYOK |
| :--- | :--- | :--- | :--- |
| **SERP / SEO** | `duckduckgo` (best-effort fallback) | `openserp`, `searxng` | `serper`, `brave`, `google-cse`, `exa` |
| **Domains** | `rdap` (direct registry + DoH corroboration) | — | `porkbun` (opt-in) |
| **Code & Packages** | GitHub (public), `npm`, `PyPI` (PEP 503), `crates.io` | — | `GITHUB_TOKEN` (higher search rate limits) |

When `BRANDLINTER_SERP_PROVIDER=auto` (default), `brandlinter` walks the configured SERP providers in order and **automatically fails over** when one errors:
`openserp` → `searxng` → `serper` → `brave` → `google-cse` → `exa` → `duckduckgo`.

- Transient failures (`HTTP 429/500/502/503/504`, timeouts, connection resets) are retried once, then the batch moves to the next provider.
- Later candidates in the same batch skip the provider that already failed, so an outage costs one probe, not one per name.
- Every SERP result reports `provider` plus `fallbackFrom` so you can see exactly where an answer came from.
- An explicit `--provider exa` (or `BRANDLINTER_SERP_PROVIDER=exa`) stays strict: no silent substitution.

See [`.env.example`](.env.example) for all configuration variables.

---

## CLI & MCP Reference

### CLI Commands

| Command | Description |
| :--- | :--- |
| `brandlinter check <names...>` | Stage 1 fast batch screen (domains, GitHub org + repo stars, npm/PyPI/crates) |
| `brandlinter seo <names...>` | Stage 2 SERP collision check (`--niche`, `--provider`) |
| `brandlinter lint <names...>` | Full 2-stage funnel promoting `--top-k` finalists from Stage 1 to Stage 2 |
| `brandlinter mcp` | Start the `stdio` MCP server (`lint_availability`, `lint_seo`, `lint_names`, `doctor`) |
| `brandlinter install-skill` | Copy the bundled `SKILL.md` to `agents`, `claude`, `omp`, or `cursor` |
| `brandlinter doctor` | Inspect resolved providers, config warnings, and probe self-hosted endpoints |

Common flags: `--tlds com,dev,io,org`, `--registries npm,pypi,crates`, `--niche "keywords"`, `--provider auto|openserp|...`, `--apps` (Apple App Store, exact + near/phonetic), `--social` (X, YouTube, Reddit, Bluesky, LinkedIn), `--top-k 5`, `--format table|markdown|json`, `--json`.

### MCP Response Shape

MCP tools return a **compact signal summary** by default (a 10-name SEO batch stays around 3 KB instead of dumping raw SERP JSON):

| Field | Meaning |
| :--- | :--- |
| `verdict` / `seoVerdict` | `CLEAN`, `CAUTION`, `CONFLICT`, or `UNVERIFIED` |
| `exactDomainInSerp` | A `{name}.{tld}` registrar domain literally owns a page-1 slot |
| `nearDomainMatches` | Registrar twins on page 1 (`localscreenshare.com` for `localscreen`) |
| `dictionaryTrap` | Wikipedia/Merriam-Webster dominate the top 3 |
| `appStoreNearMatches` | App Store titles one edit away (`TapSpan` for `Tabspan`) |
| `top` / `nicheTop` | Top 5 exact hits and top 3 niche hits (`rank`, `domain`, `title`) |
| `fallbackFrom` | Present when the response came from a backup SERP provider |

Need the raw provider payloads (full SERP items, per-domain `detail`, exact repo URLs)? Pass `verbose: true` to any MCP tool.

Note: App Store near-match detection depends on Apple's own search recall. For finalists, a single `site:apps.apple.com` web search is still a cheap sanity check.

---

## Development & Contributing

`brandlinter` is built with strict **Test-Driven Development (TDD)** using Vitest and mocked HTTP fixtures.

```bash
npm install
npm test
npm run typecheck
npm run build
```

- Architecture & design spec: [`PLAN.md`](PLAN.md)
- TDD & provider contribution rules: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Release & npm provenance policy: [`RELEASING.md`](RELEASING.md)
- Security boundaries: [`SECURITY.md`](SECURITY.md)

## License

[MIT](LICENSE)
