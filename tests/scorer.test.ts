import { describe, it, expect } from "vitest";
import { scoreCandidate } from "../src/core/scorer.js";

describe("scoreCandidate", () => {
  it("scores a completely clean candidate as CLEAN (100)", () => {
    const res = scoreCandidate({
      name: "nymlint",
      domains: [{ tld: "com", domain: "nymlint.com", url: "https://nymlint.com", status: "available", source: "rdap" }],
      github: { orgAvailable: "available", orgUrl: "https://github.com/nymlint", exactRepoCount: 0 },
      registries: [{ registry: "npm", packageName: "nymlint", url: "https://npmjs.com/package/nymlint", status: "available" }],
      serpResults: [],
    });
    expect(res.score).toBe(100);
    expect(res.verdict).toBe("CLEAN");
    expect(res.exactDomainInSerp).toBe(false);
  });

  it("flags exact domain in SERP as CONFLICT (-50)", () => {
    const res = scoreCandidate({
      name: "anydisplay",
      domains: [{ tld: "com", domain: "anydisplay.com", url: "https://anydisplay.com", status: "available", source: "rdap" }],
      github: { orgAvailable: "available", orgUrl: "https://github.com/anydisplay", exactRepoCount: 0 },
      registries: [{ registry: "npm", packageName: "anydisplay", url: "https://npmjs.com/package/anydisplay", status: "available" }],
      serpResults: [
        { rank: 1, title: "AnyDisplay", url: "https://anydisplay.app/", domain: "anydisplay.app", snippet: "Wireless display" },
      ],
    });
    expect(res.exactDomainInSerp).toBe(true);
    expect(res.score).toBeLessThanOrEqual(50);
    expect(res.verdict).toBe("CONFLICT");
  });

  it("flags dictionary trap in top 3 SERP (-30)", () => {
    const res = scoreCandidate({
      name: "moniker",
      domains: [],
      github: { orgAvailable: "available", orgUrl: "https://github.com/moniker", exactRepoCount: 0 },
      registries: [],
      serpResults: [
        { rank: 1, title: "Moniker Definition", url: "https://www.merriam-webster.com/dictionary/moniker", domain: "www.merriam-webster.com", snippet: "a name" },
      ],
    });
    expect(res.dictionaryTrap).toBe(true);
    expect(res.score).toBe(70);
    expect(res.verdict).toBe("CAUTION");
  });

  it("penalizes popular GitHub repos (>=100 stars = -35)", () => {
    const res = scoreCandidate({
      name: "brandlint",
      domains: [],
      github: {
        orgAvailable: "available",
        orgUrl: "https://github.com/brandlint",
        exactRepoCount: 2,
        topRepo: { fullName: "someone/brandlint", stars: 150, url: "https://github.com/someone/brandlint" },
      },
      registries: [{ registry: "npm", packageName: "brandlint", url: "https://npmjs.com/package/brandlint", status: "taken" }],
      serpResults: [],
    });
    expect(res.score).toBe(40);
    expect(res.verdict).toBe("CONFLICT");
  });

  it("marks candidate UNVERIFIED when SERP errors", () => {
    const res = scoreCandidate({
      name: "nymlint",
      domains: [{ tld: "com", domain: "nymlint.com", url: "https://nymlint.com", status: "available", source: "rdap" }],
      github: { orgAvailable: "available", orgUrl: "https://github.com/nymlint", exactRepoCount: 0 },
      registries: [{ registry: "npm", packageName: "nymlint", url: "https://npmjs.com/package/nymlint", status: "available" }],
      serpResults: [],
      serpError: "SERP timeout",
    });
    expect(res.score).toBe(100);
    expect(res.verdict).toBe("UNVERIFIED");
  });

  it("marks candidate UNVERIFIED when SERP is skipped (serpChecked: false)", () => {
    const res = scoreCandidate({
      name: "nymlint",
      domains: [{ tld: "com", domain: "nymlint.com", url: "https://nymlint.com", status: "available", source: "rdap" }],
      github: { orgAvailable: "available", orgUrl: "https://github.com/nymlint", exactRepoCount: 0 },
      registries: [{ registry: "npm", packageName: "nymlint", url: "https://npmjs.com/package/nymlint", status: "available" }],
      serpChecked: false,
    });
    expect(res.verdict).toBe("UNVERIFIED");
  });

  it("marks candidate UNVERIFIED when domain or registry status is unknown", () => {
    const res = scoreCandidate({
      name: "nymlint",
      domains: [{ tld: "com", domain: "nymlint.com", url: "https://nymlint.com", status: "unknown", source: "rdap" }],
      github: { orgAvailable: "available", orgUrl: "https://github.com/nymlint", exactRepoCount: 0 },
      registries: [{ registry: "npm", packageName: "nymlint", url: "https://npmjs.com/package/nymlint", status: "unknown" }],
      serpResults: [],
    });
    expect(res.verdict).toBe("UNVERIFIED");
  });

  it("does not apply fatal penalty for unrelated substring GitHub repo", () => {
    const res = scoreCandidate({
      name: "slug",
      domains: [],
      github: {
        orgAvailable: "available",
        orgUrl: "https://github.com/slug",
        exactRepoCount: 1,
        topRepo: { fullName: "other/awesome-slug-helper", stars: 500, url: "https://github.com/other/awesome-slug-helper" },
      },
      registries: [],
      serpResults: [],
    });
    expect(res.score).toBe(100);
    expect(res.verdict).toBe("CLEAN");
  });

  it("applies fatal CONFLICT for exact author/slug GitHub repo with >= 100 stars", () => {
    const res = scoreCandidate({
      name: "slug",
      domains: [],
      github: {
        orgAvailable: "available",
        orgUrl: "https://github.com/slug",
        exactRepoCount: 1,
        topRepo: { fullName: "author/slug", stars: 150, url: "https://github.com/author/slug" },
      },
      registries: [],
      serpResults: [],
    });
    expect(res.score).toBe(65);
    expect(res.verdict).toBe("CONFLICT");
  });
});
