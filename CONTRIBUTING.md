# Contributing to brandlinter

Thank you for helping make `brandlinter` a reliable, vendor-neutral naming linter for developers and AI agents.

---

## 1. Engineering Rules (Mandatory)

### Test-Driven Development (TDD)
All changes to core logic, scoring rules, and provider adapters **must follow Red -> Green -> Refactor**:

1. **Red:** Write failing unit/integration tests in `tests/` first using deterministic mocked HTTP fixtures (`vi.stubGlobal('fetch', ...)` or recorded JSON/HTML payloads).
2. **Green:** Write the minimal implementation needed to pass the tests.
3. **Refactor:** Clean up duplication and edge-case handling while keeping tests green.

Tests must **never** hit live external APIs or require API keys in CI. Live endpoint checks belong in opt-in smoke scripts only.

### Security & Reliability Invariants
- **Input Sanitization:** Every candidate name and TLD must pass `sanitize.ts` before being interpolated into URLs, headers, or arguments.
- **No Shell Injection:** Never use shell interpolation (`exec`, `sh -c`) for untrusted input. Use `fetch` or `execFile` with explicit argument arrays when invoking local tools (`gh`, `whois`).
- **No Secret Leakage:** API keys and `Authorization` headers (e.g., `OPENSERP_AUTH_HEADER`, `SERPER_API_KEY`) must never appear in CLI output, MCP responses, error messages, or logs.
- **Honest Statuses:** Distinguish `available`, `taken`, and `unknown` (rate-limited, timeout, unsupported TLD). Never report `available` on HTTP `403`, `429`, `5xx`, or network timeouts.
- **Bounded Concurrency & Timeouts:** Every network adapter must honor `AbortSignal` timeouts and run through the shared concurrency limiter.

---

## 2. Adding a New Provider

`brandlinter` supports self-hosted, BYOK SaaS, and zero-key providers. When adding a new provider (e.g., a SERP engine, domain registrar, or package registry):

| Step | Requirement |
| :--- | :--- |
| 1. Interface | Implement the corresponding contract in `src/providers/types.ts` (`SerpProvider`, `DomainProvider`, or `EcosystemProvider`). |
| 2. Configuration | Read keys/URLs via `core/config.ts` (never `process.env` directly inside adapters). Document new variables in `.env.example`. |
| 3. Resolver & Doctor | Register the provider in its resolver and expose health/config status in `doctor` (without printing secret values). |
| 4. Mocked Fixtures | Add tests covering: normal results, empty results, `429` / `5xx` handling, timeout abort, and malformed payload resilience. |
| 5. Docs | Update `README.md` provider matrix with rate limits, auth requirements, and confidence caveats. |

---

## 3. Commit & Pull Request Guidelines

### Conventional Commits
Use [Conventional Commits](https://www.conventionalcommits.org/) so changelogs and semantic versioning stay automated:

- `feat:` new provider, CLI command, MCP tool, or scoring capability
- `fix:` bug fix, false-positive/false-negative fix, or parser fix
- `test:` adding or improving mocked fixtures/tests
- `docs:` `README.md`, `SKILL.md`, `PLAN.md`, or `.env.example` updates
- `chore:` build, CI, dependencies, or release metadata

### PR Checklist
- [ ] Failing test written first and now passes (`npm test` / `bun test`).
- [ ] Typecheck and build succeed (`npm run typecheck && npm run build`).
- [ ] No live network calls in test suite; no API keys or `.env` committed.
- [ ] Documentation (`.env.example`, `README.md`, or `SKILL.md`) updated if behavior or env vars changed.
