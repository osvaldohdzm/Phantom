/** Tokens para localizar un registro en core.vulns_catalog desde un hallazgo. */

const CVE_RE = /CVE-\d{4}-\d+/gi;
const ADVISORY_RE = /\(([a-z]{2,}-[a-z0-9][-a-z0-9]*)\)/gi;

export function extractCatalogLookupTokens(
  titulo: string,
  cve?: string | null,
  rawToolOutput?: string | null
): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();

  const add = (value: string | null | undefined) => {
    const t = (value ?? '').trim();
    if (t.length < 4) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tokens.push(t);
  };

  if (cve?.trim()) add(cve.trim());

  const haystack = `${titulo}\n${rawToolOutput ?? ''}`;
  for (const match of haystack.matchAll(CVE_RE)) {
    add(match[0].toUpperCase());
  }
  for (const match of haystack.matchAll(ADVISORY_RE)) {
    add(match[1]);
  }

  const title = titulo.trim();
  if (title.length >= 12) add(title);

  return tokens;
}
