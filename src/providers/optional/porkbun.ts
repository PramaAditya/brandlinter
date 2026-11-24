import { withTimeout } from "../../core/concurrency.js";
import type { DomainCheckResult } from "../types.js";

export async function checkPorkbunDomain(
  slug: string,
  tld: string,
  apiKey: string,
  secretKey: string,
  timeoutMs = 10000
): Promise<DomainCheckResult> {
  const domain = `${slug}.${tld}`;
  const url = `https://${domain}`;
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(`https://api.porkbun.com/api/json/v3/domain/checkDomain/${encodeURIComponent(domain)}`, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apikey: apiKey, secretapikey: secretKey }),
        }),
      timeoutMs
    );
    if (!res.ok) {
      return { tld, domain, url, status: "unknown", source: "porkbun", detail: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      status?: string;
      response?: { avail?: string; price?: string };
    };
    const avail = data.response?.avail?.toLowerCase();
    if (avail === "yes") {
      return {
        tld,
        domain,
        url,
        status: "available",
        source: "porkbun",
        detail: data.response?.price ? `$${data.response.price}` : undefined,
      };
    }
    if (avail === "no") {
      return { tld, domain, url, status: "taken", source: "porkbun" };
    }
    return { tld, domain, url, status: "unknown", source: "porkbun" };
  } catch (err: unknown) {
    return {
      tld,
      domain,
      url,
      status: "unknown",
      source: "porkbun",
      detail: err instanceof Error ? err.message : "Porkbun error",
    };
  }
}
