import type { BrandlinterConfig, SerpProviderId } from "./config.js";
import { Semaphore } from "./concurrency.js";
import { sanitizeCandidates, sanitizeTld } from "./sanitize.js";
import { scoreCandidate, type ScoredCandidate } from "./scorer.js";
import { checkDomain } from "../providers/domain/rdap.js";
import { checkGitHub } from "../providers/ecosystem/github.js";
import { checkNpm } from "../providers/ecosystem/npm.js";
import { checkPypi } from "../providers/ecosystem/pypi.js";
import { checkCrates } from "../providers/ecosystem/crates.js";
import { resolveSerpProviderChain, searchWithFailover, type FailoverState } from "../providers/serp/resolver.js";
import { checkAppStore, type AppStoreCheckResult } from "../providers/optional/appstores.js";
import { checkSocialHandles, type SocialCheckResult } from "../providers/optional/social.js";
import type {
  DomainCheckResult,
  GitHubCheckResult,
  RegistryCheckResult,
  SerpItem,
} from "../providers/types.js";

export type RegistryId = "npm" | "pypi" | "crates";

export interface AvailabilityResult {
  name: string;
  domains: DomainCheckResult[];
  github: GitHubCheckResult;
  registries: RegistryCheckResult[];
  /** Present only when `includeApps` was requested. */
  apps?: AppStoreCheckResult[];
  /** Present only when `includeSocial` was requested. */
  social?: SocialCheckResult[];
  preliminaryScore: number;
}

export interface SeoCheckResult {
  name: string;
  provider: string;
  confidence: "high" | "medium" | "low";
  exactResults: SerpItem[];
  nicheResults: SerpItem[];
  /** Set when the batch failed over from another provider (e.g. "openserp" -> "exa"). */
  fallbackFrom?: string;
  exactError?: string;
  nicheError?: string;
  error?: string;
}

export interface FullLintResult extends AvailabilityResult {
  seo?: SeoCheckResult;
  scored: ScoredCandidate;
}

export async function runAvailabilityCheck(
  rawCandidates: string[],
  cfg: BrandlinterConfig,
  options?: {
    tlds?: string[];
    registries?: RegistryId[];
    includeApps?: boolean;
    includeSocial?: boolean;
  }
): Promise<AvailabilityResult[]> {
  const candidates = sanitizeCandidates(rawCandidates);
  const tlds = (options?.tlds ?? ["com", "dev", "io", "org"]).map(sanitizeTld);
  const registries: RegistryId[] = options?.registries ?? ["npm", "pypi"];
  const sem = new Semaphore(5);

  return Promise.all(
    candidates.map((name) =>
      sem.run(async () => {
        const [domains, github, regResults, apps, social] = await Promise.all([
          Promise.all(tlds.map((tld) => checkDomain(name, tld, cfg.dohUrl))),
          checkGitHub(name, cfg.githubToken),
          Promise.all(
            registries.map((reg) => {
              if (reg === "npm") return checkNpm(name);
              if (reg === "pypi") return checkPypi(name);
              return checkCrates(name);
            })
          ),
          options?.includeApps
            ? Promise.all([checkAppStore(name, cfg.country)])
            : Promise.resolve(undefined),
          options?.includeSocial ? checkSocialHandles(name) : Promise.resolve(undefined),
        ]);
        const prelim = scoreCandidate({
          name,
          domains,
          github,
          registries: regResults,
          apps,
          social,
          serpResults: [],
        });
        const unknownCount =
          domains.filter((d) => d.status === "unknown").length +
          regResults.filter((r) => r.status === "unknown").length +
          (github.orgAvailable === "unknown" ? 1 : 0);
        return {
          name,
          domains,
          github,
          registries: regResults,
          ...(apps ? { apps } : {}),
          ...(social ? { social } : {}),
          preliminaryScore: Math.max(0, prelim.score - unknownCount * 5),
        };
      })
    )
  );
}

export async function runSeoCheck(
  rawCandidates: string[],
  cfg: BrandlinterConfig,
  options?: { nicheKeywords?: string[]; provider?: SerpProviderId; limit?: number }
): Promise<SeoCheckResult[]> {
  const candidates = sanitizeCandidates(rawCandidates);
  const chain = resolveSerpProviderChain(cfg, options?.provider);
  const primaryId = chain[0].id;
  const concurrency = primaryId === "openserp" || primaryId === "duckduckgo" ? 2 : 4;
  const sem = new Semaphore(concurrency);
  const limit = options?.limit ?? 8;
  const niche = options?.nicheKeywords?.filter(Boolean).join(" ").trim();
  const failover: FailoverState = { index: 0 };

  return Promise.all(
    candidates.map((name) =>
      sem.run(async () => {
        const exact = await searchWithFailover(chain, failover, `"${name}"`, limit);
        const nicheRes = niche
          ? await searchWithFailover(chain, failover, `"${name}" ${niche}`, Math.min(limit, 5))
          : undefined;
        return {
          name,
          provider: exact.providerId,
          confidence: exact.result.confidence,
          exactResults: exact.result.results,
          nicheResults: nicheRes?.result.results ?? [],
          fallbackFrom: exact.fallbackFrom ?? nicheRes?.fallbackFrom,
          exactError: exact.result.error,
          nicheError: nicheRes?.result.error,
          error: exact.result.error ?? nicheRes?.result.error,
        };
      })
    )
  );
}

export async function runFullLint(
  rawCandidates: string[],
  cfg: BrandlinterConfig,
  options?: {
    tlds?: string[];
    registries?: RegistryId[];
    nicheKeywords?: string[];
    provider?: SerpProviderId;
    topK?: number;
    includeApps?: boolean;
    includeSocial?: boolean;
  }
): Promise<FullLintResult[]> {
  const topK = options?.topK ?? 5;
  if (!Number.isInteger(topK) || topK < 1) {
    throw new Error(`Invalid topK "${topK}": must be an integer >= 1`);
  }

  const stage1 = await runAvailabilityCheck(rawCandidates, cfg, {
    tlds: options?.tlds,
    registries: options?.registries,
    includeApps: options?.includeApps,
    includeSocial: options?.includeSocial,
  });

  const shortlisted = [...stage1]
    .sort((a, b) => b.preliminaryScore - a.preliminaryScore)
    .slice(0, topK)
    .map((r) => r.name);

  const seoResults = await runSeoCheck(shortlisted, cfg, {
    nicheKeywords: options?.nicheKeywords,
    provider: options?.provider,
  });
  const seoMap = new Map(seoResults.map((s) => [s.name, s]));

  return stage1.map((item) => {
    const seo = seoMap.get(item.name);
    const scored = scoreCandidate({
      name: item.name,
      domains: item.domains,
      github: item.github,
      registries: item.registries,
      apps: item.apps,
      social: item.social,
      serpResults: seo?.exactResults ?? [],
      nicheResults: seo?.nicheResults ?? [],
      serpChecked: Boolean(seo),
      serpError: seo?.error,
    });
    return { ...item, seo, scored };
  });
}
