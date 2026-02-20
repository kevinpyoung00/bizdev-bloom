import { normalizeUrl } from '@/lib/normalizeUrl';
import { toast } from 'sonner';

/**
 * Open an external URL in a new browser tab.
 * MUST be called synchronously from a user click handler.
 * If the browser blocks the popup, copies URL to clipboard and notifies user.
 */
export function openExternal(url: string | null | undefined, e?: React.MouseEvent) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const normalized = normalizeUrl(url);
  if (!normalized) return;

  // Use window.open directly — must be synchronous from click handler
  const win = window.open(normalized, '_blank', 'noopener,noreferrer');

  if (!win) {
    // Popup was blocked — copy URL to clipboard as fallback
    navigator.clipboard.writeText(normalized).then(() => {
      toast.info('Popup blocked — URL copied to clipboard. Paste in a new tab.', { duration: 5000 });
    }).catch(() => {
      toast.error(`Popup blocked. Open manually: ${normalized}`, { duration: 8000 });
    });
  }
}
