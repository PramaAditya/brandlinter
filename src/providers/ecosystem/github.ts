import { withTimeout } from "../../core/concurrency.js";
import type { AvailabilityStatus, GitHubCheckResult } from "../types.js";

export async function checkGitHub(
  slug: string,
  token?: string,
  timeoutMs = 10000
): Promise<GitHubCheckResult> {
  const orgUrl = `https://github.com/${slug}`;
  let orgAvailable: AvailabilityStatus = "unknown";
  let orgDetail: string | undefined;

  try {
    const orgRes = await withTimeout(
      (signal) =>
        fetch(orgUrl, {
          method: "HEAD",
          signal,
          redirect: "manual",
          headers: { "User-Agent": "brandlinter/0.1" },
        }),
      timeoutMs
    );
    if (orgRes.status === 404) orgAvailable = "available";
    else if (orgRes.status === 200 || orgRes.status === 301 || orgRes.status === 302) {
      orgAvailable = "taken";
    } else {
      orgDetail = `Org HTTP ${orgRes.status}`;
    }
  } catch (err: unknown) {
    orgDetail = err instanceof Error ? err.message : "Org check error";
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "brandlinter/0.1",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    return await withTimeout(async (signal) => {
      const searchRes = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(slug)}+in:name&sort=stars&per_page=3`,
        { signal, headers }
      );

      if (!searchRes.ok) {
        return {
          orgAvailable,
          orgUrl,
          exactRepoCount: null,
          detail: [orgDetail, `Repo search HTTP ${searchRes.status}`].filter(Boolean).join("; "),
        };
      }

      const data = (await searchRes.json()) as {
        total_count?: number;
        items?: Array<{ full_name: string; stargazers_count: number; html_url: string }>;
      };
      const items = data.items ?? [];
      const lowerSlug = slug.toLowerCase();
      if (items.some((item) => item.full_name.split("/")[0]?.toLowerCase() === lowerSlug)) {
        orgAvailable = "taken";
      }
      const exactRepoCount = typeof data.total_count === "number" ? data.total_count : null;
      const matchingItems = items.filter((item) => {
        const [rawOwner = "", rawRepo = ""] = item.full_name.split("/");
        const owner = rawOwner.toLowerCase();
        const repoName = rawRepo.toLowerCase();
        return owner === lowerSlug || repoName === lowerSlug;
      });
      const top =
        matchingItems.length > 0
          ? matchingItems.reduce((best, curr) =>
              curr.stargazers_count > best.stargazers_count ? curr : best
            )
          : items[0];
      return {
        orgAvailable,
        orgUrl,
        exactRepoCount,
        topRepo: top
          ? {
              fullName: top.full_name,
              stars: top.stargazers_count,
              url: top.html_url,
            }
          : undefined,
        detail: orgDetail,
      };
    }, timeoutMs);
  } catch (err: unknown) {
    return {
      orgAvailable,
      orgUrl,
      exactRepoCount: null,
      detail: [orgDetail, err instanceof Error ? err.message : "Repo search error"]
        .filter(Boolean)
        .join("; "),
    };
  }
}
