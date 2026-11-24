import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveConfig } from "../src/core/config.js";
import { resolveSerpProvider } from "../src/providers/serp/resolver.js";
import { createOpenSerpProvider } from "../src/providers/serp/openserp.js";
import { createSearxngProvider } from "../src/providers/serp/searxng.js";
import { createSerperProvider } from "../src/providers/serp/serper.js";
import { createBraveProvider } from "../src/providers/serp/brave.js";
import { createGoogleCseProvider } from "../src/providers/serp/google-cse.js";
import { createExaProvider } from "../src/providers/serp/exa.js";
import { createDuckDuckGoProvider } from "../src/providers/serp/duckduckgo.js";

describe("resolveSerpProvider", () => {
  it("auto-selects openserp first when OPENSERP_URL is set", () => {
    const cfg = resolveConfig({
      env: { OPENSERP_URL: "https://openserp.example.com", SERPER_API_KEY: "k" },
      cwd: "/nonexistent",
    });
    expect(resolveSerpProvider(cfg).id).toBe("openserp");
  });

  it("falls back to duckduckgo when nothing is configured", () => {
    const cfg = resolveConfig({ env: {}, cwd: "/nonexistent" });
    expect(resolveSerpProvider(cfg).id).toBe("duckduckgo");
  });

  it("respects explicit provider override", () => {
    const cfg = resolveConfig({
      env: { OPENSERP_URL: "https://openserp.example.com", SERPER_API_KEY: "k" },
      cwd: "/nonexistent",
    });
    expect(resolveSerpProvider(cfg, "serper").id).toBe("serper");
  });

  it("throws on unknown provider instead of falling back to duckduckgo", () => {
    const cfg = resolveConfig({ env: {}, cwd: "/nonexistent" });
    expect(() => resolveSerpProvider(cfg, "bogus" as never)).toThrow(
      'Unknown SERP provider: "bogus"'
    );
  });
});

describe("SERP provider adapters", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("openserp parses /mega/search results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                rank: 1,
                title: "AnyDisplay App",
                url: "https://anydisplay.app/",
                domain: "anydisplay.app",
                snippet: "Mirror your screen",
              },
            ],
          }),
          { status: 200 }
        )
      )
    );
    const p = createOpenSerpProvider("https://openserp.example.com", "google");
    const res = await p.search('"anydisplay"', 5);
    expect(res.provider).toBe("openserp");
    expect(res.confidence).toBe("high");
    expect(res.results[0].domain).toBe("anydisplay.app");
  });

  it("searxng parses /search?format=json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [{ title: "Test", url: "https://example.com/a", content: "Snippet" }],
          }),
          { status: 200 }
        )
      )
    );
    const p = createSearxngProvider("https://searx.example.com", "google");
    const res = await p.search("test", 5);
    expect(res.results[0].domain).toBe("example.com");
  });

  it("serper parses organic results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            organic: [{ position: 1, title: "Serper", link: "https://serper.dev/", snippet: "API" }],
          }),
          { status: 200 }
        )
      )
    );
    const p = createSerperProvider("key");
    const res = await p.search("serper", 5);
    expect(res.results[0].domain).toBe("serper.dev");
  });

  it("brave parses web.results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            web: { results: [{ title: "Brave", url: "https://brave.com/", description: "Search" }] },
          }),
          { status: 200 }
        )
      )
    );
    const p = createBraveProvider("key");
    const res = await p.search("brave", 5);
    expect(res.results[0].domain).toBe("brave.com");
  });

  it("google-cse parses items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [{ title: "CSE", link: "https://cse.google.com/a", snippet: "Custom" }],
          }),
          { status: 200 }
        )
      )
    );
    const p = createGoogleCseProvider("key", "cx");
    const res = await p.search("cse", 5);
    expect(res.results[0].domain).toBe("cse.google.com");
  });

  it("exa parses results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [{ title: "Exa", url: "https://exa.ai/", text: "Neural search" }],
          }),
          { status: 200 }
        )
      )
    );
    const p = createExaProvider("key");
    const res = await p.search("exa", 5);
    expect(res.results[0].domain).toBe("exa.ai");
  });

  it("duckduckgo parses HTML lite and marks confidence low", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `<a class="result-link" href="https://example.org/test">Example Test</a>`,
          { status: 200 }
        )
      )
    );
    const p = createDuckDuckGoProvider();
    const res = await p.search("test", 5);
    expect(res.confidence).toBe("low");
    expect(res.results[0].domain).toBe("example.org");
  });

  it("duckduckgo unwraps /l/?uddg= redirect hrefs before extracting domain", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `<a class="result-link" href="/l/?uddg=https%3A%2F%2Fanydisplay.app">AnyDisplay</a>` +
            `<a class="result-link" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs&rut=abc">Docs</a>`,
          { status: 200 }
        )
      )
    );
    const p = createDuckDuckGoProvider();
    const res = await p.search("anydisplay", 5);
    expect(res.results).toHaveLength(2);
    expect(res.results[0].url).toBe("https://anydisplay.app");
    expect(res.results[0].domain).toBe("anydisplay.app");
    expect(res.results[1].url).toBe("https://example.com/docs");
    expect(res.results[1].domain).toBe("example.com");
  });

  it("duckduckgo detects bot-challenge HTML when no results are parsed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `<html><body><div>Unfortunately, bots use DuckDuckGo too. Anomaly detected: please solve captcha.</div></body></html>`,
          { status: 200 }
        )
      )
    );
    const p = createDuckDuckGoProvider();
    const res = await p.search("anydisplay", 5);
    expect(res.results).toEqual([]);
    expect(res.error).toBe("DuckDuckGo bot challenge detected");
  });

  it("aborts stalled res.json() inside withTimeout for SERP providers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        const deferred = Promise.withResolvers<unknown>();
        init?.signal?.addEventListener("abort", () => {
          deferred.reject(new DOMException("The operation was aborted", "AbortError"));
        });
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => deferred.promise,
        } as unknown as Response);
      })
    );
    const p = createOpenSerpProvider("https://openserp.example.com", "google", undefined, 50);
    const promise = p.search("test", 5);
    await vi.advanceTimersByTimeAsync(60);
    const res = await promise;
    expect(res.results).toEqual([]);
    expect(res.error).toContain("aborted");
  });
});
