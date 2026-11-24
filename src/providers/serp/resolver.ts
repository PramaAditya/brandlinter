import type { BrandlinterConfig, SerpProviderId } from "../../core/config.js";
import type { SerpProvider } from "../types.js";
import { createOpenSerpProvider } from "./openserp.js";
import { createSearxngProvider } from "./searxng.js";
import { createSerperProvider } from "./serper.js";
import { createBraveProvider } from "./brave.js";
import { createGoogleCseProvider } from "./google-cse.js";
import { createExaProvider } from "./exa.js";
import { createDuckDuckGoProvider } from "./duckduckgo.js";

export function resolveSerpProvider(
  cfg: BrandlinterConfig,
  override?: SerpProviderId
): SerpProvider {
  const chosen = override ?? cfg.serpProvider;

  if (chosen !== "auto") {
    switch (chosen) {
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
      default:
        throw new Error(`Unknown SERP provider: "${String(chosen)}"`);
    }
  }

  if (cfg.openserpUrl) {
    return createOpenSerpProvider(cfg.openserpUrl, cfg.openserpEngines, cfg.openserpAuthHeader);
  }
  if (cfg.searxngUrl) {
    return createSearxngProvider(cfg.searxngUrl, cfg.searxngEngines);
  }
  if (cfg.serperApiKey) return createSerperProvider(cfg.serperApiKey);
  if (cfg.braveApiKey) return createBraveProvider(cfg.braveApiKey);
  if (cfg.googleCseApiKey && cfg.googleCseCx) {
    return createGoogleCseProvider(cfg.googleCseApiKey, cfg.googleCseCx);
  }
  if (cfg.exaApiKey) return createExaProvider(cfg.exaApiKey);
  return createDuckDuckGoProvider();
}
