const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_RE = /^[a-z]{2,24}$/;

export function sanitizeSlug(raw: string): string {
  const slug = raw.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw new Error(
      `Invalid candidate slug "${raw}": must match ${SLUG_RE.source}`
    );
  }
  return slug;
}

export function sanitizeTld(raw: string): string {
  const tld = raw.trim().toLowerCase().replace(/^\.+/, "");
  if (!TLD_RE.test(tld)) {
    throw new Error(`Invalid TLD "${raw}": must match ${TLD_RE.source}`);
  }
  return tld;
}

export function normalizePypiName(name: string): string {
  return name.trim().toLowerCase().replace(/[-_.]+/g, "-");
}

export function sanitizeCandidates(rawList: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rawList) {
    const clean = sanitizeSlug(raw);
    if (!seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}
