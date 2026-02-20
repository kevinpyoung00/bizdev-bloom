/**
 * Normalize a URL: ensure https:// prefix, leave mailto:/tel: as-is.
 */
export function normalizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Format a phone number for tel: links (strip non-digits except leading +).
 */
export function formatTelHref(phone: string | null | undefined): string {
  if (!phone) return '';
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/**
 * Safely render a "reason" field that could be string, object, or array into a readable label.
 */
export function renderReason(reason: any): string {
  if (!reason) return '—';
  if (typeof reason === 'string') return reason || '—';
  if (Array.isArray(reason)) {
    const labels = reason
      .map(r => {
        if (typeof r === 'string') return r;
        if (r && typeof r === 'object') return r.label || r.name || r.reason || JSON.stringify(r);
        return String(r);
      })
      .filter(Boolean);
    return labels.length > 0 ? labels.join(', ') : '—';
  }
  if (typeof reason === 'object') {
    return reason.label || reason.name || reason.reason || '—';
  }
  return String(reason) || '—';
}
