import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { withTimeout } from "./concurrency.js";

const VALID_SERP_PROVIDERS: readonly SerpProviderId[] = [
  "auto",
  "openserp",
  "searxng",
  "serper",
  "brave",
  "google-cse",
  "exa",
  "duckduckgo",
];

export type SerpProviderId =
  | "auto"
  | "openserp"
  | "searxng"
  | "serper"
  | "brave"
  | "google-cse"
  | "exa"
  | "duckduckgo";

export interface BrandlinterConfig {
  serpProvider: SerpProviderId;
  openserpUrl?: string;
  openserpEngines: string;
  openserpAuthHeader?: string;
  searxngUrl?: string;
  searxngEngines: string;
  serperApiKey?: string;
  braveApiKey?: string;
  googleCseApiKey?: string;
  googleCseCx?: string;
  exaApiKey?: string;
  githubToken?: string;
  porkbunApiKey?: string;
  porkbunSecretKey?: string;
  dohUrl: string;
  country: string;
  cacheDir: string;
  warnings: string[];
}

export interface RedactedConfig {
  serpProvider: SerpProviderId;
  resolvedSerpProvider: SerpProviderId;
  openserpUrl?: string;
  openserpEngines: string;
  hasOpenserpAuth: boolean;
  searxngUrl?: string;
  hasSerperKey: boolean;
  hasBraveKey: boolean;
  hasGoogleCse: boolean;
  hasExaKey: boolean;
  hasGithubToken: boolean;
  hasPorkbunKeys: boolean;
  dohUrl: string;
  country: string;
  warnings: string[];
}

export function validateHttpUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(`Invalid URL: "${raw}"`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol "${parsed.protocol}" (expected http or https)`);
  }
  return parsed.toString().replace(/\/+$/, "");
}

function parseDotEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

function readJsonConfig(
  filePath: string,
  warnings: string[]
): Partial<BrandlinterConfig> {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<BrandlinterConfig>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Failed to parse JSON config at ${filePath}: ${msg}`);
    return {};
  }
}

export function resolveConfig(options?: {
  env?: Record<string, string | undefined>;
  overrides?: Partial<BrandlinterConfig>;
  cwd?: string;
}): BrandlinterConfig {
  const cwd = options?.cwd ?? process.cwd();
  const dotEnv = parseDotEnv(path.join(cwd, ".env"));
  const env = options?.env ?? { ...dotEnv, ...process.env };
  const warnings: string[] = [];

  const globalCfg = readJsonConfig(
    path.join(os.homedir(), ".config", "brandlinter", "config.json"),
    warnings
  );
  const localCfg = readJsonConfig(path.join(cwd, "brandlinter.config.json"), warnings);
  const fileCfg = { ...globalCfg, ...localCfg };

  const rawOpenserp = options?.overrides?.openserpUrl ?? env.OPENSERP_URL ?? fileCfg.openserpUrl;
  const rawSearxng = options?.overrides?.searxngUrl ?? env.SEARXNG_URL ?? fileCfg.searxngUrl;
  const rawDoh =
    options?.overrides?.dohUrl ?? env.DOH_URL ?? fileCfg.dohUrl ?? "https://dns.google/resolve";

  const rawSerpProvider =
    options?.overrides?.serpProvider ??
    env.BRANDLINTER_SERP_PROVIDER ??
    fileCfg.serpProvider ??
    "auto";
  if (!VALID_SERP_PROVIDERS.includes(rawSerpProvider as SerpProviderId)) {
    throw new Error(
      `Invalid serpProvider "${rawSerpProvider}". Expected one of: ${VALID_SERP_PROVIDERS.join(", ")}`
    );
  }
  const serpProvider = rawSerpProvider as SerpProviderId;

  const googleCseApiKey =
    options?.overrides?.googleCseApiKey ?? env.GOOGLE_CSE_API_KEY ?? fileCfg.googleCseApiKey;
  const googleCseCx =
    options?.overrides?.googleCseCx ?? env.GOOGLE_CSE_CX ?? fileCfg.googleCseCx;
  if (Boolean(googleCseApiKey) !== Boolean(googleCseCx)) {
    warnings.push(
      "google-cse is half-configured: both GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX are required."
    );
  }

  const porkbunApiKey =
    options?.overrides?.porkbunApiKey ?? env.PORKBUN_API_KEY ?? fileCfg.porkbunApiKey;
  const porkbunSecretKey =
    options?.overrides?.porkbunSecretKey ?? env.PORKBUN_SECRET_KEY ?? fileCfg.porkbunSecretKey;
  if (Boolean(porkbunApiKey) !== Boolean(porkbunSecretKey)) {
    warnings.push(
      "porkbun is half-configured: both PORKBUN_API_KEY and PORKBUN_SECRET_KEY are required."
    );
  }

  return {
    serpProvider,
    dohUrl: validateHttpUrl(rawDoh),
    openserpUrl: rawOpenserp ? validateHttpUrl(rawOpenserp) : undefined,
    openserpEngines:
      options?.overrides?.openserpEngines ??
      env.OPENSERP_ENGINES ??
      fileCfg.openserpEngines ??
      "google",
    openserpAuthHeader:
      options?.overrides?.openserpAuthHeader ??
      env.OPENSERP_AUTH_HEADER ??
      fileCfg.openserpAuthHeader,
    searxngUrl: rawSearxng ? validateHttpUrl(rawSearxng) : undefined,
    searxngEngines:
      options?.overrides?.searxngEngines ??
      env.SEARXNG_ENGINES ??
      fileCfg.searxngEngines ??
      "google,duckduckgo",
    serperApiKey: options?.overrides?.serperApiKey ?? env.SERPER_API_KEY ?? fileCfg.serperApiKey,
    braveApiKey: options?.overrides?.braveApiKey ?? env.BRAVE_API_KEY ?? fileCfg.braveApiKey,
    googleCseApiKey,
    googleCseCx,
    exaApiKey: options?.overrides?.exaApiKey ?? env.EXA_API_KEY ?? fileCfg.exaApiKey,
    githubToken: options?.overrides?.githubToken ?? env.GITHUB_TOKEN ?? fileCfg.githubToken,
    porkbunApiKey,
    porkbunSecretKey,
    country:
      options?.overrides?.country ?? env.BRANDLINTER_COUNTRY ?? fileCfg.country ?? "us",
    cacheDir:
      options?.overrides?.cacheDir ??
      fileCfg.cacheDir ??
      path.join(os.homedir(), ".cache", "brandlinter"),
    warnings,
  };
}

