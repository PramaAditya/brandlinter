import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveConfig } from "../src/core/config.js";
import { runSeoCheck } from "../src/core/pipeline.js";
import {
  isTransientSerpError,
  resolveSerpProviderChain,
  searchWithFailover,
} from "../src/providers/serp/resolver.js";
import type { SerpProvider, SerpQueryResult } from "../src/providers/types.js";

function fakeProvider(
  id: string,
  handler: (query: string, limit: number) => SerpQueryResult | Promise<SerpQueryResult>
): SerpProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    id,
    calls,
    async search(query: string, limit = 10) {
      calls.push(query);
      return handler(query, limit);
    },
  };
}

function result(
  provider: string,
  query: string,
  overrides: Partial<SerpQueryResult> = {}
): SerpQueryResult {
  return {
    provider,
    query,
    results: [],
    confidence: "high",
    ...overrides,
  };
}

describe("resolveSerpProviderChain", () => {
  it("orders every configured provider, with duckduckgo last", () => {
    const cfg = resolveConfig({
      env: {
        OPENSERP_URL: "https://openserp.example.com",
        EXA_API_KEY: "exa-key",
      },
      cwd: "C:/definitely/no/such/dir",
    });
    const chain = resolveSerpProviderChain(cfg).map((p) => p.id);
    expect(chain).toEqual(["openserp", "exa", "duckduckgo"]);
  });

  it("keeps an explicit provider override strictly single (no silent failover)", () => {
    const cfg = resolveConfig({
      env: {
        OPENSERP_URL: "https://openserp.example.com",
        EXA_API_KEY: "exa-key",
      },
      cwd: "C:/definitely/no/such/dir",
    });
    const chain = resolveSerpProviderChain(cfg, "exa").map((p) => p.id);
    expect(chain).toEqual(["exa"]);
  });

  it("throws when an explicit override is not configured", () => {
    const cfg = resolveConfig({ env: {}, cwd: "C:/definitely/no/such/dir" });
    expect(() => resolveSerpProviderChain(cfg, "serper")).toThrow(/SERPER_API_KEY/);
  });
});

describe("isTransientSerpError", () => {
  it("classifies 502/503/429/timeout/network resets as transient", () => {
    expect(isTransientSerpError("HTTP 502")).toBe(true);
    expect(isTransientSerpError("HTTP 503")).toBe(true);
    expect(isTransientSerpError("HTTP 429 Too Many Requests")).toBe(true);
    expect(isTransientSerpError("The operation was aborted")).toBe(true);
    expect(isTransientSerpError("fetch failed")).toBe(true);
    expect(isTransientSerpError("ECONNRESET")).toBe(true);
  });

  it("treats client errors and missing errors as non-transient", () => {
    expect(isTransientSerpError("HTTP 400")).toBe(false);
    expect(isTransientSerpError("HTTP 401")).toBe(false);
    expect(isTransientSerpError(undefined)).toBe(false);
  });
});

describe("searchWithFailover", () => {
  it("returns the primary result without retry when it succeeds", async () => {
    const primary = fakeProvider("openserp", (q) => result("openserp", q));
    const backup = fakeProvider("exa", (q) => result("exa", q));
    const state = { index: 0 };

    const out = await searchWithFailover([primary, backup], state, '"nya"', 8);

    expect(out.providerId).toBe("openserp");
    expect(out.fallbackFrom).toBeUndefined();
    expect(primary.calls).toHaveLength(1);
    expect(backup.calls).toHaveLength(0);
  });

  it("retries a transient failure once, then fails over and reports fallbackFrom", async () => {
    let attempts = 0;
    const primary = fakeProvider("openserp", (q) => {
      attempts++;
      return result("openserp", q, { error: "HTTP 502" });
    });
    const backup = fakeProvider("exa", (q) => result("exa", q, { confidence: "medium" }));
    const state = { index: 0 };

    const out = await searchWithFailover([primary, backup], state, '"nya"', 8, { retryDelayMs: 0 });

    expect(attempts).toBe(2);
    expect(out.providerId).toBe("exa");
    expect(out.fallbackFrom).toBe("openserp");
    expect(out.result.confidence).toBe("medium");
    expect(state.index).toBe(1);
  });

  it("skips the dead provider for later candidates in the same batch", async () => {
    const primary = fakeProvider("openserp", (q) => result("openserp", q, { error: "HTTP 502" }));
    const backup = fakeProvider("exa", (q) => result("exa", q));
    const state = { index: 0 };

    await searchWithFailover([primary, backup], state, '"first"', 8, { retryDelayMs: 0 });
    const second = await searchWithFailover([primary, backup], state, '"second"', 8, { retryDelayMs: 0 });

    expect(second.providerId).toBe("exa");
    expect(second.fallbackFrom).toBe("openserp");
    // 2 attempts for the first candidate only; the second never touches openserp again.
    expect(primary.calls).toEqual(['"first"', '"first"']);
    expect(backup.calls).toEqual(['"first"', '"second"']);
  });

  it("does not fail over when the provider legitimately returns zero results", async () => {
    const primary = fakeProvider("openserp", (q) => result("openserp", q, { results: [] }));
    const backup = fakeProvider("exa", (q) => result("exa", q));
    const state = { index: 0 };

    const out = await searchWithFailover([primary, backup], state, '"nya"', 8, { retryDelayMs: 0 });

    expect(out.providerId).toBe("openserp");
    expect(backup.calls).toHaveLength(0);
  });

  it("does not retry non-transient errors but still fails over", async () => {
    const primary = fakeProvider("openserp", (q) => result("openserp", q, { error: "HTTP 401" }));
    const backup = fakeProvider("exa", (q) => result("exa", q));
    const state = { index: 0 };

    const out = await searchWithFailover([primary, backup], state, '"nya"', 8, { retryDelayMs: 0 });

    expect(primary.calls).toHaveLength(1);
    expect(out.providerId).toBe("exa");
  });

  it("returns the last error when every provider in the chain fails", async () => {
    const first = fakeProvider("openserp", (q) => result("openserp", q, { error: "HTTP 502" }));
    const last = fakeProvider("exa", (q) => result("exa", q, { error: "HTTP 500" }));
    const state = { index: 0 };

    const out = await searchWithFailover([first, last], state, '"nya"', 8, { retryDelayMs: 0 });

    expect(out.providerId).toBe("exa");
    expect(out.result.error).toBe("HTTP 500");
  });
});

describe("runSeoCheck failover integration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("switches the whole batch to the backup provider after a 502 storm", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/mega/search")) {
        return new Response("bad gateway", { status: 502 });
      }
      if (url.includes("api.exa.ai")) {
        return new Response(
          JSON.stringify({
            results: [{ title: "Some page", url: "https://example.com/some", text: "snippet" }],
          }),
          { status: 200 }
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cfg = resolveConfig({
      env: {
        OPENSERP_URL: "https://openserp.example.com",
        EXA_API_KEY: "exa-key",
      },
      cwd: "C:/definitely/no/such/dir",
    });

    const out = await runSeoCheck(["sideslate", "tabspan"], cfg, { limit: 3 });

    expect(out).toHaveLength(2);
    for (const item of out) {
      expect(item.provider).toBe("exa");
      expect(item.fallbackFrom).toBe("openserp");
      expect(item.error).toBeUndefined();
      expect(item.exactResults).toHaveLength(1);
    }
  });
});
