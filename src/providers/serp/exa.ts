import { withTimeout } from "../../core/concurrency.js";
import type { SerpItem, SerpProvider, SerpQueryResult } from "../types.js";

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function createExaProvider(apiKey: string, timeoutMs = 15000): SerpProvider {
  return {
    id: "exa",
    async search(query: string, limit = 10): Promise<SerpQueryResult> {
      try {
        return await withTimeout(async (signal) => {
          const res = await fetch("https://api.exa.ai/search", {
            method: "POST",
            signal,
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
            },
            // Keyword mode, not neural: name-collision checks need pages that literally contain the
            // candidate token, and Exa's "auto"/neural mode happily returns semantic neighbours
            // (e.g. querying `"tabspan"` surfaced Stack Overflow answers about tab widths).
            body: JSON.stringify({ query, numResults: limit, type: "keyword" }),
          });
          if (!res.ok) {
            return { provider: "exa", query, results: [], confidence: "medium", error: `HTTP ${res.status}` };
          }
          const data = (await res.json()) as {
            results?: Array<{ title?: string; url?: string; text?: string }>;
          };
          const results: SerpItem[] = (data.results ?? []).slice(0, limit).map((r, idx) => ({
            rank: idx + 1,
            title: r.title ?? "",
            url: r.url ?? "",
            domain: domainFromUrl(r.url ?? ""),
            snippet: (r.text ?? "").slice(0, 200),
          }));
          return { provider: "exa", query, results, confidence: "medium" };
        }, timeoutMs);
      } catch (err: unknown) {
        return {
          provider: "exa",
          query,
          results: [],
          confidence: "medium",
          error: err instanceof Error ? err.message : "Exa error",
        };
      }
    },
  };
}
