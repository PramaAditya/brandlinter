import { withTimeout } from "../../core/concurrency.js";
import type { SerpItem, SerpProvider, SerpQueryResult } from "../types.js";

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function createGoogleCseProvider(
  apiKey: string,
  cx: string,
  timeoutMs = 15000
): SerpProvider {
  return {
    id: "google-cse",
    async search(query: string, limit = 10): Promise<SerpQueryResult> {
      const num = Math.min(limit, 10);
      const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=${num}`;
      try {
        return await withTimeout(async (signal) => {
          const res = await fetch(url, { signal });
          if (!res.ok) {
            return { provider: "google-cse", query, results: [], confidence: "high", error: `HTTP ${res.status}` };
          }
          const data = (await res.json()) as {
            items?: Array<{ title?: string; link?: string; snippet?: string }>;
          };
          const results: SerpItem[] = (data.items ?? []).slice(0, limit).map((r, idx) => ({
            rank: idx + 1,
            title: r.title ?? "",
            url: r.link ?? "",
            domain: domainFromUrl(r.link ?? ""),
            snippet: r.snippet ?? "",
          }));
          return { provider: "google-cse", query, results, confidence: "high" };
        }, timeoutMs);
      } catch (err: unknown) {
        return {
          provider: "google-cse",
          query,
          results: [],
          confidence: "high",
          error: err instanceof Error ? err.message : "Google CSE error",
        };
      }
    },
  };
}
