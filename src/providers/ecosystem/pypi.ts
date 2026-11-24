import { withTimeout } from "../../core/concurrency.js";
import { normalizePypiName } from "../../core/sanitize.js";
import type { RegistryCheckResult } from "../types.js";

export async function checkPypi(rawName: string, timeoutMs = 8000): Promise<RegistryCheckResult> {
  const packageName = normalizePypiName(rawName);
  const url = `https://pypi.org/project/${packageName}/`;
  try {
    const res = await withTimeout(
      (signal) => fetch(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`, { signal }),
      timeoutMs
    );
    if (res.status === 404) {
      return { registry: "pypi", packageName, url, status: "available" };
    }
    if (res.ok) {
      return { registry: "pypi", packageName, url, status: "taken" };
    }
    return { registry: "pypi", packageName, url, status: "unknown", detail: `HTTP ${res.status}` };
  } catch (err: unknown) {
    return {
      registry: "pypi",
      packageName,
      url,
      status: "unknown",
      detail: err instanceof Error ? err.message : "PyPI error",
    };
  }
}
