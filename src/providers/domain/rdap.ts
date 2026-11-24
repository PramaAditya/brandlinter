import { withTimeout } from "../../core/concurrency.js";
import type { DomainCheckResult } from "../types.js";
import { checkDomainDoh } from "./doh.js";

const DIRECT_RDAP: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1/domain/",
  net: "https://rdap.verisign.com/net/v1/domain/",
  org: "https://rdap.publicinterestregistry.org/rdap/domain/",
};

export async function checkDomainRdap(
  slug: string,
  tld: string,
  timeoutMs = 10000
): Promise<DomainCheckResult> {
  const domain = `${slug}.${tld}`;
  const url = `https://${domain}`;
  const base = DIRECT_RDAP[tld] ?? "https://rdap.org/domain/";

  try {
    const res = await withTimeout(
      (signal) =>
        fetch(`${base}${encodeURIComponent(domain)}`, {
          signal,
          redirect: "follow",
          headers: { Accept: "application/rdap+json, application/json" },
        }),
      timeoutMs
    );

    if (res.status === 404) {
      return { tld, domain, url, status: "available", source: "rdap" };
    }
    if (res.ok) {
      return { tld, domain, url, status: "taken", source: "rdap" };
    }
    return {
      tld,
      domain,
      url,
      status: "unknown",
      source: "rdap",
      detail: `HTTP ${res.status}`,
    };
  } catch (err: unknown) {
    return {
      tld,
      domain,
      url,
      status: "unknown",
      source: "rdap",
      detail: err instanceof Error ? err.message : "RDAP error",
    };
  }
}

export async function checkDomain(
  slug: string,
  tld: string,
  dohUrl = "https://dns.google/resolve"
): Promise<DomainCheckResult> {
  const rdapRes = await checkDomainRdap(slug, tld);
  if (rdapRes.status !== "unknown") {
    return rdapRes;
  }
  const dohRes = await checkDomainDoh(slug, tld, dohUrl);
  if (dohRes.status !== "unknown") {
    return {
      ...dohRes,
      detail: `RDAP fallback (${rdapRes.detail ?? "unavailable"})`,
    };
  }
  return rdapRes;
}
