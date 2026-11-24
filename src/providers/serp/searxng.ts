import { withTimeout } from "../../core/concurrency.js";
import type { SerpItem, SerpProvider, SerpQueryResult } from "../types.js";

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function createSearxngProvider(
  baseUrl: string,
  engines = "google,duckduckgo",
  timeoutMs = 20000
): SerpProvider {
  return {
    id: "searxng",
    async search(query: string, limit = 10): Promise<SerpQueryResult> {
      const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&engines=${encodeURIComponent(engines)}`;
      try {
        const res = await withTimeout(
          (signal) => fetch(url, { signal, headers: { Accept: "application/json" } }),
          timeoutMs
        );
        if (!res.ok) {
          return { provider: "searxng", query, results: [], confidence: "high", error: `HTTP ${res.status}` };
        }
        const data = (await res.json()) as {
          results?: Array<{ title?: string; url?: string; content?: string }>;
        };
        const results: SerpItem[] = (data.results ?? []).slice(0, limit).map((r, idx) => ({
          rank: idx + 1,
          title: r.title ?? "",
          url: r.url ?? "",
          domain: domainFromUrl(r.url ?? ""),
          snippet: r.content ?? "",
        }));
        return { provider: "searxng", query, results, confidence: "high" };
      } catch (err: unknown) {
        return {
          provider: "searxng",
          query,
          results: [],
          confidence: "high",
          error: err instanceof Error ? err.message : "SearXNG error",
        };
      }
    },
  };
}
