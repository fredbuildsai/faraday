/** Normalise an ORCID (accepts URL or bare form) to 0000-0000-0000-000X, or null if malformed. */
export function normaliseOrcid(raw: string): string | null {
  const s = raw.trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, "").toUpperCase();
  const digits = s.replace(/-/g, "");
  if (!/^\d{15}[\dX]$/.test(digits)) return null;
  return digits.match(/.{4}/g)!.join("-");
}

/** ISO 7064 MOD 11-2 checksum check. */
export function isValidOrcid(raw: string): boolean {
  const n = normaliseOrcid(raw);
  if (!n) return false;
  const d = n.replace(/-/g, "");
  let total = 0;
  for (let i = 0; i < 15; i++) total = (total + Number(d[i])) * 2;
  const r = (12 - (total % 11)) % 11;
  const check = r === 10 ? "X" : String(r);
  return d[15] === check;
}
