import { withTimeout } from "../../core/concurrency.js";
import type { AvailabilityStatus } from "../types.js";

export interface AppStoreCheckResult {
  store: "appstore";
  status: AvailabilityStatus;
  url: string;
  /** Titles close enough to be confused with the candidate (one edit, or a shared prefix). */
  nearMatches?: string[];
  detail?: string;
}

/** `TapSpan: Time Tracker` -> `tapspan`, so marketing suffixes cannot hide a collision. */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .split(/[:\-–—|(]/)[0]
    .replace(/[^a-z0-9]/g, "");
}

/** True when two labels differ by at most one insertion, deletion, or substitution. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
      continue;
    }
    if (edits === 1) return false;
    edits = 1;
    if (short.length === long.length) i++;
    j++;
  }
  return edits + (short.length - i) + (long.length - j) <= 1;
}

const NEAR_MATCH_MIN_SLUG_LENGTH = 5;

export function isNearAppStoreTitle(slug: string, title: string): boolean {
  const label = normalizeTitle(title);
  if (!label || label === slug) return false;
  if (withinOneEdit(label, slug)) return true;
  if (slug.length < NEAR_MATCH_MIN_SLUG_LENGTH) return false;
  return label.startsWith(slug) || slug.startsWith(label);
}

export async function checkAppStore(
  name: string,
  country = "us",
  timeoutMs = 10000
): Promise<AppStoreCheckResult> {
  const searchUrl = `https://apps.apple.com/search?term=${encodeURIComponent(name)}`;
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=software&limit=5&country=${encodeURIComponent(country)}`,
        { signal }
      );
      if (!res.ok) {
        return { store: "appstore", status: "unknown", url: searchUrl, detail: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as {
        resultCount?: number;
        results?: Array<{ trackName?: string; bundleId?: string }>;
      };
      const lower = name.toLowerCase();
      const exact = data.results?.find(
        (r) =>
          r.trackName?.toLowerCase() === lower ||
          r.bundleId?.toLowerCase().split(".").pop() === lower
      );
      if (exact) {
        return {
          store: "appstore",
          status: "taken",
          url: searchUrl,
          detail: `${exact.trackName ?? ""} (${exact.bundleId ?? ""})`,
        };
      }

      const nearMatches: string[] = [];
      for (const r of data.results ?? []) {
        const title = r.trackName ?? "";
        if (!title) continue;
        if (isNearAppStoreTitle(lower, title) && !nearMatches.includes(title)) {
          nearMatches.push(title);
        }
      }

      return {
        store: "appstore",
        status: "available",
        url: searchUrl,
        nearMatches,
        detail: `${data.resultCount ?? 0} partial matches`,
      };
    }, timeoutMs);
  } catch (err: unknown) {
    return {
      store: "appstore",
      status: "unknown",
      url: searchUrl,
      detail: err instanceof Error ? err.message : "App Store error",
    };
  }
}
