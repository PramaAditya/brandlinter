import { parseArgs } from "node:util";
import { resolveConfig, redactConfig } from "../core/config.js";
import { sanitizeCandidates, sanitizeTld } from "../core/sanitize.js";
import { Semaphore } from "../core/concurrency.js";
import { checkDomain } from "../providers/domain/rdap.js";
import { checkGitHub } from "../providers/ecosystem/github.js";
import { checkNpm } from "../providers/ecosystem/npm.js";
import { checkPypi } from "../providers/ecosystem/pypi.js";
import { checkCrates } from "../providers/ecosystem/crates.js";
import {
  formatStage1Markdown,
  formatStage1Table,
  type Stage1CandidateResult,
} from "./formatters.js";

function printHelp(): void {
  console.log(`brandlinter - Pluggable name linter for SEO, domains, GitHub, and package registries

Usage:
  brandlinter check <names...> [options]   Stage 1 fast availability check
  brandlinter doctor                       Inspect configuration & provider readiness
  brandlinter --help                       Show this help

Options:
  --tlds <list>         Comma-separated TLDs (default: com,dev,io,org)
  --registries <list>   Comma-separated registries: npm,pypi,crates (default: npm,pypi)
  --format <type>       Output format: table | markdown | json (default: table)
  --json                Shorthand for --format json
`);
}

async function runDoctor(): Promise<void> {
  const cfg = resolveConfig();
  const safe = redactConfig(cfg);
  console.log(JSON.stringify({ status: "ok", config: safe }, null, 2));
}

async function runCheck(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      tlds: { type: "string", default: "com,dev,io,org" },
      registries: { type: "string", default: "npm,pypi" },
      format: { type: "string", default: "table" },
      json: { type: "boolean", default: false },
    },
  });

  if (positionals.length === 0) {
    console.error("Error: provide at least one candidate name.");
    process.exitCode = 2;
    return;
  }

  const cfg = resolveConfig();
  const candidates = sanitizeCandidates(positionals);
  const tlds = values.tlds.split(",").map(sanitizeTld);
  const registries = values.registries
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter((r): r is "npm" | "pypi" | "crates" =>
      r === "npm" || r === "pypi" || r === "crates"
    );

  const sem = new Semaphore(5);
  const results: Stage1CandidateResult[] = await Promise.all(
    candidates.map((name) =>
      sem.run(async () => {
        const [domains, github, regResults] = await Promise.all([
          Promise.all(tlds.map((tld) => checkDomain(name, tld, cfg.dohUrl))),
          checkGitHub(name, cfg.githubToken),
          Promise.all(
            registries.map((reg) => {
              if (reg === "npm") return checkNpm(name);
              if (reg === "pypi") return checkPypi(name);
              return checkCrates(name);
            })
          ),
        ]);
        return { name, domains, github, registries: regResults };
      })
    )
  );

  const fmt = values.json ? "json" : values.format;
  if (fmt === "json") {
    console.log(JSON.stringify(results, null, 2));
  } else if (fmt === "markdown") {
    console.log(formatStage1Markdown(results));
  } else {
    console.log(formatStage1Table(results));
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }
  if (cmd === "doctor") {
    await runDoctor();
    return;
  }
  if (cmd === "check") {
    await runCheck(rest);
    return;
  }
  console.error(`Unknown command: ${cmd}`);
  printHelp();
  process.exitCode = 2;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
