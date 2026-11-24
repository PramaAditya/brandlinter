import { withTimeout } from "../../core/concurrency.js";
import type { SerpItem, SerpProvider, SerpQueryResult } from "../types.js";

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function createDuckDuckGoProvider(timeoutMs = 15000): SerpProvider {
  return {
    id: "duckduckgo",
    async search(query: string, limit = 10): Promise<SerpQueryResult> {
      const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
      try {
        const res = await withTimeout(
          (signal) =>
            fetch(url, {
              signal,
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; brandlinter/0.1)",
                Accept: "text/html",
              },
            }),
          timeoutMs
        );
        if (!res.ok) {
          return { provider: "duckduckgo", query, results: [], confidence: "low", error: `HTTP ${res.status}` };
        }
        const html = await res.text();
        const results: SerpItem[] = [];
        const linkRe = /<a[^>]*class="[^"]*result-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match: RegExpExecArray | null;
        while ((match = linkRe.exec(html)) !== null && results.length < limit) {
          const href = match[1];
          const title = match[2].replace(/<[^>]+>/g, "").trim();
          results.push({
            rank: results.length + 1,
            title,
            url: href,
            domain: domainFromUrl(href),
            snippet: "",
          });
        }
        return { provider: "duckduckgo", query, results, confidence: "low" };
      } catch (err: unknown) {
        return {
          provider: "duckduckgo",
          query,
          results: [],
          confidence: "low",
          error: err instanceof Error ? err.message : "DuckDuckGo error",
        };
      }
    },
  };
}
