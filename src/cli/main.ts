import { parseArgs } from "node:util";
import { resolveConfig, redactConfig, type SerpProviderId } from "../core/config.js";
import {
  runAvailabilityCheck,
  runFullLint,
  runSeoCheck,
  type RegistryId,
} from "../core/pipeline.js";
import {
  formatFullLintMarkdown,
  formatSeoMarkdown,
  formatStage1Markdown,
} from "./formatters.js";

function printHelp(): void {
  console.log(`brandlinter - Pluggable name linter for SEO, domains, GitHub, and package registries

Usage:
  brandlinter check <names...> [options]   Stage 1 fast availability check
  brandlinter seo <names...> [options]     Stage 2 SERP collision check
  brandlinter lint <names...> [options]    Full 2-stage funnel (Stage 1 -> Top K -> Stage 2)
  brandlinter doctor                       Inspect configuration & provider readiness
  brandlinter --help                       Show this help

Options:
  --tlds <list>           Comma-separated TLDs (default: com,dev,io,org)
  --registries <list>     Comma-separated registries: npm,pypi,crates (default: npm,pypi)
  --niche <keywords>      Niche keywords for SEO overlap check
  --provider <id>         SERP provider: auto|openserp|searxng|serper|brave|google-cse|exa|duckduckgo
  --top-k <n>             Number of Stage 1 finalists to promote to Stage 2 (default: 5)
  --format <type>         Output format: table | markdown | json (default: table)
  --json                  Shorthand for --format json
`);
}

function parseRegistries(raw: string): RegistryId[] {
  return raw
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter((r): r is RegistryId => r === "npm" || r === "pypi" || r === "crates");
}

async function runDoctor(): Promise<void> {
  const cfg = resolveConfig();
  console.log(JSON.stringify({ status: "ok", config: redactConfig(cfg) }, null, 2));
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

  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      tlds: { type: "string", default: "com,dev,io,org" },
      registries: { type: "string", default: "npm,pypi" },
      niche: { type: "string", default: "" },
      provider: { type: "string", default: "auto" },
      "top-k": { type: "string", default: "5" },
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
  const fmt = values.json ? "json" : values.format;
  const provider = values.provider as SerpProviderId;
  const nicheKeywords = values.niche ? values.niche.split(/\s+/).filter(Boolean) : undefined;

  if (cmd === "check") {
    const results = await runAvailabilityCheck(positionals, cfg, {
      tlds: values.tlds.split(","),
      registries: parseRegistries(values.registries),
    });
    console.log(fmt === "json" ? JSON.stringify(results, null, 2) : formatStage1Markdown(results));
    return;
  }

  if (cmd === "seo") {
    const results = await runSeoCheck(positionals, cfg, { nicheKeywords, provider });
    console.log(fmt === "json" ? JSON.stringify(results, null, 2) : formatSeoMarkdown(results));
    return;
  }

  if (cmd === "lint") {
    const topK = Number.parseInt(values["top-k"], 10) || 5;
    const results = await runFullLint(positionals, cfg, {
      tlds: values.tlds.split(","),
      registries: parseRegistries(values.registries),
      nicheKeywords,
      provider,
      topK,
    });
    console.log(fmt === "json" ? JSON.stringify(results, null, 2) : formatFullLintMarkdown(results));
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
