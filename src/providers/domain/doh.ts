import { withTimeout } from "../../core/concurrency.js";
import type { DomainCheckResult } from "../types.js";

export async function checkDomainDoh(
  slug: string,
  tld: string,
  dohUrl = "https://dns.google/resolve",
  timeoutMs = 8000
): Promise<DomainCheckResult> {
  const domain = `${slug}.${tld}`;
  const url = `https://${domain}`;
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(`${dohUrl}?name=${encodeURIComponent(domain)}&type=NS`, {
          signal,
          headers: { Accept: "application/dns-json" },
        }),
      timeoutMs
    );
    if (!res.ok) {
      return { tld, domain, url, status: "unknown", source: "doh", detail: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { Status?: number; Answer?: unknown[]; Authority?: unknown[] };
    if (data.Status === 3) {
      return { tld, domain, url, status: "available", source: "doh" };
    }
    if (data.Status === 0 && (data.Answer?.length || data.Authority?.length)) {
      return { tld, domain, url, status: "taken", source: "doh" };
    }
    return {
      tld,
      domain,
      url,
      status: "unknown",
      source: "doh",
      detail: `DNS Status ${data.Status ?? "unknown"}`,
    };
  } catch (err: unknown) {
    return {
      tld,
      domain,
      url,
      status: "unknown",
      source: "doh",
      detail: err instanceof Error ? err.message : "DoH error",
    };
  }
}
