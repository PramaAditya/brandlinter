import { withTimeout } from "../../core/concurrency.js";
import type { SerpItem, SerpProvider, SerpQueryResult } from "../types.js";

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function createSerperProvider(apiKey: string, timeoutMs = 15000): SerpProvider {
  return {
    id: "serper",
    async search(query: string, limit = 10): Promise<SerpQueryResult> {
      try {
        return await withTimeout(async (signal) => {
          const res = await fetch("https://google.serper.dev/search", {
            method: "POST",
            signal,
            headers: {
              "X-API-KEY": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: query, num: limit }),
          });
          if (!res.ok) {
            return { provider: "serper", query, results: [], confidence: "high", error: `HTTP ${res.status}` };
          }
          const data = (await res.json()) as {
            organic?: Array<{ position?: number; title?: string; link?: string; snippet?: string }>;
          };
          const results: SerpItem[] = (data.organic ?? []).slice(0, limit).map((r, idx) => ({
            rank: r.position ?? idx + 1,
            title: r.title ?? "",
            url: r.link ?? "",
            domain: domainFromUrl(r.link ?? ""),
            snippet: r.snippet ?? "",
          }));
          return { provider: "serper", query, results, confidence: "high" };
        }, timeoutMs);
      } catch (err: unknown) {
        return {
          provider: "serper",
          query,
          results: [],
          confidence: "high",
          error: err instanceof Error ? err.message : "Serper error",
        };
      }
    },
  };
}
