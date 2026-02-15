/**
 * Compute a canonical company name for deduplication.
 * Strips suffixes (Inc, LLC, Co, etc.), punctuation, collapses whitespace, lowercases.
 */
export function canonicalCompanyName(name: string): string {
  return name
    .replace(/\s+(inc|llc|co|corp|ltd|lp|plc|pllc|pc|pa|dba|group|holdings|enterprises)\.?\s*$/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Simple fuzzy match: Jaccard similarity on character trigrams.
 * Returns 0–1 where 1 is identical.
 */
export function fuzzyMatch(a: string, b: string): number {
  if (a === b) return 1;
  const trigramsOf = (s: string) => {
    const t = new Set<string>();
    for (let i = 0; i <= s.length - 3; i++) t.add(s.slice(i, i + 3));
    return t;
  };
  const ta = trigramsOf(a);
  const tb = trigramsOf(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  return intersection / (ta.size + tb.size - intersection);
}
