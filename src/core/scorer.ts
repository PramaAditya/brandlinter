import type {
  AvailabilityStatus,
  DomainCheckResult,
  GitHubCheckResult,
  RegistryCheckResult,
  SerpItem,
} from "../providers/types.js";

export type Verdict = "CLEAN" | "CAUTION" | "CONFLICT" | "UNVERIFIED";

export interface ScoreBreakdownItem {
  reason: string;
  penalty: number;
}

export interface ScoredCandidate {
  name: string;
  score: number;
  verdict: Verdict;
  exactDomainInSerp: boolean;
  dictionaryTrap: boolean;
  /** Registrar-evil-twin neighbours on page 1 (`localscreenshare.com` for `localscreen`). */
  nearDomainMatches: string[];
  /** App Store titles within one edit or sharing the prefix (`TapSpan` for `Tabspan`). */
  appStoreNearMatches: string[];
  penalties: ScoreBreakdownItem[];
}

export interface SerpSignals {
  exactDomainInSerp: boolean;
  nicheCompetitorOverlap: boolean;
  dictionaryTrap: boolean;
  nearDomainMatches: string[];
}

/** Shorter candidates produce too many innocent prefix/suffix hits to be worth flagging. */
const NEAR_MATCH_MIN_SLUG_LENGTH = 5;

const DICTIONARY_DOMAINS = [
  "wikipedia.org",
  "wiktionary.org",
  "merriam-webster.com",
  "dictionary.com",
  "oxfordlearnersdictionaries.com",
  "cambridge.org",
];

function normalizeHost(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "");
}

/** Second-level label: `docs.sideglass.dev` -> `sideglass`. */
function secondLevelLabel(domain: string): string {
  return normalizeHost(domain).split(".")[0];
}

/** Inspect SERP answers once; both scoring and the compact MCP view read the same signals. */
export function analyzeSerpResults(
  name: string,
  serpResults: SerpItem[] = [],
  nicheResults: SerpItem[] = []
): SerpSignals {
  const slug = name.toLowerCase();
  const page1 = serpResults.slice(0, 10);

  const exactDomainInSerp = page1.some((item) => secondLevelLabel(item.domain) === slug);
  const nicheCompetitorOverlap = nicheResults
    .slice(0, 10)
    .some((item) => secondLevelLabel(item.domain) === slug);
  const dictionaryTrap = serpResults.slice(0, 3).some((item) => {
    const host = item.domain.toLowerCase();
    return DICTIONARY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  });

  const nearDomainMatches: string[] = [];
  if (slug.length >= NEAR_MATCH_MIN_SLUG_LENGTH) {
    for (const item of page1) {
      const label = secondLevelLabel(item.domain);
      if (label === slug) continue;
      if (label.startsWith(slug) || label.endsWith(slug)) {
        const host = normalizeHost(item.domain);
        if (!nearDomainMatches.includes(host)) nearDomainMatches.push(host);
      }
    }
  }

  return { exactDomainInSerp, nicheCompetitorOverlap, dictionaryTrap, nearDomainMatches };
}

/** SERP-only verdict, for `lint_seo` where Stage 1 data is not in scope. */
export function summarizeSerpVerdict(signals: SerpSignals, serpError?: string): Verdict {
  if (serpError) return "UNVERIFIED";
  if (signals.exactDomainInSerp || signals.nicheCompetitorOverlap) return "CONFLICT";
  if (signals.dictionaryTrap || signals.nearDomainMatches.length > 0) return "CAUTION";
  return "CLEAN";
}

