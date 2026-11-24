import { withTimeout } from "../../core/concurrency.js";
import type { SerpItem, SerpProvider, SerpQueryResult } from "../types.js";

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function createOpenSerpProvider(
  baseUrl: string,
  engines = "google",
  authHeader?: string,
  timeoutMs = 45000
): SerpProvider {
  return {
    id: "openserp",
    async search(query: string, limit = 10): Promise<SerpQueryResult> {
      const url = `${baseUrl}/mega/search?text=${encodeURIComponent(query)}&engines=${encodeURIComponent(engines)}&limit=${limit}`;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (authHeader) headers.Authorization = authHeader;

      try {
        const res = await withTimeout((signal) => fetch(url, { signal, headers }), timeoutMs);
        if (!res.ok) {
          return { provider: "openserp", query, results: [], confidence: "high", error: `HTTP ${res.status}` };
        }
        const data = (await res.json()) as {
          results?: Array<{ rank?: number; title?: string; url?: string; domain?: string; snippet?: string }>;
        };
        const results: SerpItem[] = (data.results ?? []).slice(0, limit).map((r, idx) => ({
          rank: r.rank ?? idx + 1,
          title: r.title ?? "",
          url: r.url ?? "",
          domain: r.domain || domainFromUrl(r.url ?? ""),
          snippet: r.snippet ?? "",
        }));
        return { provider: "openserp", query, results, confidence: "high" };
      } catch (err: unknown) {
        return {
          provider: "openserp",
          query,
          results: [],
          confidence: "high",
          error: err instanceof Error ? err.message : "OpenSERP error",
        };
      }
    },
  };
}
