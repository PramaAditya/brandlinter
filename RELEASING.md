# Release & Versioning Policy

`brandlinter` follows **Semantic Versioning (`MAJOR.MINOR.PATCH`)** and ships as an npm package (`brandlinter`) supporting both CLI (`npx brandlinter`) and MCP (`npx brandlinter mcp`).

---

## 1. Versioning Rules

| Bump | When to Use |
| :--- | :--- |
| `PATCH` (`0.1.x`) | Bug fixes, RDAP/SERP parser fixes, dependency updates, documentation fixes. |
| `MINOR` (`0.x.0`) | New pluggable provider, new optional CLI flag, backward-compatible MCP tool additions or optional fields. |
| `MAJOR` (`x.0.0`) | Breaking changes to CLI flags, MCP tool names/schemas, config file schema, or public TypeScript exports. |

Before `1.0.0`, minor releases may refine scoring heuristics, but **MCP tool names (`lint_availability`, `lint_seo`, `lint_names`, `doctor`) and CLI subcommands (`check`, `seo`, `lint`, `doctor`, `mcp`) must remain stable**.

---

## 2. Pre-Release Gate (Must Pass Before Tagging)

1. Full test suite passes offline (`npm test`).
2. Clean build & typecheck (`npm run typecheck && npm run build`).
3. Fresh bundle smoke check from `dist/`:
   - `node dist/cli.js --help`
   - `node dist/cli.js doctor`
   - MCP stdio initialize + `tools/list` handshake succeeds cleanly without writing non-JSON noise to `stdout`.
4. `CHANGELOG.md` and `package.json` version updated.
5. Verify no `.env` or secret artifacts are tracked (`git status`).

---

## 3. Release Workflow

1. Create and push release commit + annotated tag:
   ```bash
   npm version <patch|minor|major>
   git push origin main --follow-tags
   ```
2. GitHub Actions (`release.yml`) runs on `v*` tags:
   - Executes `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
   - Publishes to npm with `--provenance` (OIDC Trusted Publishing — no long-lived `NPM_TOKEN` needed).
   - Creates a GitHub Release with generated release notes.
