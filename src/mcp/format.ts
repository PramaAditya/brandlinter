import type { AvailabilityResult, FullLintResult, SeoCheckResult } from "../core/pipeline.js";
import { analyzeSerpResults, summarizeSerpVerdict, type Verdict } from "../core/scorer.js";
import type { AppStoreCheckResult } from "../providers/optional/appstores.js";
import type { SocialCheckResult } from "../providers/optional/social.js";
import type { SerpItem } from "../providers/types.js";

const TOP_SERP_HITS = 5;
const TOP_NICHE_HITS = 3;
const TITLE_LIMIT = 90;

export interface CompactSerpHit {
  rank: number;
  domain: string;
  title: string;
}

export interface CompactSeoView {
  name: string;
  provider: string;
  fallbackFrom?: string;
  confidence: string;
  seoVerdict: Verdict;
  exactDomainInSerp: boolean;
  nearDomainMatches: string[];
  dictionaryTrap: boolean;
  top: CompactSerpHit[];
  nicheTop: CompactSerpHit[];
  error?: string;
}

export interface CompactAvailabilityView {
  name: string;
  preliminaryScore: number;
  domains: Record<string, string>;
  github: { org: string; exactRepos: number | null; topRepo?: string };
  registries: Record<string, string>;
  apps?: Array<{ store: string; status: string; nearMatches?: string[] }>;
  social?: { taken: string[]; available: string[]; unknown: string[] };
}

export interface CompactFullLintView extends CompactAvailabilityView {
  verdict: Verdict;
  score: number;
  penalties: string[];
  seo?: CompactSeoView;
}

function clipTitle(title: string): string {
  return title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT - 1)}…` : title;
}

function toHits(items: SerpItem[], limit: number): CompactSerpHit[] {
  return items.slice(0, limit).map((item) => ({
    rank: item.rank,
    domain: item.domain,
    title: clipTitle(item.title),
  }));
}

function toAppViews(apps?: AppStoreCheckResult[]): CompactAvailabilityView["apps"] {
  if (!apps) return undefined;
  return apps.map((app) => ({
    store: app.store,
    status: app.status,
    ...(app.nearMatches?.length ? { nearMatches: app.nearMatches } : {}),
  }));
}

function toSocialView(social?: SocialCheckResult[]): CompactAvailabilityView["social"] {
  if (!social) return undefined;
  const view = { taken: [] as string[], available: [] as string[], unknown: [] as string[] };
  for (const item of social) {
    const bucket = item.status === "taken" ? view.taken : item.status === "available" ? view.available : view.unknown;
    bucket.push(item.platform);
  }
  return view;
}

/** Strip raw SERP payloads down to the signals an agent actually reasons about. */
export function toCompactSeo(item: SeoCheckResult): CompactSeoView {
  const signals = analyzeSerpResults(item.name, item.exactResults, item.nicheResults);
  const error = item.error;
  return {
    name: item.name,
    provider: item.provider,
    ...(item.fallbackFrom ? { fallbackFrom: item.fallbackFrom } : {}),
    confidence: item.confidence,
    seoVerdict: summarizeSerpVerdict(signals, error),
    exactDomainInSerp: signals.exactDomainInSerp,
    nearDomainMatches: signals.nearDomainMatches,
    dictionaryTrap: signals.dictionaryTrap,
    top: toHits(item.exactResults, TOP_SERP_HITS),
    nicheTop: toHits(item.nicheResults, TOP_NICHE_HITS),
    ...(error ? { error } : {}),
  };
}

export function toCompactAvailability(item: AvailabilityResult): CompactAvailabilityView {
  const domains: Record<string, string> = {};
  for (const domain of item.domains) domains[domain.tld] = domain.status;

  const registries: Record<string, string> = {};
  for (const reg of item.registries) registries[reg.registry] = reg.status;

  const topRepo = item.github.topRepo;
  const apps = toAppViews(item.apps);
  const social = toSocialView(item.social);

  return {
    name: item.name,
    preliminaryScore: item.preliminaryScore,
    domains,
    github: {
      org: item.github.orgAvailable,
      exactRepos: item.github.exactRepoCount,
      ...(topRepo ? { topRepo: `${topRepo.fullName} (${topRepo.stars}★)` } : {}),
    },
    registries,
    ...(apps ? { apps } : {}),
    ...(social ? { social } : {}),
  };
}

export function toCompactFullLint(item: FullLintResult): CompactFullLintView {
  return {
    ...toCompactAvailability(item),
    verdict: item.scored.verdict,
    score: item.scored.score,
    penalties: item.scored.penalties.map((p) => `${p.reason} (-${p.penalty})`),
    ...(item.seo ? { seo: toCompactSeo(item.seo) } : {}),
  };
}
