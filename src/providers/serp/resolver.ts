import type { BrandlinterConfig, SerpProviderId } from "../../core/config.js";
import type { SerpProvider, SerpQueryResult } from "../types.js";
import { createOpenSerpProvider } from "./openserp.js";
import { createSearxngProvider } from "./searxng.js";
import { createSerperProvider } from "./serper.js";
import { createBraveProvider } from "./brave.js";
import { createGoogleCseProvider } from "./google-cse.js";
import { createExaProvider } from "./exa.js";
import { createDuckDuckGoProvider } from "./duckduckgo.js";

type ConcreteProviderId = Exclude<SerpProviderId, "auto">;

/** Preference order used when BRANDLINTER_SERP_PROVIDER is "auto". */
const AUTO_ORDER: readonly ConcreteProviderId[] = [
  "openserp",
  "searxng",
  "serper",
  "brave",
  "google-cse",
  "exa",
];

function isConfigured(cfg: BrandlinterConfig, id: ConcreteProviderId): boolean {
  switch (id) {
    case "openserp":
      return Boolean(cfg.openserpUrl);
    case "searxng":
      return Boolean(cfg.searxngUrl);
    case "serper":
      return Boolean(cfg.serperApiKey);
    case "brave":
      return Boolean(cfg.braveApiKey);
    case "google-cse":
      return Boolean(cfg.googleCseApiKey && cfg.googleCseCx);
    case "exa":
      return Boolean(cfg.exaApiKey);
    case "duckduckgo":
      return true;
  }
}

function buildProvider(cfg: BrandlinterConfig, id: ConcreteProviderId): SerpProvider {
  switch (id) {
    case "openserp":
      if (!cfg.openserpUrl) throw new Error("OPENSERP_URL is required for openserp provider");
      return createOpenSerpProvider(cfg.openserpUrl, cfg.openserpEngines, cfg.openserpAuthHeader);
    case "searxng":
      if (!cfg.searxngUrl) throw new Error("SEARXNG_URL is required for searxng provider");
      return createSearxngProvider(cfg.searxngUrl, cfg.searxngEngines);
    case "serper":
      if (!cfg.serperApiKey) throw new Error("SERPER_API_KEY is required for serper provider");
      return createSerperProvider(cfg.serperApiKey);
    case "brave":
      if (!cfg.braveApiKey) throw new Error("BRAVE_API_KEY is required for brave provider");
      return createBraveProvider(cfg.braveApiKey);
    case "google-cse":
      if (!cfg.googleCseApiKey || !cfg.googleCseCx) {
        throw new Error("GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX are required for google-cse provider");
      }
      return createGoogleCseProvider(cfg.googleCseApiKey, cfg.googleCseCx);
    case "exa":
      if (!cfg.exaApiKey) throw new Error("EXA_API_KEY is required for exa provider");
      return createExaProvider(cfg.exaApiKey);
    case "duckduckgo":
      return createDuckDuckGoProvider();
  }
}

const KNOWN_PROVIDER_IDS: readonly SerpProviderId[] = [
  "auto",
  "openserp",
  "searxng",
  "serper",
  "brave",
  "google-cse",
  "exa",
  "duckduckgo",
];

/**
 * Resolve the ordered SERP providers to try.
 *
 * An explicit provider (override or BRANDLINTER_SERP_PROVIDER) stays a single-entry chain: the caller
 * asked for that engine, so silently answering from a different one would be misleading. Only `auto`
 * builds a failover chain, ending with DuckDuckGo as the always-available last resort.
 */
export function resolveSerpProviderChain(
  cfg: BrandlinterConfig,
  override?: SerpProviderId
): SerpProvider[] {
  const chosen = override ?? cfg.serpProvider;
  if (!KNOWN_PROVIDER_IDS.includes(chosen)) {
    throw new Error(`Unknown SERP provider: "${String(chosen)}"`);
  }
  if (chosen !== "auto") {
    return [buildProvider(cfg, chosen)];
  }
  const configured = AUTO_ORDER.filter((id) => isConfigured(cfg, id));
  return [...configured.map((id) => buildProvider(cfg, id)), createDuckDuckGoProvider()];
}

export function resolveSerpProvider(
  cfg: BrandlinterConfig,
  override?: SerpProviderId
): SerpProvider {
  const chain = resolveSerpProviderChain(cfg, override);
  return chain[0];
}

const TRANSIENT_ERROR_PATTERN =
  /\bHTTP (?:429|500|502|503|504)\b|abort|timed? ?out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|fetch failed|socket hang up/i;

/** Errors worth retrying on the same provider before falling back to the next one. */
export function isTransientSerpError(error?: string): boolean {
  if (!error) return false;
  return TRANSIENT_ERROR_PATTERN.test(error);
}

/** Batch-scoped cursor so later candidates skip providers that already failed in this run. */
export interface FailoverState {
  index: number;
}

export interface FailoverSearchOutcome {
  providerId: string;
  result: SerpQueryResult;
  fallbackFrom?: string;
}

const sleep = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

/**
 * Search one query through the chain: retry transient failures once, then advance to the next
 * provider. A provider that legitimately answers with zero results is not a failure.
 */
export async function searchWithFailover(
  chain: SerpProvider[],
  state: FailoverState,
  query: string,
  limit = 10,
  options?: { attemptsPerProvider?: number; retryDelayMs?: number }
): Promise<FailoverSearchOutcome> {
  if (chain.length === 0) throw new Error("SERP provider chain is empty");

  const attempts = Math.max(1, options?.attemptsPerProvider ?? 2);
  const retryDelayMs = options?.retryDelayMs ?? 250;
  const start = Math.min(Math.max(state.index, 0), chain.length - 1);

  let lastResult: SerpQueryResult | undefined;
  let lastProviderId = chain[start].id;

  for (let idx = start; idx < chain.length; idx++) {
    const provider = chain[idx];
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const result = await provider.search(query, limit);
      lastResult = result;
      lastProviderId = provider.id;

      if (!result.error) {
        state.index = idx;
        return {
          providerId: provider.id,
          result,
          fallbackFrom: idx > 0 ? chain[0].id : undefined,
        };
      }
      if (attempt < attempts && isTransientSerpError(result.error)) {
        await sleep(retryDelayMs);
        continue;
      }
      break;
    }
    if (idx + 1 < chain.length) {
      state.index = idx + 1;
    }
  }

  return {
    providerId: lastProviderId,
    // The loop always runs at least once, so lastResult is set.
    result: lastResult as SerpQueryResult,
    fallbackFrom: start > 0 ? chain[0].id : undefined,
  };
}
