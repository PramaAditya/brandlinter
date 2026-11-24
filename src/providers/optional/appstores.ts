import { withTimeout } from "../../core/concurrency.js";
import type { AvailabilityStatus } from "../types.js";

export interface AppStoreCheckResult {
  store: "appstore";
  status: AvailabilityStatus;
  url: string;
  detail?: string;
}

export async function checkAppStore(
  name: string,
  country = "us",
  timeoutMs = 10000
): Promise<AppStoreCheckResult> {
  const searchUrl = `https://apps.apple.com/search?term=${encodeURIComponent(name)}`;
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=software&limit=5&country=${encodeURIComponent(country)}`,
          { signal }
        ),
      timeoutMs
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
        r.trackName?.toLowerCase() === lower || r.bundleId?.toLowerCase().includes(lower)
    );
    if (exact) {
      return {
        store: "appstore",
        status: "taken",
        url: searchUrl,
        detail: `${exact.trackName ?? ""} (${exact.bundleId ?? ""})`,
      };
    }
    return {
      store: "appstore",
      status: "available",
      url: searchUrl,
      detail: `${data.resultCount ?? 0} partial matches`,
    };
  } catch (err: unknown) {
    return {
      store: "appstore",
      status: "unknown",
      url: searchUrl,
      detail: err instanceof Error ? err.message : "App Store error",
    };
  }
}
