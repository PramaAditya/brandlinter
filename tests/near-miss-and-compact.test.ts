import { describe, it, expect, vi, afterEach } from "vitest";
import { analyzeSerpResults, scoreCandidate, summarizeSerpVerdict } from "../src/core/scorer.js";
import { checkAppStore, isNearAppStoreTitle } from "../src/providers/optional/appstores.js";
import { toCompactAvailability, toCompactFullLint, toCompactSeo } from "../src/mcp/format.js";
import type { AvailabilityResult, FullLintResult, SeoCheckResult } from "../src/core/pipeline.js";
import type { SerpItem } from "../src/providers/types.js";

function serp(rank: number, domain: string, title = `Result ${rank}`): SerpItem {
  return { rank, title, url: `https://${domain}/page`, domain, snippet: "" };
}

const emptyAvailability = {
  domains: [
    { tld: "com", domain: "sideslate.com", url: "https://sideslate.com", status: "available" as const, source: "rdap" as const },
    { tld: "dev", domain: "sideslate.dev", url: "https://sideslate.dev", status: "available" as const, source: "rdap" as const },
  ],
  github: { orgAvailable: "available" as const, orgUrl: "https://github.com/sideslate", exactRepoCount: 0 },
  registries: [
    { registry: "npm" as const, packageName: "sideslate", url: "https://npmjs.com/sideslate", status: "available" as const },
  ],
};

describe("analyzeSerpResults", () => {
  it("flags a longer registrar twin on page 1 as a near-domain match", () => {
    const signals = analyzeSerpResults("localscreen", [serp(1, "localscreenshare.com")]);
    expect(signals.exactDomainInSerp).toBe(false);
    expect(signals.nearDomainMatches).toEqual(["localscreenshare.com"]);
    expect(summarizeSerpVerdict(signals)).toBe("CAUTION");
  });

  it("does not flag short candidates, where prefix hits are noise", () => {
    const signals = analyzeSerpResults("lens", [serp(1, "lensshare.com"), serp(2, "contactlen.com")]);
    expect(signals.nearDomainMatches).toEqual([]);
  });

  it("does not double-report an exact match as a near match", () => {
    const signals = analyzeSerpResults("sideslate", [serp(1, "sideslate.com")]);
    expect(signals.exactDomainInSerp).toBe(true);
    expect(signals.nearDomainMatches).toEqual([]);
  });

  it("deduplicates repeated hosts", () => {
    const signals = analyzeSerpResults("deskslate", [
      serp(1, "deskslatepro.com"),
      serp(2, "www.deskslatepro.com"),
    ]);
    expect(signals.nearDomainMatches).toEqual(["deskslatepro.com"]);
  });
});

describe("scoreCandidate near-miss and app store penalties", () => {
  it("downgrades a clean candidate with a near-domain twin to CAUTION (85)", () => {
    const res = scoreCandidate({
      ...emptyAvailability,
      name: "localscreen",
      serpResults: [serp(1, "localscreenshare.com")],
    });
    expect(res.score).toBe(85);
    expect(res.verdict).toBe("CAUTION");
    expect(res.nearDomainMatches).toEqual(["localscreenshare.com"]);
  });

  it("flags an existing App Store app with the same name", () => {
    const res = scoreCandidate({
      ...emptyAvailability,
      name: "anydisplay",
      serpResults: [],
      apps: [{ status: "taken" }],
    });
    expect(res.score).toBe(75);
    expect(res.verdict).toBe("CAUTION");
  });

  it("flags a phonetic App Store neighbour (Tabspan vs TapSpan)", () => {
    const res = scoreCandidate({
      ...emptyAvailability,
      name: "tabspan",
      serpResults: [],
      apps: [{ status: "available", nearMatches: ["TapSpan: Time Tracker"] }],
    });
    expect(res.appStoreNearMatches).toEqual(["TapSpan: Time Tracker"]);
    expect(res.score).toBe(85);
    expect(res.verdict).toBe("CAUTION");
  });

  it("leaves a clean candidate CLEAN with no apps or social configured", () => {
    const res = scoreCandidate({ ...emptyAvailability, name: "sideslate", serpResults: [] });
    expect(res.score).toBe(100);
    expect(res.verdict).toBe("CLEAN");
    expect(res.appStoreNearMatches).toEqual([]);
  });
});

describe("isNearAppStoreTitle", () => {
  it("detects one-edit phonetic collisions after stripping marketing suffixes", () => {
    expect(isNearAppStoreTitle("tabspan", "TapSpan: Time Tracker")).toBe(true);
    expect(isNearAppStoreTitle("sideslate", "Sideslate")).toBe(false);
  });

  it("ignores unrelated titles", () => {
    expect(isNearAppStoreTitle("tabspan", "Slate - Branded Content")).toBe(false);
    expect(isNearAppStoreTitle("deskslate", "DeskSign")).toBe(false);
  });

  it("does not match on short candidates with a shared prefix", () => {
    expect(isNearAppStoreTitle("tab", "TablePlus")).toBe(false);
  });
});

