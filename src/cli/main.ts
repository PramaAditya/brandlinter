import { parseArgs } from "node:util";
import { resolveConfig, runDoctorCheck, type SerpProviderId } from "../core/config.js";
import {
  runAvailabilityCheck,
  runFullLint,
  runSeoCheck,
  type RegistryId,
} from "../core/pipeline.js";
import { startMcpServer } from "../mcp/server.js";
import {
  formatFullLintMarkdown,
  formatSeoMarkdown,
  formatStage1Markdown,
} from "./formatters.js";
import { installSkill, type SkillTarget } from "./skill.js";

const VALID_COMMANDS: Record<string, true> = { check: true, seo: true, lint: true, doctor: true, mcp: true, "install-skill": true };
const VALID_FORMATS: Record<string, true> = { table: true, markdown: true, json: true };
const VALID_REGISTRIES: Record<RegistryId, true> = { npm: true, pypi: true, crates: true };

function printHelp(): void {
  console.log(`brandlinter - Pluggable name linter for SEO, domains, GitHub, and package registries

Usage:
  brandlinter check <names...> [options]   Stage 1 fast availability check
  brandlinter seo <names...> [options]     Stage 2 SERP collision check
  brandlinter lint <names...> [options]    Full 2-stage funnel (Stage 1 -> Top K -> Stage 2)
  brandlinter mcp                          Start stdio MCP server (Antigravity, OMP, Claude, Cursor)
  brandlinter install-skill [--target id]  Install bundled SKILL.md (agents|claude|omp|cursor)
  brandlinter doctor [--no-probe]          Inspect configuration & probe self-hosted endpoints
  brandlinter --help                       Show this help

Options:
  --tlds <list>           Comma-separated TLDs (default: com,dev,io,org)
  --registries <list>     Comma-separated registries: npm,pypi,crates (default: npm,pypi)
  --niche <keywords>      Niche keywords for SEO overlap check
  --provider <id>         SERP provider: auto|openserp|searxng|serper|brave|google-cse|exa|duckduckgo
  --apps                  Also check the Apple App Store (exact + near/phonetic)
  --social                Also check X, YouTube, Reddit, Bluesky, and LinkedIn handles
  --top-k <n>             Number of Stage 1 finalists to promote to Stage 2 (default: 5, must be >= 1)
  --format <type>         Output format: table | markdown | json (default: table)
  --json                  Shorthand for --format json
`);
}

function parseRegistries(raw: string): RegistryId[] {
  const parts = raw
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  for (const p of parts) {
    if (!(p in VALID_REGISTRIES)) {
      throw new Error(`Invalid registry "${p}". Valid values: npm, pypi, crates`);
    }
  }
  return parts as RegistryId[];
}

async function runDoctor(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    allowPositionals: false,
    options: {
      probe: { type: "boolean", default: true },
      "no-probe": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    printHelp();
    return;
  }
  const cfg = resolveConfig();
  const report = await runDoctorCheck(cfg, { probe: values["no-probe"] ? false : values.probe });
  console.log(JSON.stringify(report, null, 2));
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }
  if (!(cmd in VALID_COMMANDS)) {
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exitCode = 2;
    return;
  }
  if (cmd === "doctor") {
    await runDoctor(rest);
    return;
  }
  if (cmd === "mcp") {
    if (rest.includes("--help") || rest.includes("-h")) {
      printHelp();
      return;
    }
    await startMcpServer();
    return;
  }
  if (cmd === "install-skill") {
    const { values } = parseArgs({
      args: rest,
      allowPositionals: false,
      options: {
        target: { type: "string", default: "agents" },
        help: { type: "boolean", short: "h", default: false },
      },
    });
    if (values.help) {
      printHelp();
      return;
    }
    const dest = installSkill({ target: values.target as SkillTarget });
    console.log(`Installed brandlinter skill to ${dest}`);
    return;
  }

  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        tlds: { type: "string", default: "com,dev,io,org" },
        registries: { type: "string", default: "npm,pypi" },
        niche: { type: "string", default: "" },
        provider: { type: "string", default: "auto" },
        apps: { type: "boolean", default: false },
        social: { type: "boolean", default: false },
        "top-k": { type: "string", default: "5" },
        format: { type: "string", default: "table" },
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 2;
    return;
  }

  const { values, positionals } = parsed;
  if (values.help) {
    printHelp();
    return;
  }

  if (positionals.length === 0) {
    console.error("Error: provide at least one candidate name.");
    process.exitCode = 2;
    return;
  }

  const fmt = values.json ? "json" : values.format.toLowerCase();
  if (!(fmt in VALID_FORMATS)) {
    console.error(`Invalid --format "${values.format}". Valid values: table, markdown, json`);
    process.exitCode = 2;
    return;
  }

  const provider = values.provider as SerpProviderId;
  const cfg = resolveConfig({
    overrides: provider !== "auto" ? { serpProvider: provider } : undefined,
  });
  const nicheKeywords = values.niche ? values.niche.split(/\s+/).filter(Boolean) : undefined;

  if (cmd === "check") {
    const results = await runAvailabilityCheck(positionals, cfg, {
      tlds: values.tlds.split(","),
      registries: parseRegistries(values.registries),
      includeApps: values.apps,
      includeSocial: values.social,
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
    const topK = Number(values["top-k"]);
    if (!Number.isInteger(topK) || topK < 1) {
      console.error(`Invalid --top-k "${values["top-k"]}". Must be an integer >= 1.`);
      process.exitCode = 2;
      return;
    }
    const results = await runFullLint(positionals, cfg, {
      tlds: values.tlds.split(","),
      registries: parseRegistries(values.registries),
      nicheKeywords,
      provider,
      topK,
      includeApps: values.apps,
      includeSocial: values.social,
    });
    console.log(fmt === "json" ? JSON.stringify(results, null, 2) : formatFullLintMarkdown(results));
    return;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
