---
title: "Phase 1: Core Engine, Stage 1 Providers & CLI (TDD)"
status: done
priority: high
created_at: 2026-11-24T12:10:01+07:00
completed_at: 2026-11-24T12:16:00+07:00
tags:
  - phase-1
  - core
  - domain
  - ecosystem
  - cli
---

# Phase 1: Core Engine, Stage 1 Providers & CLI (TDD)

**Target:** Bootstrap the TypeScript/Vitest/tsup project and ship Stage 1 fast availability checks (DoH, RDAP, GitHub, npm, PyPI, crates.io) behind `brandlinter check` and `brandlinter doctor` using strict Red -> Green -> Refactor TDD.

## Technical Design

- **Sanitization (`core/sanitize.ts`):** Validate candidate slugs against `^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]?$` before building URLs or invoking local binaries (`gh`, `whois` via `execFile`).
- **Config Precedence (`core/config.ts`):** CLI flags / MCP args > env vars (`.env`) > `./brandlinter.config.json` > `~/.config/brandlinter/config.json` > zero-key defaults. Never expose secrets in logs/output.
- **Concurrency (`core/concurrency.ts`):** Shared semaphore + `AbortController` timeouts (`10s` Stage 1) + exponential backoff on `429`.
- [x] **Project setup:** `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` (`dist/cli.js` 17.39 KB).
- [x] **Red -> Green (`core/`):** `core/sanitize.ts`, `core/concurrency.ts`, `core/config.ts` (15 tests passing).
- [x] **Red -> Green (`providers/domain/`):** `doh.ts` and `rdap.ts` (6 tests passing).
- [x] **Red -> Green (`providers/ecosystem/`):** `github.ts`, `npm.ts`, `pypi.ts` (PEP 503), `crates.ts` (4 tests passing).
- [x] **CLI (`check` & `doctor`):** `src/cli/main.ts` and `src/cli/formatters.ts` verified (`node dist/cli.js doctor`).
- [ ] **Project setup:** Initialize `package.json` (`brandlinter`, Node >= 20, ESM, `bin`), `tsconfig.json`, `tsup.config.ts`, and `vitest.config.ts`.
- [ ] **Red -> Green (`core/`):** Write unit tests first and implement `core/sanitize.ts`, `core/concurrency.ts`, and `core/config.ts`.
- [ ] **Red -> Green (`providers/domain/`):** Write mocked HTTP fixture tests first and implement `doh.ts` and `rdap.ts` (IANA bootstrap cache + `rdap.org` fallback).
- [ ] **Red -> Green (`providers/ecosystem/`):** Write mocked API fixture tests first and implement `github.ts`, `npm.ts`, `pypi.ts` (PEP 503), and `crates.ts`.
- [ ] **CLI (`check` & `doctor`):** Implement `src/cli/main.ts` and `src/cli/formatters.ts` supporting `--json`, `--markdown`, `--format table`, `--tlds`, and `--registries`.
