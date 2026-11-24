---
title: "Phase 4: Docs & Open-Source Release"
status: todo
priority: low
created_at: 2026-11-24T12:10:04+07:00
tags:
  - phase-4
  - docs
  - ci-cd
  - release
---

# Phase 4: Docs & Open-Source Release

**Target:** Prepare `brandlinter` for public open-source release on GitHub and npm with CI/CD, provenance publishing, and clear documentation.

## Checklist

- [ ] **Documentation (`README.md`):** Add quickstart (`npx -y brandlinter@latest mcp`), provider comparison table, Antigravity/OMP/Claude/Cursor MCP configs, and `.env.example` guide.
- [ ] **CI Workflow (`.github/workflows/ci.yml`):** Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` on PRs and `main`.
- [ ] **Release Workflow (`.github/workflows/release.yml`):** Trigger on `v*` tags, verify `dist/cli.js` + MCP handshake, publish to npm with `--provenance` (OIDC), and create GitHub Release per `RELEASING.md`.
