import { describe, it, expect, vi, afterEach } from "vitest";
import { checkGitHub } from "../src/providers/ecosystem/github.js";
import { checkNpm } from "../src/providers/ecosystem/npm.js";
import { checkPypi } from "../src/providers/ecosystem/pypi.js";
import { checkCrates } from "../src/providers/ecosystem/crates.js";

describe("ecosystem providers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("checkNpm returns available on 404 and taken on 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    expect((await checkNpm("nymlint")).status).toBe("available");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ description: "a linter" }), { status: 200 }))
    );
    const taken = await checkNpm("brandlint");
    expect(taken.status).toBe("taken");
    expect(taken.detail).toContain("a linter");
  });

  it("checkPypi applies PEP 503 normalization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await checkPypi("My_Cool.Pkg");
    expect(res.packageName).toBe("my-cool-pkg");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://pypi.org/pypi/my-cool-pkg/json",
      expect.any(Object)
    );
  });

  it("checkCrates returns unknown on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    const res = await checkCrates("nymlint");
    expect(res.status).toBe("unknown");
  });

  it("checkGitHub parses org 404 and repo search stars", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://github.com/")) {
        return new Response("", { status: 404 });
      }
      return new Response(
        JSON.stringify({
          total_count: 1,
          items: [
            {
              full_name: "someone/nymlint",
              stargazers_count: 120,
              html_url: "https://github.com/someone/nymlint",
            },
          ],
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await checkGitHub("nymlint");
    expect(res.orgAvailable).toBe("available");
    expect(res.exactRepoCount).toBe(1);
    expect(res.topRepo?.stars).toBe(120);
  });
});
