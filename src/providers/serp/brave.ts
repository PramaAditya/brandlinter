import { withTimeout } from "../../core/concurrency.js";
import type { SerpItem, SerpProvider, SerpQueryResult } from "../types.js";

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function createBraveProvider(apiKey: string, timeoutMs = 15000): SerpProvider {
  return {
    id: "brave",
    async search(query: string, limit = 10): Promise<SerpQueryResult> {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`;
      try {
        const res = await withTimeout(
          (signal) =>
            fetch(url, {
              signal,
              headers: {
                Accept: "application/json",
                "X-Subscription-Token": apiKey,
              },
            }),
          timeoutMs
        );
        if (!res.ok) {
          return { provider: "brave", query, results: [], confidence: "high", error: `HTTP ${res.status}` };
        }
        const data = (await res.json()) as {
          web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
        };
        const results: SerpItem[] = (data.web?.results ?? []).slice(0, limit).map((r, idx) => ({
          rank: idx + 1,
          title: r.title ?? "",
          url: r.url ?? "",
          domain: domainFromUrl(r.url ?? ""),
          snippet: r.description ?? "",
        }));
        return { provider: "brave", query, results, confidence: "high" };
      } catch (err: unknown) {
        return {
          provider: "brave",
          query,
          results: [],
          confidence: "high",
          error: err instanceof Error ? err.message : "Brave error",
        };
      }
    },
  };
}
