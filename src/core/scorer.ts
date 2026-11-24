import type {
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
  penalties: ScoreBreakdownItem[];
}

const DICTIONARY_DOMAINS = [
  "wikipedia.org",
  "wiktionary.org",
  "merriam-webster.com",
  "dictionary.com",
  "oxfordlearnersdictionaries.com",
  "cambridge.org",
];

export function scoreCandidate(input: {
  name: string;
  domains: DomainCheckResult[];
  github: GitHubCheckResult;
  registries: RegistryCheckResult[];
  serpResults?: SerpItem[];
  nicheResults?: SerpItem[];
  serpChecked?: boolean;
  serpError?: string;
}): ScoredCandidate {
  const slug = input.name.toLowerCase();
  const penalties: ScoreBreakdownItem[] = [];
  let fatal = false;
  const serpResults = input.serpResults ?? [];
  const nicheResults = input.nicheResults ?? [];

  const exactDomainInSerp = serpResults.slice(0, 10).some((item) => {
    const host = item.domain.toLowerCase().replace(/^www\./, "");
    const sld = host.split(".")[0];
    return sld === slug;
  });

  if (exactDomainInSerp) {
    penalties.push({ reason: "Exact domain match in SERP Top 10", penalty: 50 });
    fatal = true;
  }

  const nicheCompetitorOverlap = nicheResults.slice(0, 10).some((item) => {
    const host = item.domain.toLowerCase().replace(/^www\./, "");
    const sld = host.split(".")[0];
    return sld === slug;
  });

  if (nicheCompetitorOverlap) {
    penalties.push({ reason: "Niche competitor overlap", penalty: 30 });
    fatal = true;
  }

  const dictionaryTrap = serpResults.slice(0, 3).some((item) => {
    const host = item.domain.toLowerCase();
    return DICTIONARY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  });

  if (dictionaryTrap) {
    penalties.push({ reason: "Dictionary/encyclopedia trap in SERP Top 3", penalty: 30 });
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
  } else if (score < 80) {
    verdict = "CAUTION";
  }

  return {
    name: input.name,
    score,
    verdict,
    exactDomainInSerp,
    dictionaryTrap,
    penalties,
  };
}
