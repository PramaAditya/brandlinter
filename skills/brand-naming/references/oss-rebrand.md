# OSS Rebrand & Maintainer Pitch Playbook

Use this reference when renaming an existing open-source repository or proposing a rebrand to an upstream maintainer.

---

## 1. Audit the Real Discovery Path First

Maintainers often hesitate to rename a project that already has organic stars because they fear losing discovery momentum. Replace assumptions with evidence:

- Check how real users actually find the repo:
  - **Problem / alternative searches** (`"<competitor> github"`, `"open source <category>"`)
  - **GitHub Topics** (e.g., `<competitor>-alternative`)
  - **Direct brand searches** (`"<current name>"`)
- If discovery comes from problem searches and GitHub Topics while direct brand searches land on an unrelated commercial product, renaming *improves* word-of-mouth conversion without hurting current discovery.

---

## 2. Highlight the Technical Timing Window

Give objective engineering reasons to rename *early*, not just SEO opinions:
- Wire protocol magic bytes, mDNS/DNS-SD service names, and HKDF/domain-separation strings
- Mobile bundle IDs / Android application IDs and package registry names (`npm`, `PyPI`, `crates.io`)
- CLI binary names and config paths

Once third-party clients or downstream packs hardcode those identifiers, renaming becomes a breaking migration.

---

## 3. Zero-Loss Migration Checklist

Reassure the maintainer (or execute yourself) with a concrete safety net:

- **GitHub repository rename:** Preserves all stars, issues, PRs, releases, and GitHub Topic rankings, and automatically redirects old `owner/old-repo` web URLs and `git` remotes — as long as the old repository name is not reused.
- **Temporary name bridge:** Add `(formerly OldName)` to the GitHub repository description and top of `README.md` during the transition window.
- **HTTP 301 permanent redirects:** Redirect old website and docs URLs to the new domain/path (for GitHub Pages behind Cloudflare, a single Cloudflare Redirect Rule handles `old-site/old-path/* -> new-site/` with `301`).

---

## 4. Maintainer Pitch Etiquette (GitHub Issue)

- **Plain Markdown only — never attach a PDF report.** PDFs add download friction, break mobile reading, cannot be quoted inline in replies, and feel like an agency pitch instead of a peer contribution.
- **Open with specific appreciation:** Reference concrete technical artifacts you genuinely respect (spec quality, test vectors, architecture), not generic praise.
- **Lead with objective facts:** Show the exact SERP collision and the technical timing window.
- **Limit to 3–4 vetted options** in one clean Markdown table (positioning, verified free assets, honest caveats). Put rejected/colliding names inside a collapsed `<details><summary>Other names checked that collided</summary>...</details>` block so the research shows without bloating the issue.
- **Zero pressure + concrete help:** Acknowledge they may prefer the current name or pick their own, and offer to help with the rename PR across code, docs, and tests.
