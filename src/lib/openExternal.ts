import { normalizeUrl } from '@/lib/normalizeUrl';

/**
 * Open an external URL in a new browser tab, breaking out of any iframe context.
 * Falls back gracefully if cross-origin restrictions prevent window.top access.
 */
export function openExternal(url: string | null | undefined, e?: React.MouseEvent) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const normalized = normalizeUrl(url);
  if (!normalized) return;
  
  // Try window.top first (escapes iframe), fall back to window.open
  try {
    const w = window.top;
    if (w && w !== window) {
      w.open(normalized, '_blank');
      return;
    }
  } catch {
    // Cross-origin — top is inaccessible, fall back
  }
  
  // Fallback: create a temporary <a> on the parent document
  const a = document.createElement('a');
  a.href = normalized;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
