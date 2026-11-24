import { withTimeout } from "../../core/concurrency.js";
import type { SerpItem, SerpProvider, SerpQueryResult } from "../types.js";

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function unwrapDuckDuckGoUrl(href: string): string {
  try {
    const parsed = new URL(href, "https://lite.duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    if (
      uddg &&
      (parsed.hostname === "lite.duckduckgo.com" ||
        parsed.hostname === "duckduckgo.com" ||
        parsed.hostname.endsWith(".duckduckgo.com")) &&
      (parsed.pathname === "/l/" || parsed.pathname === "/l")
    ) {
      return uddg;
    }
  } catch {
    // ignore malformed href
  }
  return href;
}

export function createDuckDuckGoProvider(timeoutMs = 15000): SerpProvider {
  return {
    id: "duckduckgo",
    async search(query: string, limit = 10): Promise<SerpQueryResult> {
      const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
      try {
        return await withTimeout(async (signal) => {
          const res = await fetch(url, {
            signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; brandlinter/0.1)",
              Accept: "text/html",
            },
          });
          if (!res.ok) {
            return { provider: "duckduckgo", query, results: [], confidence: "low", error: `HTTP ${res.status}` };
          }
          const html = await res.text();
          const results: SerpItem[] = [];
          const linkRe = /<a[^>]*class="[^"]*result-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
          let match: RegExpExecArray | null;
          while ((match = linkRe.exec(html)) !== null && results.length < limit) {
            const resolvedUrl = unwrapDuckDuckGoUrl(match[1]);
            const title = match[2].replace(/<[^>]+>/g, "").trim();
            results.push({
              rank: results.length + 1,
              title,
              url: resolvedUrl,
              domain: domainFromUrl(resolvedUrl),
              snippet: "",
            });
          }
          if (results.length === 0 && /anomaly|captcha|bot.*check|unusual traffic/i.test(html)) {
            return {
              provider: "duckduckgo",
              query,
              results: [],
              confidence: "low",
              error: "DuckDuckGo bot challenge detected",
            };
          }
          return { provider: "duckduckgo", query, results, confidence: "low" };
        }, timeoutMs);
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