function seoResult(name: string, exact: SerpItem[], overrides: Partial<SeoCheckResult> = {}): SeoCheckResult {
  return {
    name,
    provider: "openserp",
    confidence: "high",
    exactResults: exact,
    nicheResults: [],
    ...overrides,
  };
}

describe("compact MCP views", () => {
  it("summarizes SERP signals instead of dumping raw results", () => {
    const item = seoResult("localscreen", [serp(1, "localscreenshare.com", "Getting started — LocalScreen")]);
    const view = toCompactSeo(item);
    expect(view.seoVerdict).toBe("CAUTION");
    expect(view.nearDomainMatches).toEqual(["localscreenshare.com"]);
    expect(view.top).toEqual([{ rank: 1, domain: "localscreenshare.com", title: "Getting started — LocalScreen" }]);
  });

  it("caps SERP hits at five and niche hits at three", () => {
    const exact = Array.from({ length: 9 }, (_, i) => serp(i + 1, `site${i}.example`));
    const niche = Array.from({ length: 6 }, (_, i) => serp(i + 1, `niche${i}.example`));
    const view = toCompactSeo(seoResult("sideslate", exact, { nicheResults: niche }));
    expect(view.top).toHaveLength(5);
    expect(view.nicheTop).toHaveLength(3);
  });

  it("reports a fallback provider so agents know the primary died", () => {
    const view = toCompactSeo(
      seoResult("tabspan", [], { provider: "exa", fallbackFrom: "openserp", confidence: "medium" })
    );
    expect(view.provider).toBe("exa");
    expect(view.fallbackFrom).toBe("openserp");
  });

  it("marks the SERP view UNVERIFIED when the provider errored", () => {
    const view = toCompactSeo(seoResult("tabspan", [], { error: "HTTP 502" }));
    expect(view.seoVerdict).toBe("UNVERIFIED");
    expect(view.error).toBe("HTTP 502");
  });

  it("keeps a 10-candidate SEO batch well under the log-spill threshold", () => {
    const batch = Array.from({ length: 10 }, (_, i) => {
      const exact = Array.from({ length: 8 }, (_, r) =>
        serp(r + 1, `competitor${i}-${r}.com`, `A fairly long competing page title number ${r} about displays`)
      );
      return toCompactSeo(seoResult(`candidate${i}`, exact));
    });
    expect(JSON.stringify(batch).length).toBeLessThan(10_000);
  });

  it("maps Stage 1 results to status objects with app and social summaries", () => {
    const item: AvailabilityResult = {
      name: "sideslate",
      domains: emptyAvailability.domains,
      github: emptyAvailability.github,
      registries: emptyAvailability.registries,
      apps: [{ store: "appstore", status: "available", url: "https://apps.apple.com/search?term=sideslate", nearMatches: ["SlideSlate"] }],
      social: [
        { platform: "X", url: "https://x.com/sideslate", status: "taken" },
        { platform: "YouTube", url: "https://youtube.com/@sideslate", status: "available" },
      ],
      preliminaryScore: 87,
    };
    const view = toCompactAvailability(item);
    expect(view.domains).toEqual({ com: "available", dev: "available" });
    expect(view.registries).toEqual({ npm: "available" });
    expect(view.apps?.[0].nearMatches).toEqual(["SlideSlate"]);
    expect(view.social).toEqual({ taken: ["X"], available: ["YouTube"], unknown: [] });
  });

  it("builds a full-lint view with verdict, score, penalties, and compact SEO", () => {
    const item: FullLintResult = {
      name: "localscreen",
      domains: emptyAvailability.domains,
      github: emptyAvailability.github,
      registries: emptyAvailability.registries,
      preliminaryScore: 85,
      seo: seoResult("localscreen", [serp(1, "localscreenshare.com")]),
      scored: {
        name: "localscreen",
        score: 85,
        verdict: "CAUTION",
        exactDomainInSerp: false,
        dictionaryTrap: false,
        nearDomainMatches: ["localscreenshare.com"],
        appStoreNearMatches: [],
        penalties: [{ reason: "Near-miss domain on page 1 (localscreenshare.com)", penalty: 15 }],
      },
    };
    const view = toCompactFullLint(item);
    expect(view.verdict).toBe("CAUTION");
    expect(view.score).toBe(85);
    expect(view.penalties).toEqual(["Near-miss domain on page 1 (localscreenshare.com) (-15)"]);
    expect(view.seo?.seoVerdict).toBe("CAUTION");
  });
});

describe("app store provider integration", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns near matches for a phonetic neighbour instead of a false 'taken'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            resultCount: 2,
            results: [
              { trackName: "TapSpan: Time Tracker", bundleId: "com.ryall.tapspan" },
              { trackName: "TablePlus", bundleId: "com.tableplus.app" },
            ],
          }),
          { status: 200 }
        )
      )
    );
    const res = await checkAppStore("tabspan", "us");
    expect(res.status).toBe("available");
    expect(res.nearMatches).toEqual(["TapSpan: Time Tracker"]);
  });
});
