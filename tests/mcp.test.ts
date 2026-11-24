import { describe, it, expect } from "vitest";
import {
  createBrandlinterMcpServer,
  LintAvailabilityInputSchema,
  LintSeoInputSchema,
} from "../src/mcp/server.js";

describe("MCP server & schemas", () => {
  it("creates McpServer instance cleanly", () => {
    const server = createBrandlinterMcpServer();
    expect(server).toBeDefined();
  });

  it("enforces batch limits on lint_availability (max 30) and lint_seo (max 10)", () => {
    const over30 = Array.from({ length: 31 }, (_, i) => `name${i}`);
    expect(() => LintAvailabilityInputSchema.parse({ candidates: over30 })).toThrow();

    const over10 = Array.from({ length: 11 }, (_, i) => `name${i}`);
    expect(() => LintSeoInputSchema.parse({ candidates: over10 })).toThrow();
  });
});
