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

export const LintAvailabilityInputSchema = z.object({
  candidates: z.array(z.string()).min(1).max(30),
  tlds: z.array(z.string()).optional(),
  registries: z.array(z.enum(["npm", "pypi", "crates"])).optional(),
});

export const LintSeoInputSchema = z.object({
  candidates: z.array(z.string()).min(1).max(10),
  nicheKeywords: z.array(z.string()).optional(),
  provider: z
    .enum(["auto", "openserp", "searxng", "serper", "brave", "google-cse", "exa", "duckduckgo"])
    .optional(),
});

export const LintNamesInputSchema = z.object({
  candidates: z.array(z.string()).min(1).max(30),
  nicheKeywords: z.array(z.string()).optional(),
  topK: z.number().int().min(1).max(10).optional(),
  tlds: z.array(z.string()).optional(),
  registries: z.array(z.enum(["npm", "pypi", "crates"])).optional(),
  provider: z
    .enum(["auto", "openserp", "searxng", "serper", "brave", "google-cse", "exa", "duckduckgo"])
    .optional(),
});

export function createBrandlinterMcpServer(): McpServer {
  const server = new McpServer({ name: "brandlinter", version: "0.1.0" });

  server.tool(
    "lint_availability",
    "Stage 1 fast batch screen (up to 30 candidates) across domains (DoH/RDAP), GitHub org/repos, and package registries (npm, PyPI, crates.io).",
    LintAvailabilityInputSchema.shape,
    async ({ candidates, tlds, registries }) => {
      const cfg = resolveConfig();
      const results = await runAvailabilityCheck(candidates, cfg, {
        tlds,
        registries: registries as RegistryId[] | undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "lint_seo",
    "Stage 2 SERP collision check (up to 10 candidates) using the configured SERP provider (OpenSERP, SearXNG, Serper, Brave, Google CSE, Exa, or DuckDuckGo fallback).",
    LintSeoInputSchema.shape,
    async ({ candidates, nicheKeywords, provider }) => {
      const cfg = resolveConfig();
      const results = await runSeoCheck(candidates, cfg, {
        nicheKeywords,
        provider: provider as SerpProviderId | undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "lint_names",
    "Combined 2-stage funnel: screens all candidates in Stage 1, promotes top K cleanest names to Stage 2 SERP check, and returns collision scores and verdicts.",
    LintNamesInputSchema.shape,
    async ({ candidates, nicheKeywords, topK, tlds, registries, provider }) => {
      const cfg = resolveConfig();
      const results = await runFullLint(candidates, cfg, {
        nicheKeywords,
        topK,
        tlds,
        registries: registries as RegistryId[] | undefined,
        provider: provider as SerpProviderId | undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
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
