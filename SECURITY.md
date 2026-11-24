# Security Policy

## Reporting a Vulnerability

If you discover a security issue in `brandlinter` (for example: command injection in local CLI adapters, SSRF via custom endpoint URLs, or accidental leakage of API keys/auth headers into MCP/CLI output), please **do not open a public GitHub issue with exploit details**.

Instead, report it privately via GitHub Security Advisories (**Security -> Advisories -> Report a vulnerability**) on the repository.

---

## Security Boundaries in `brandlinter`

- **Candidate Input:** Treated as untrusted input; strictly validated against DNS/slug allowlists (`^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]?$`) before building any URL or spawning local commands (`gh`, `whois`).
- **Configured Service URLs:** `OPENSERP_URL`, `SEARXNG_URL`, and `DOH_URL` are operator-configured endpoints, restricted to `http:` / `https:` schemes.
- **Credential Handling:** Environment secrets (`SERPER_API_KEY`, `OPENSERP_AUTH_HEADER`, `GITHUB_TOKEN`, etc.) are never echoed in `doctor`, error messages, or MCP tool payloads.
- **MCP `stdout` Hygiene:** In `mcp` mode, `stdout` is strictly reserved for JSON-RPC frames; diagnostic logs go exclusively to `stderr`.
