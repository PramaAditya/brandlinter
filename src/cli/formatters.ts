import type { DomainCheckResult, GitHubCheckResult, RegistryCheckResult } from "../providers/types.js";

export interface Stage1CandidateResult {
  name: string;
  domains: DomainCheckResult[];
  github: GitHubCheckResult;
  registries: RegistryCheckResult[];
}

function fmtStatus(s: string): string {
  if (s === "available") return "FREE";
  if (s === "taken") return "TAKEN";
  return "UNKNOWN";
}

export function formatStage1Markdown(results: Stage1CandidateResult[]): string {
  if (results.length === 0) return "No candidates checked.";
  const tlds = results[0].domains.map((d) => `.${d.tld}`);
  const regs = results[0].registries.map((r) => r.registry);
  const headers = ["Name", "GH Org", "GH Top Repo", ...tlds, ...regs];
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];

  for (const r of results) {
    const ghOrg = fmtStatus(r.github.orgAvailable);
    const ghTop = r.github.topRepo
      ? `${r.github.topRepo.fullName} (${r.github.topRepo.stars}★)`
      : r.github.exactRepoCount === null
        ? "UNKNOWN"
        : "0 repos";
    const domCols = r.domains.map((d) => fmtStatus(d.status));
    const regCols = r.registries.map((reg) => fmtStatus(reg.status));
    lines.push(`| ${[r.name, ghOrg, ghTop, ...domCols, ...regCols].join(" | ")} |`);
  }
  return lines.join("\n");
}

export function formatStage1Table(results: Stage1CandidateResult[]): string {
  return formatStage1Markdown(results);
}
