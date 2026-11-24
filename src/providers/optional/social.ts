import { withTimeout } from "../../core/concurrency.js";
import type { AvailabilityStatus } from "../types.js";

export interface SocialCheckResult {
  platform: string;
  url: string;
  status: AvailabilityStatus;
  detail?: string;
}

const SOCIAL_TARGETS: Array<[string, string]> = [
  ["X", "https://x.com/{name}"],
  ["YouTube", "https://www.youtube.com/@{name}"],
  ["Reddit", "https://www.reddit.com/r/{name}"],
  ["Bluesky", "https://bsky.app/profile/{name}.bsky.social"],
  ["LinkedIn", "https://www.linkedin.com/company/{name}/"],
];

export async function checkSocialHandles(
  slug: string,
  timeoutMs = 8000
): Promise<SocialCheckResult[]> {
  return Promise.all(
    SOCIAL_TARGETS.map(async ([platform, tpl]) => {
      const url = tpl.replace("{name}", slug);
      try {
        const res = await withTimeout(
          (signal) =>
            fetch(url, {
              method: "HEAD",
              signal,
              redirect: "follow",
              headers: { "User-Agent": "Mozilla/5.0 (compatible; brandlinter/0.1)" },
            }),
          timeoutMs
        );
        if (res.status === 404 || res.status === 410) {
          return { platform, url, status: "available" };
        }
        if (res.ok || res.status === 200 || res.status === 301 || res.status === 302) {
          return { platform, url, status: "taken" };
        }
        return { platform, url, status: "unknown", detail: `HTTP ${res.status}` };
      } catch (err: unknown) {
        return {
          platform,
          url,
          status: "unknown",
          detail: err instanceof Error ? err.message : "Social check error",
        };
      }
    })
  );
}
