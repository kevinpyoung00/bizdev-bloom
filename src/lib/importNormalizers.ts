/**
 * Import normalizers for phone priority, industry resolution, and URL cleanup.
 * Used by MultiSourceImporter during merge step.
 */

// ── A) Phone priority ──────────────────────────────────────────────────
// Ordered list of header synonyms (case-insensitive). First non-empty wins.
export const PHONE_HEADER_PRIORITY = [
  /^mobile\s*phone$/i,
  /^work\s*direct\s*phone$/i,
  /^direct\s*phone\s*number$/i,
  /^direct\s*phone$/i,
  /^direct\s*dials?$/i,
  /^business\s*phone$/i,
  /^corporate\s*phone$/i,
  /^company\s*phone$/i,
];

const COMPANY_PHONE_RE = /^(corporate|company)\s*phone$/i;

export interface PhoneResult {
  phone_direct: string;
  phone_source: string;
  phone_is_company: boolean;
  phones_raw: Record<string, string>;
}

/**
 * Given a single CSV row and its raw headers, resolve phone_direct by priority.
 */
export function resolvePhone(row: Record<string, string>, headers: string[]): PhoneResult {
  const phones_raw: Record<string, string> = {};
  // Collect all phone-ish values
  for (const h of headers) {
    if (PHONE_HEADER_PRIORITY.some(re => re.test(h))) {
      const v = (row[h] || '').trim();
      if (v) phones_raw[h] = v;
    }
  }

  // Walk priority list
  for (const re of PHONE_HEADER_PRIORITY) {
    const header = headers.find(h => re.test(h));
    if (header) {
      const v = (row[header] || '').trim();
      if (v) {
        return {
          phone_direct: v,
          phone_source: header,
          phone_is_company: COMPANY_PHONE_RE.test(header),
          phones_raw,
        };
      }
    }
  }

  // Fallback: generic phone/mobile column (for backward compat)
  const genericRe = /phone|mobile|direct.?phone|work.?phone/i;
  const fallback = headers.find(h => genericRe.test(h));
  if (fallback) {
    const v = (row[fallback] || '').trim();
    if (v) {
      phones_raw[fallback] = v;
      return { phone_direct: v, phone_source: fallback, phone_is_company: false, phones_raw };
    }
  }

  return { phone_direct: '', phone_source: '', phone_is_company: false, phones_raw };
}

// ── B) Industry priority ────────────────────────────────────────────────
export const INDUSTRY_HEADER_PRIORITY = [
  /^industry$/i,
  /^primary\s*industry$/i,
  /^all\s*industr/i,
  /^industry\s*hierarchical\s*category$/i,
];

export interface IndustryResult {
  industry: string;
  industry_raw: Record<string, string>;
}

export function resolveIndustry(row: Record<string, string>, headers: string[]): IndustryResult {
  const industry_raw: Record<string, string> = {};
  for (const h of headers) {
    if (INDUSTRY_HEADER_PRIORITY.some(re => re.test(h))) {
      const v = (row[h] || '').trim();
      if (v) industry_raw[h] = v;
    }
  }

  for (const re of INDUSTRY_HEADER_PRIORITY) {
    const header = headers.find(h => re.test(h));
    if (header) {
      let v = (row[header] || '').trim();
      if (!v) continue;
      // "All Industries" → take first token
      if (/^all\s*industr/i.test(header)) {
        v = v.split(/[,;]/)[0].trim();
      }
      if (v) return { industry: v, industry_raw };
    }
  }

  // Fallback: generic "industry" or "sector"
  const fallback = headers.find(h => /^(industry|sector)$/i.test(h));
  if (fallback) {
    const v = (row[fallback] || '').trim();
    if (v) return { industry: v, industry_raw };
  }

  return { industry: '', industry_raw };
}

// ── C) URL normalizer ───────────────────────────────────────────────────
const TRACKING_PARAMS_RE = new RegExp('[?&](trk|utm_\\w+|trackingId|connectionOf|miniProfileUrn|lipi|lici)[^&]*', 'gi');

export interface UrlResult {
  url: string;
  invalid_url_raw?: string;
}

export function normalizeUrl(raw: string): UrlResult {
  let url = (raw || '').trim();
  if (!url) return { url: '' };

  // Force https
  if (/^(www\.|linkedin\.com|app\.zoominfo\.com)/i.test(url)) {
    url = 'https://' + url;
  }
  if (/^http:\/\//i.test(url)) {
    url = url.replace(/^http:\/\//i, 'https://');
  }

  // Strip tracking params
  url = url.replace(TRACKING_PARAMS_RE, '');
  // Clean trailing ? or &
  url = url.replace(/[?&]$/, '');

  // Validate
  if (/^https?:\/\/[^\s]+$/i.test(url)) {
    return { url };
  }

  // Invalid — keep raw
  return { url: raw.trim(), invalid_url_raw: raw.trim() };
}