export function scoreCandidate(input: {
  name: string;
  domains: DomainCheckResult[];
  github: GitHubCheckResult;
  registries: RegistryCheckResult[];
  serpResults?: SerpItem[];
  nicheResults?: SerpItem[];
  serpChecked?: boolean;
  serpError?: string;
  apps?: Array<{ status: AvailabilityStatus; nearMatches?: string[] }>;
  social?: Array<{ platform: string; status: AvailabilityStatus }>;
}): ScoredCandidate {
  const slug = input.name.toLowerCase();
  const penalties: ScoreBreakdownItem[] = [];
  let fatal = false;

  const signals = analyzeSerpResults(input.name, input.serpResults, input.nicheResults);

  if (signals.exactDomainInSerp) {
    penalties.push({ reason: "Exact domain match in SERP Top 10", penalty: 50 });
    fatal = true;
  }
  if (signals.nicheCompetitorOverlap) {
    penalties.push({ reason: "Niche competitor overlap", penalty: 30 });
    fatal = true;
  }
  if (signals.dictionaryTrap) {
    penalties.push({ reason: "Dictionary/encyclopedia trap in SERP Top 3", penalty: 30 });
  }
  if (signals.nearDomainMatches.length > 0) {
    penalties.push({
      reason: `Near-miss domain on page 1 (${signals.nearDomainMatches.slice(0, 3).join(", ")})`,
      penalty: 15,
    });
  }

  const topRepoFullName = input.github.topRepo?.fullName.toLowerCase();
  const [repoOwner, repoName] = topRepoFullName ? topRepoFullName.split("/") : ["", ""];
  const isExactGithubRepo = repoOwner === slug || repoName === slug;
  const stars = isExactGithubRepo ? (input.github.topRepo?.stars ?? 0) : 0;
  if (stars >= 100) {
    penalties.push({ reason: `Popular GitHub repo (${stars} stars)`, penalty: 35 });
    fatal = true;
  } else if (stars >= 10) {
    penalties.push({ reason: `Existing GitHub repo (${stars} stars)`, penalty: 15 });
  }

  if (input.github.orgAvailable === "taken") {
    penalties.push({ reason: "GitHub org/user handle taken", penalty: 15 });
  }

  for (const reg of input.registries) {
    if (reg.status === "taken") {
      penalties.push({ reason: `${reg.registry} package name taken`, penalty: 25 });
      fatal = true;
    }
  }

  for (const app of input.apps ?? []) {
    if (app.status === "taken") {
      penalties.push({ reason: "Existing App Store app with the same name", penalty: 25 });
    }
  }

  const appStoreNearMatches: string[] = [];
  for (const app of input.apps ?? []) {
    for (const near of app.nearMatches ?? []) {
      if (!appStoreNearMatches.includes(near)) appStoreNearMatches.push(near);
    }
  }
  if (appStoreNearMatches.length > 0) {
    penalties.push({
      reason: `App Store phonetic/prefix collision (${appStoreNearMatches.slice(0, 3).join(", ")})`,
      penalty: 15,
    });
  }

  if ((input.social ?? []).some((s) => s.status === "taken")) {
    penalties.push({ reason: "Social handle taken", penalty: 10 });
  }

  for (const dom of input.domains) {
    if (dom.status === "taken" && (dom.tld === "com" || dom.tld === "dev" || dom.tld === "io")) {
      penalties.push({ reason: `.${dom.tld} domain taken`, penalty: 10 });
    }
  }

  const totalPenalty = penalties.reduce((acc, p) => acc + p.penalty, 0);
  const score = Math.max(0, 100 - totalPenalty);

  const hasUnknown =
    input.github.orgAvailable === "unknown" ||
    input.registries.some((r) => r.status === "unknown") ||
    input.domains.some((d) => d.status === "unknown");
  const serpUnchecked = input.serpChecked === false || Boolean(input.serpError);

  let verdict: Verdict = "CLEAN";
  if (fatal || score < 50) {
    verdict = "CONFLICT";
  } else if (serpUnchecked || hasUnknown) {
    verdict = "UNVERIFIED";
  } else if (score < 80 || signals.nearDomainMatches.length > 0 || appStoreNearMatches.length > 0) {
    verdict = "CAUTION";
  }

  return {
    name: input.name,
    score,
    verdict,
    exactDomainInSerp: signals.exactDomainInSerp,
    dictionaryTrap: signals.dictionaryTrap,
    nearDomainMatches: signals.nearDomainMatches,
    appStoreNearMatches,
    penalties,
  };
}
