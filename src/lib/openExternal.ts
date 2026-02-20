import { normalizeUrl } from '@/lib/normalizeUrl';

/**
 * Open an external URL in a new browser tab, breaking out of any iframe context.
 * This avoids ERR_BLOCKED_BY_RESPONSE errors from sites like LinkedIn
 * that block being loaded inside iframes.
 */
export function openExternal(url: string | null | undefined, e?: React.MouseEvent) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const normalized = normalizeUrl(url);
  if (!normalized) return;
  // Use window.open on the top-level window to escape iframe sandbox
  const w = window.top || window;
  w.open(normalized, '_blank', 'noopener,noreferrer');
}
