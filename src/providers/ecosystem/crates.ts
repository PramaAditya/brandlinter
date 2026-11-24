import { withTimeout } from "../../core/concurrency.js";
import type { RegistryCheckResult } from "../types.js";

export async function checkCrates(slug: string, timeoutMs = 8000): Promise<RegistryCheckResult> {
  const url = `https://crates.io/crates/${slug}`;
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(`https://crates.io/api/v1/crates/${encodeURIComponent(slug)}`, {
          signal,
          headers: { "User-Agent": "brandlinter/0.1 (https://github.com/PramaAditya/brandlinter)" },
        }),
      timeoutMs
    );
    if (res.status === 404) {
      return { registry: "crates", packageName: slug, url, status: "available" };
    }
    if (res.ok) {
      return { registry: "crates", packageName: slug, url, status: "taken" };
    }
    return { registry: "crates", packageName: slug, url, status: "unknown", detail: `HTTP ${res.status}` };
  } catch (err: unknown) {
    return {
      registry: "crates",
      packageName: slug,
      url,
      status: "unknown",
      detail: err instanceof Error ? err.message : "crates.io error",
    };
  }
}
