import { describe, it, expect } from "vitest";
import { sanitizeSlug, sanitizeTld, normalizePypiName, sanitizeCandidates } from "../src/core/sanitize.js";

describe("sanitizeSlug", () => {
  it("accepts valid lowercase alphanumeric and hyphenated slugs", () => {
    expect(sanitizeSlug("brandlinter")).toBe("brandlinter");
    expect(sanitizeSlug("my-cool-app2")).toBe("my-cool-app2");
    expect(sanitizeSlug("a")).toBe("a");
  });

  it("trims whitespace and lowercases valid input", () => {
    expect(sanitizeSlug("  NymLint  ")).toBe("nymlint");
  });

  it("rejects empty, leading/trailing hyphens, and shell/path injection", () => {
    expect(() => sanitizeSlug("")).toThrow();
    expect(() => sanitizeSlug("-bad")).toThrow();
    expect(() => sanitizeSlug("bad-")).toThrow();
    expect(() => sanitizeSlug("bad;rm -rf")).toThrow();
    expect(() => sanitizeSlug("../etc/passwd")).toThrow();
    expect(() => sanitizeSlug("has space")).toThrow();
    expect(() => sanitizeSlug("a".repeat(64))).toThrow();
  });
});

describe("sanitizeTld", () => {
  it("strips leading dot, lowercases, and validates", () => {
    expect(sanitizeTld(".COM")).toBe("com");
    expect(sanitizeTld("dev")).toBe("dev");
  });

  it("rejects invalid TLDs", () => {
    expect(() => sanitizeTld("c0m")).toThrow();
    expect(() => sanitizeTld("a")).toThrow();
    expect(() => sanitizeTld("com/../../")).toThrow();
  });
});

describe("normalizePypiName", () => {
  it("applies PEP 503 normalization", () => {
    expect(normalizePypiName("My_Cool.Pkg--Name")).toBe("my-cool-pkg-name");
  });
});

describe("sanitizeCandidates", () => {
  it("deduplicates and preserves order", () => {
    expect(sanitizeCandidates(["NymLint", "nymlint", "nomsift"])).toEqual(["nymlint", "nomsift"]);
  });
});
