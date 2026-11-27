import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveConfig, runDoctorCheck, type SerpProviderId } from "../core/config.js";
import {
  runAvailabilityCheck,
  runFullLint,
  runSeoCheck,
  type RegistryId,
} from "../core/pipeline.js";
import { toCompactAvailability, toCompactFullLint, toCompactSeo } from "./format.js";

const serpProviderSchema = z
  .enum(["auto", "openserp", "searxng", "serper", "brave", "google-cse", "exa", "duckduckgo"])
  .optional();

const verboseSchema = z
  .boolean()
  .optional()
  .describe("Return the full raw provider payloads instead of the compact signal summary (default: false)");

export const LintAvailabilityInputSchema = z.object({
  candidates: z.array(z.string()).min(1).max(30),
  tlds: z.array(z.string()).optional(),
  registries: z.array(z.enum(["npm", "pypi", "crates"])).optional(),
  includeApps: z.boolean().optional().describe("Also check the Apple App Store for exact and near/phonetic name collisions"),
  includeSocial: z.boolean().optional().describe("Also check X, YouTube, Reddit, Bluesky, and LinkedIn handles"),
  verbose: verboseSchema,
});

export const LintSeoInputSchema = z.object({
  candidates: z.array(z.string()).min(1).max(10),
  nicheKeywords: z.array(z.string()).optional(),
  provider: serpProviderSchema,
  verbose: verboseSchema,
});

export const LintNamesInputSchema = z.object({
  candidates: z.array(z.string()).min(1).max(30),
  nicheKeywords: z.array(z.string()).optional(),
  topK: z.number().int().min(1).max(10).optional(),
  tlds: z.array(z.string()).optional(),
  registries: z.array(z.enum(["npm", "pypi", "crates"])).optional(),
  includeApps: z.boolean().optional().describe("Also check the Apple App Store for exact and near/phonetic name collisions"),
  includeSocial: z.boolean().optional().describe("Also check X, YouTube, Reddit, Bluesky, and LinkedIn handles"),
  provider: serpProviderSchema,
  verbose: verboseSchema,
});

export function createBrandlinterMcpServer(): McpServer {
  const server = new McpServer({ name: "brandlinter", version: "0.3.1" });

  server.tool(
    "lint_availability",
    "Stage 1 fast batch screen (up to 30 candidates) across domains (DoH/RDAP), GitHub org/repos, package registries (npm, PyPI, crates.io), and optionally the App Store/social handles. Compact results by default; pass verbose:true for raw payloads.",
    LintAvailabilityInputSchema.shape,
    async ({ candidates, tlds, registries, includeApps, includeSocial, verbose }) => {
      const cfg = resolveConfig();
      const results = await runAvailabilityCheck(candidates, cfg, {
        tlds,
        registries: registries as RegistryId[] | undefined,
        includeApps,
        includeSocial,
      });
      const payload = verbose ? results : results.map(toCompactAvailability);
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }
  );

  server.tool(
    "lint_seo",
    "Stage 2 SERP collision check (up to 10 candidates) with a built-in seoVerdict, near-domain detection, and automatic provider failover (OpenSERP, SearXNG, Serper, Brave, Google CSE, Exa, DuckDuckGo). Send finalists in ONE batch call.",
    LintSeoInputSchema.shape,
    async ({ candidates, nicheKeywords, provider, verbose }) => {
      const cfg = resolveConfig();
      const results = await runSeoCheck(candidates, cfg, {
        nicheKeywords,
        provider: provider as SerpProviderId | undefined,
      });
      const payload = verbose ? results : results.map(toCompactSeo);
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }
  );

  server.tool(
    "lint_names",
    "Combined 2-stage funnel: screens all candidates in Stage 1, promotes top K cleanest names to Stage 2 SERP check, and returns collision scores and verdicts. Compact results by default; pass verbose:true for raw payloads.",
    LintNamesInputSchema.shape,
    async ({
      candidates,
      nicheKeywords,
      topK,
      tlds,
      registries,
      includeApps,
      includeSocial,
      provider,
      verbose,
    }) => {
      const cfg = resolveConfig();
      const results = await runFullLint(candidates, cfg, {
        nicheKeywords,
        topK,
        tlds,
        registries: registries as RegistryId[] | undefined,
        includeApps,
        includeSocial,
        provider: provider as SerpProviderId | undefined,
      });
      const payload = verbose ? results : results.map(toCompactFullLint);
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }
  );

  server.tool(
    "doctor",
    "Inspect configured SERP/domain/GitHub providers, config warnings, and optionally probe self-hosted endpoints (secrets redacted).",
    { probe: z.boolean().optional().describe("Probe configured self-hosted endpoints (default: true)") },
    async ({ probe }) => {
      const cfg = resolveConfig();
      const report = await runDoctorCheck(cfg, { probe: probe ?? true });
      return {
        content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
      };
    }
  );
  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createBrandlinterMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("brandlinter MCP server running on stdio");
}
