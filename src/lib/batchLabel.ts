/**
 * Build a human-readable batch label from lead_batches metadata.
 * Format: YYYY-MM-DD · Source · ShortName
 */
export interface BatchMeta {
  created_on: string;
  source_batch_id: string | null;
  campaign_batch_id: string;
  batch_id: string;
}

function detectSource(filename: string | null): string {
  if (!filename) return 'Import';
  const lower = filename.toLowerCase();
  if (lower.includes('d365') || lower.includes('dynamics')) return 'D365Sync';
  if (lower.includes('zoominfo') && lower.includes('apollo')) return 'ZI+Apollo';
  if (lower.includes('zoominfo')) return 'ZoomInfo';
  if (lower.includes('apollo')) return 'Apollo';
  return 'Import';
}

function shortName(filename: string | null, campaignId: string): string {
  const raw = filename || campaignId || '';
  // Strip common extensions
  const cleaned = raw.replace(/\.(csv|xlsx|xls)$/i, '');
  if (cleaned.length <= 16) return cleaned;
  return cleaned.substring(0, 16) + '…';
}

export function buildBatchLabel(batch: BatchMeta): string {
  const date = batch.created_on
    ? new Date(batch.created_on).toISOString().split('T')[0]
    : '—';
  const source = detectSource(batch.source_batch_id);
  const name = shortName(batch.source_batch_id, batch.campaign_batch_id);
  return `${date} · ${source} · ${name}`;
}

/** Map of batch_id → pretty label for quick lookup */
export function buildBatchLabelMap(batches: BatchMeta[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of batches) {
    map.set(b.batch_id, buildBatchLabel(b));
  }
  return map;
}
