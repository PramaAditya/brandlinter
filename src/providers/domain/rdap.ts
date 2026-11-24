import { withTimeout } from "../../core/concurrency.js";
import type { DomainCheckResult } from "../types.js";
import { checkDomainDoh } from "./doh.js";

const DIRECT_RDAP: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1/domain/",
  net: "https://rdap.verisign.com/net/v1/domain/",
  org: "https://rdap.publicinterestregistry.org/rdap/domain/",
  // Google Registry serves .dev/.app directly with authoritative 404s; routing them through
  // rdap.org added a redirect and returned HTTP 403 in practice.
  dev: "https://pubapi.registry.google/rdap/domain/",
  app: "https://pubapi.registry.google/rdap/domain/",
};

const RDAP_HEADERS = {
  Accept: "application/rdap+json, application/json",
  "User-Agent": "brandlinter/0.2 (+https://github.com/PramaAditya/brandlinter)",
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
          headers: RDAP_HEADERS,
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
  if (rdapRes.status === "taken") {
    return rdapRes;
  }
  if (rdapRes.status === "available") {
    if (Object.hasOwn(DIRECT_RDAP, tld)) {
      return rdapRes;
    }
    const dohRes = await checkDomainDoh(slug, tld, dohUrl);
    if (dohRes.status === "taken") {
      return dohRes;
    }
    return rdapRes;
  }
  const dohRes = await checkDomainDoh(slug, tld, dohUrl);
  if (dohRes.status !== "unknown") {
    return {
      ...dohRes,
      detail: `RDAP fallback (${rdapRes.detail ?? "unavailable"})`,
    };
  }
  const combinedDetail =
    [rdapRes.detail ? `RDAP: ${rdapRes.detail}` : null, dohRes.detail ? `DoH: ${dohRes.detail}` : null]
      .filter(Boolean)
      .join("; ") || undefined;
  return {
    ...rdapRes,
    detail: combinedDetail,
  };
}
