export type AvailabilityStatus = "available" | "taken" | "unknown";

export interface DomainCheckResult {
  tld: string;
  domain: string;
  url: string;
  status: AvailabilityStatus;
  source: "rdap" | "doh" | "porkbun" | "whois-cli";
  detail?: string;
}

export interface GitHubCheckResult {
  orgAvailable: AvailabilityStatus;
  orgUrl: string;
  exactRepoCount: number | null;
  topRepo?: {
    fullName: string;
    stars: number;
    url: string;
  };
  detail?: string;
}

export interface RegistryCheckResult {
  registry: "npm" | "pypi" | "crates";
  packageName: string;
  url: string;
  status: AvailabilityStatus;
  detail?: string;
}

export interface SerpItem {
  rank: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export interface SerpQueryResult {
  provider: string;
  query: string;
  results: SerpItem[];
  confidence: "high" | "medium" | "low";
  error?: string;
}

export interface SerpProvider {
  readonly id: string;
  search(query: string, limit?: number): Promise<SerpQueryResult>;
}
