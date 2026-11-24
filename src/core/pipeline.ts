import type { BrandlinterConfig, SerpProviderId } from "./config.js";
import { Semaphore } from "./concurrency.js";
import { sanitizeCandidates, sanitizeTld } from "./sanitize.js";
import { scoreCandidate, type ScoredCandidate } from "./scorer.js";
import { checkDomain } from "../providers/domain/rdap.js";
import { checkGitHub } from "../providers/ecosystem/github.js";
import { checkNpm } from "../providers/ecosystem/npm.js";
import { checkPypi } from "../providers/ecosystem/pypi.js";
import { checkCrates } from "../providers/ecosystem/crates.js";
import { resolveSerpProvider } from "../providers/serp/resolver.js";
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
  preliminaryScore: number;
}

export interface SeoCheckResult {
  name: string;
  provider: string;
  confidence: "high" | "medium" | "low";
  exactResults: SerpItem[];
  nicheResults: SerpItem[];
  error?: string;
}

export interface FullLintResult extends AvailabilityResult {
  seo?: SeoCheckResult;
  scored: ScoredCandidate;
}

export async function runAvailabilityCheck(
  rawCandidates: string[],
  cfg: BrandlinterConfig,
  options?: { tlds?: string[]; registries?: RegistryId[] }
): Promise<AvailabilityResult[]> {
  const candidates = sanitizeCandidates(rawCandidates);
  const tlds = (options?.tlds ?? ["com", "dev", "io", "org"]).map(sanitizeTld);
  const registries: RegistryId[] = options?.registries ?? ["npm", "pypi"];
  const sem = new Semaphore(5);

  return Promise.all(
    candidates.map((name) =>
      sem.run(async () => {
        const [domains, github, regResults] = await Promise.all([
          Promise.all(tlds.map((tld) => checkDomain(name, tld, cfg.dohUrl))),
          checkGitHub(name, cfg.githubToken),
          Promise.all(
            registries.map((reg) => {
              if (reg === "npm") return checkNpm(name);
              if (reg === "pypi") return checkPypi(name);
              return checkCrates(name);
            })
          ),
        ]);
        const prelim = scoreCandidate({
          name,
          domains,
          github,
          registries: regResults,
          serpResults: [],
        });
        return {
          name,
          domains,
          github,
          registries: regResults,
          preliminaryScore: prelim.score,
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
  const provider = resolveSerpProvider(cfg, options?.provider);
  const concurrency = provider.id === "openserp" || provider.id === "duckduckgo" ? 2 : 4;
  const sem = new Semaphore(concurrency);
  const limit = options?.limit ?? 8;
  const niche = options?.nicheKeywords?.filter(Boolean).join(" ").trim();

  return Promise.all(
    candidates.map((name) =>
      sem.run(async () => {
        const exact = await provider.search(`"${name}"`, limit);
        const nicheRes = niche
          ? await provider.search(`"${name}" ${niche}`, Math.min(limit, 5))
          : { results: [] as SerpItem[], error: undefined };
        return {
          name,
          provider: provider.id,
          confidence: exact.confidence,
          exactResults: exact.results,
          nicheResults: nicheRes.results,
          error: exact.error ?? nicheRes.error,
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
  }
): Promise<FullLintResult[]> {
  const stage1 = await runAvailabilityCheck(rawCandidates, cfg, {
    tlds: options?.tlds,
    registries: options?.registries,
  });

  const topK = options?.topK ?? 5;
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
    const combinedSerp = [...(seo?.exactResults ?? []), ...(seo?.nicheResults ?? [])];
    const scored = scoreCandidate({
      name: item.name,
      domains: item.domains,
      github: item.github,
      registries: item.registries,
      serpResults: combinedSerp,
    });
    return { ...item, seo, scored };
  });
}
