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

  it("checkGitHub promotes orgAvailable to taken when an item owner matches slug", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://github.com/")) {
        return new Response("", { status: 404 });
      }
      return new Response(
        JSON.stringify({
          total_count: 2,
          items: [
            {
              full_name: "nymlint/cli",
              stargazers_count: 15,
              html_url: "https://github.com/nymlint/cli",
            },
          ],
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await checkGitHub("nymlint");
    expect(res.orgAvailable).toBe("taken");
    expect(res.exactRepoCount).toBe(2);
  });

  it("checkGitHub sets exactRepoCount to null when total_count is not a number", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://github.com/")) {
        return new Response("", { status: 404 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await checkGitHub("nymlint");
    expect(res.exactRepoCount).toBeNull();
  });

  it("checkGitHub prefers highest-starred exact owner or repoName match for topRepo", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://github.com/")) {
        return new Response("", { status: 404 });
      }
      return new Response(
        JSON.stringify({
          total_count: 3,
          items: [
            {
              full_name: "other/nymlint-pro",
              stargazers_count: 500,
              html_url: "https://github.com/other/nymlint-pro",
            },
            {
              full_name: "bar/nymlint",
              stargazers_count: 120,
              html_url: "https://github.com/bar/nymlint",
            },
            {
              full_name: "nymlint/sdk",
              stargazers_count: 250,
              html_url: "https://github.com/nymlint/sdk",
            },
          ],
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await checkGitHub("nymlint");
    expect(res.topRepo?.fullName).toBe("nymlint/sdk");
    expect(res.topRepo?.stars).toBe(250);
  });
});
