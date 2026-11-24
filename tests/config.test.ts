import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolveConfig,
  validateHttpUrl,
  redactConfig,
  runDoctorCheck,
} from "../src/core/config.js";

describe("validateHttpUrl", () => {
  it("accepts http and https URLs and strips trailing slashes", () => {
    expect(validateHttpUrl("https://openserp.rekapancatama.com/")).toBe("https://openserp.rekapancatama.com");
    expect(validateHttpUrl("http://localhost:8080")).toBe("http://localhost:8080");
  });

  it("rejects non-http schemes and malformed URLs", () => {
    expect(() => validateHttpUrl("file:///etc/passwd")).toThrow();
    expect(() => validateHttpUrl("ftp://example.com")).toThrow();
    expect(() => validateHttpUrl("not-a-url")).toThrow();
  });
});

describe("resolveConfig", () => {
  it("applies defaults when env is empty", () => {
    const cfg = resolveConfig({ env: {}, cwd: "/nonexistent-dir-12345" });
    expect(cfg.serpProvider).toBe("auto");
    expect(cfg.country).toBe("us");
    expect(cfg.dohUrl).toBe("https://dns.google/resolve");
  });

  it("prefers explicit overrides over env", () => {
    const cfg = resolveConfig({
      env: {
        OPENSERP_URL: "https://openserp.example.com/",
        BRANDLINTER_COUNTRY: "id",
      },
      overrides: {
        country: "gb",
      },
      cwd: "/nonexistent-dir-12345",
    });
    expect(cfg.openserpUrl).toBe("https://openserp.example.com");
    expect(cfg.country).toBe("gb");
  });
});

describe("redactConfig", () => {
  it("redacts sensitive keys and auth headers", () => {
    const cfg = resolveConfig({
      env: {
        SERPER_API_KEY: "secret-serper-123",
        OPENSERP_AUTH_HEADER: "Bearer secret-token",
        GITHUB_TOKEN: "ghp_secret",
      },
      cwd: "/nonexistent-dir-12345",
    });
    const safe = redactConfig(cfg);
    expect(JSON.stringify(safe)).not.toContain("secret-serper-123");
    expect(JSON.stringify(safe)).not.toContain("secret-token");
    expect(JSON.stringify(safe)).not.toContain("ghp_secret");
    expect(safe.hasSerperKey).toBe(true);
    expect(safe.hasGithubToken).toBe(true);
  });

  it("throws on invalid serpProvider", () => {
    expect(() =>
      resolveConfig({
        env: { BRANDLINTER_SERP_PROVIDER: "not-a-provider" },
        cwd: "/nonexistent-dir-12345",
      })
    ).toThrow(/Invalid serpProvider/);
  });

  it("warns when google-cse is half-configured", () => {
    const cfg = resolveConfig({
      env: { GOOGLE_CSE_API_KEY: "only-key" },
      cwd: "/nonexistent-dir-12345",
    });
    expect(cfg.warnings.some((w) => w.includes("google-cse"))).toBe(true);
    expect(redactConfig(cfg).warnings).toEqual(cfg.warnings);
  });
});

describe("runDoctorCheck", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns degraded status when probe fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const cfg = resolveConfig({
      env: { OPENSERP_URL: "http://localhost:7000" },
      cwd: "/nonexistent-dir-12345",
    });
    const report = await runDoctorCheck(cfg);
    expect(report.status).toBe("degraded");
    expect(report.probes).toHaveLength(1);
    expect(report.probes[0].ok).toBe(false);
    expect(report.probes[0].detail).toContain("ECONNREFUSED");
  });
});
