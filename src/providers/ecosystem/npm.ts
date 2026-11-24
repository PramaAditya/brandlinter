import { withTimeout } from "../../core/concurrency.js";
import type { RegistryCheckResult } from "../types.js";

export async function checkNpm(slug: string, timeoutMs = 8000): Promise<RegistryCheckResult> {
  const url = `https://www.npmjs.com/package/${slug}`;
  try {
    const res = await withTimeout(
      (signal) => fetch(`https://registry.npmjs.org/${encodeURIComponent(slug)}`, { signal }),
      timeoutMs
    );
    if (res.status === 404) {
      return { registry: "npm", packageName: slug, url, status: "available" };
    }
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { description?: string };
      return {
        registry: "npm",
        packageName: slug,
        url,
        status: "taken",
        detail: data.description?.slice(0, 80),
      };
    }
    return { registry: "npm", packageName: slug, url, status: "unknown", detail: `HTTP ${res.status}` };
  } catch (err: unknown) {
    return {
      registry: "npm",
      packageName: slug,
      url,
      status: "unknown",
      detail: err instanceof Error ? err.message : "npm error",
    };
  }
}
