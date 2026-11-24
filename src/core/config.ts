import fs from "node:fs";
import path from "node:path";
import os from "node:os";

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
}

export interface RedactedConfig {
  serpProvider: SerpProviderId;
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

function readJsonConfig(filePath: string): Partial<BrandlinterConfig> {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<BrandlinterConfig>;
  } catch {
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

  const globalCfg = readJsonConfig(
    path.join(os.homedir(), ".config", "brandlinter", "config.json")
  );
  const localCfg = readJsonConfig(path.join(cwd, "brandlinter.config.json"));
  const fileCfg = { ...globalCfg, ...localCfg };

  const rawOpenserp = options?.overrides?.openserpUrl ?? env.OPENSERP_URL ?? fileCfg.openserpUrl;
  const rawSearxng = options?.overrides?.searxngUrl ?? env.SEARXNG_URL ?? fileCfg.searxngUrl;
  const rawDoh =
    options?.overrides?.dohUrl ?? env.DOH_URL ?? fileCfg.dohUrl ?? "https://dns.google/resolve";

  return {
    serpProvider: (options?.overrides?.serpProvider ??
      env.BRANDLINTER_SERP_PROVIDER ??
      fileCfg.serpProvider ??
      "auto") as SerpProviderId,
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
    googleCseApiKey:
      options?.overrides?.googleCseApiKey ?? env.GOOGLE_CSE_API_KEY ?? fileCfg.googleCseApiKey,
    googleCseCx: options?.overrides?.googleCseCx ?? env.GOOGLE_CSE_CX ?? fileCfg.googleCseCx,
    exaApiKey: options?.overrides?.exaApiKey ?? env.EXA_API_KEY ?? fileCfg.exaApiKey,
    githubToken: options?.overrides?.githubToken ?? env.GITHUB_TOKEN ?? fileCfg.githubToken,
    porkbunApiKey:
      options?.overrides?.porkbunApiKey ?? env.PORKBUN_API_KEY ?? fileCfg.porkbunApiKey,
    porkbunSecretKey:
      options?.overrides?.porkbunSecretKey ?? env.PORKBUN_SECRET_KEY ?? fileCfg.porkbunSecretKey,
    dohUrl: validateHttpUrl(rawDoh),
    country:
      options?.overrides?.country ?? env.BRANDLINTER_COUNTRY ?? fileCfg.country ?? "us",
    cacheDir:
      options?.overrides?.cacheDir ??
      fileCfg.cacheDir ??
      path.join(os.homedir(), ".cache", "brandlinter"),
  };
}

export function redactConfig(cfg: BrandlinterConfig): RedactedConfig {
  return {
    serpProvider: cfg.serpProvider,
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
  };
}
