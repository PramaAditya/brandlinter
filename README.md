# brandlinter

**A pluggable, agent-native CLI and MCP server for linting product, startup, and open-source names against SEO collisions, domain registries, GitHub namespaces, and package ecosystems.**

---

## Why `brandlinter`?

Naming software fails most often because of **SEO and ecosystem collisions** — not just `.com` availability. A descriptive name can have a free GitHub repo and still lose page-1 Google visibility to an established `.app` or `.io` product.

`brandlinter` uses a **two-stage funnel**:
1. **Stage 1 (`lint_availability` / `check`):** Screens 15–30 candidates in parallel against zero-key/fast sources (DoH, RDAP, GitHub org + repo stars, npm, PyPI, crates.io).
2. **Stage 2 (`lint_seo` / `seo`):** Promotes only the cleanest finalists to a pluggable SERP provider (**OpenSERP**, **SearXNG**, **Serper**, **Brave**, **Google CSE**, **Exa**, or zero-key **DuckDuckGo** fallback) to detect exact-domain matches and dictionary traps.

---

## Quick Start

### 1. MCP Server (Antigravity, OMP, Claude Desktop/Code, Cursor)

Add to your MCP config:

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

*(Omit `env` to run in zero-key mode, or swap `OPENSERP_URL` for `SEARXNG_URL`, `SERPER_API_KEY`, `BRAVE_API_KEY`, or `EXA_API_KEY`.)*

Pair with [`skills/brandlinter/SKILL.md`](skills/brandlinter/SKILL.md) so your agent knows how to brainstorm and run the 2-stage funnel.

### 2. CLI

```bash
# Check configured providers and secrets (redacted)
npx brandlinter doctor

# Stage 1 fast availability check
npx brandlinter check nymlint nomilint nomsift --tlds com,dev,io --registries npm,pypi

# Stage 2 SEO collision check
npx brandlinter seo nymlint nomsift --niche "open source linter" --format markdown

# Full 2-stage funnel (Stage 1 -> Top K -> Stage 2)
npx brandlinter lint anydisplay nymlint nomsift --niche "display protocol" --format markdown
```

---

## Pluggable Providers

| Layer | Zero-Key Default | Self-Hosted | Paid / BYOK |
| :--- | :--- | :--- | :--- |
| **SERP / SEO** | `duckduckgo` (low-confidence fallback) | `openserp`, `searxng` | `serper`, `brave`, `google-cse`, `exa` |
| **Domains** | `rdap` (IANA bootstrap) + `doh` | — | `porkbun` (opt-in) |
| **Code & Packages** | GitHub (public), `npm`, `PyPI` (PEP 503), `crates.io` | — | `GITHUB_TOKEN` / `gh auth token` |

See [`.env.example`](.env.example) for all supported environment variables.

---

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) (strict TDD) and [`RELEASING.md`](RELEASING.md).

## License

[MIT](LICENSE)
