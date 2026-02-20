/**
 * Compute a stable match key for contact deduplication.
 * Uses email if available, otherwise falls back to firstName+lastName@domain.
 */
export function normalizeMatchKey(row: {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  FirstName?: string | null;
  LastName?: string | null;
  Email?: string | null;
  CompanyDomain?: string | null;
  domain?: string | null;
}): string {
  const email = (row.email || row.Email || '').trim();
  if (email) return email.toLowerCase();

  const first = (row.first_name || row.FirstName || '').replace(/\s+/g, '').toLowerCase();
  const last = (row.last_name || row.LastName || '').replace(/\s+/g, '').toLowerCase();
  let domain = (row.CompanyDomain || row.domain || '').toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
  return `${first}${last}@${domain}`;
}