export function detectActiveSerpProvider(cfg: BrandlinterConfig): SerpProviderId {
  if (cfg.serpProvider !== "auto") return cfg.serpProvider;
  if (cfg.openserpUrl) return "openserp";
  if (cfg.searxngUrl) return "searxng";
  if (cfg.serperApiKey) return "serper";
  if (cfg.braveApiKey) return "brave";
  if (cfg.googleCseApiKey && cfg.googleCseCx) return "google-cse";
  if (cfg.exaApiKey) return "exa";
  return "duckduckgo";
}

export function redactConfig(cfg: BrandlinterConfig): RedactedConfig {
  return {
    serpProvider: cfg.serpProvider,
    resolvedSerpProvider: detectActiveSerpProvider(cfg),
    openserpUrl: cfg.openserpUrl,
    openserpEngines: cfg.openserpEngines,
    hasOpenserpAuth: Boolean(cfg.openserpAuthHeader),
    searxngUrl: cfg.searxngUrl,
    hasSerperKey: Boolean(cfg.serperApiKey),
    hasBraveKey: Boolean(cfg.braveApiKey),
    hasGoogleCse: Boolean(cfg.googleCseApiKey && cfg.googleCseCx),
    hasExaKey: Boolean(cfg.exaApiKey),
    hasGithubToken: Boolean(cfg.githubToken),
    hasPorkbunKeys: Boolean(cfg.porkbunApiKey && cfg.porkbunSecretKey),
    dohUrl: cfg.dohUrl,
    country: cfg.country,
    warnings: cfg.warnings,
  };
}

export async function runDoctorCheck(
  cfg: BrandlinterConfig,
  options?: { probe?: boolean }
): Promise<{
  status: "ok" | "degraded";
  config: RedactedConfig;
  warnings: string[];
  probes: Array<{ target: string; ok: boolean; detail?: string }>;
}> {
  const probes: Array<{ target: string; ok: boolean; detail?: string }> = [];

  if (options?.probe !== false) {
    const targets: Array<{ label: string; url: string; headers?: Record<string, string> }> = [];
    if (cfg.openserpUrl) {
      targets.push({
        label: `openserp (${cfg.openserpUrl})`,
        url: `${cfg.openserpUrl}/mega/engines`,
        headers: cfg.openserpAuthHeader ? { Authorization: cfg.openserpAuthHeader } : undefined,
      });
    }
    if (cfg.searxngUrl) {
      targets.push({
        label: `searxng (${cfg.searxngUrl})`,
        url: cfg.searxngUrl,
      });
    }

    for (const t of targets) {
      try {
        const res = await withTimeout(
          (signal) => fetch(t.url, { method: "GET", headers: t.headers, signal }),
          5000
        );
        probes.push({
          target: t.label,
          ok: res.ok,
          detail: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} ${res.statusText}`,
        });
      } catch (err) {
        probes.push({
          target: t.label,
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const degraded = cfg.warnings.length > 0 || probes.some((p) => !p.ok);
  return {
    status: degraded ? "degraded" : "ok",
    config: redactConfig(cfg),
    warnings: cfg.warnings,
    probes,
  };
}
