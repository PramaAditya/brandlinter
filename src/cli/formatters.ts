import type { AvailabilityResult, FullLintResult, SeoCheckResult } from "../core/pipeline.js";

function fmtStatus(s: string): string {
  if (s === "available") return "FREE";
  if (s === "taken") return "TAKEN";
  return "UNKNOWN";
}

export function formatStage1Markdown(results: AvailabilityResult[]): string {
  if (results.length === 0) return "No candidates checked.";
  const tlds = results[0].domains.map((d) => `.${d.tld}`);
  const regs = results[0].registries.map((r) => r.registry);
  const headers = ["Name", "Prelim", "GH Org", "GH Top Repo", ...tlds, ...regs];
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
    lines.push(`| ${[r.name, String(r.preliminaryScore), ghOrg, ghTop, ...domCols, ...regCols].join(" | ")} |`);
  }
  return lines.join("\n");
}

export function formatSeoMarkdown(results: SeoCheckResult[]): string {
  if (results.length === 0) return "No SEO checks run.";
  const lines = [
    "| Name | Provider | Confidence | Exact Hits | Top SERP Domains |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const r of results) {
    const domains = r.exactResults.slice(0, 3).map((x) => x.domain).join(", ");
    const cell = r.error
      ? domains
        ? `${domains} (PARTIAL ERR: ${r.error})`
        : `ERR: ${r.error}`
      : domains || "None";
    lines.push(`| ${r.name} | ${r.provider} | ${r.confidence} | ${r.exactResults.length} | ${cell} |`);
  }
  return lines.join("\n");
}

export function formatFullLintMarkdown(results: FullLintResult[]): string {
  if (results.length === 0) return "No candidates linted.";
  const lines = [
    "| Name | Verdict | Score | GH Org | .com | SERP Exact | Top Competitor |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of results) {
    const com = r.domains.find((d) => d.tld === "com");
    const serpCell = !r.seo
      ? "skipped"
      : r.seo.error
        ? `ERR (${r.seo.exactResults.length})`
        : String(r.seo.exactResults.length);
    const topComp = r.seo?.exactResults[0]?.domain ?? (r.seo?.error ? `ERR: ${r.seo.error}` : "-");
    lines.push(
      `| ${r.name} | ${r.scored.verdict} | ${r.scored.score}/100 | ${fmtStatus(r.github.orgAvailable)} | ${com ? fmtStatus(com.status) : "-"} | ${serpCell} | ${topComp} |`
    );
  }
  return lines.join("\n");
}
