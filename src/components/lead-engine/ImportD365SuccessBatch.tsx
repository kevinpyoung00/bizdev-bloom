import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, CheckCircle2, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeMatchKey } from '@/lib/matchKey';

interface ImportD365SuccessBatchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBatchId: string; // 'all' means none selected
}

function extractGuidFromUrl(url?: string): string | undefined {
  if (!url) return;
  const m = url.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m?.[0];
}

interface ReconcileResult {
  claimed: number;
  needsReview: number;
  warnings: string[];
}

export default function ImportD365SuccessBatch({ open, onOpenChange, selectedBatchId }: ImportD365SuccessBatchProps) {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ReconcileResult | null>(null);

  const noBatch = !selectedBatchId || selectedBatchId === 'all';

  const handleFile = useCallback(async (file: File) => {
    if (noBatch) {
      toast.error('Select a single Batch to reconcile.');
      return;
    }

    setProcessing(true);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      if (rows.length === 0) { toast.error('File is empty'); setProcessing(false); return; }

      // Build success match keys from file
      const successKeys = new Map<string, { crm_record_url?: string; crm_guid?: string }>();
      for (const row of rows) {
        const email = String(row['Email'] || row['Primary Email'] || row['email'] || '').trim();
        const firstName = String(row['First Name'] || row['FirstName'] || '').trim();
        const lastName = String(row['Last Name'] || row['LastName'] || '').trim();
        const domain = String(row['Company Domain'] || row['CompanyDomain'] || row['Website'] || '').trim();
        const mk = normalizeMatchKey({ email, first_name: firstName, last_name: lastName, domain });
        if (!mk || mk === '@') continue;

        const crmUrl = String(row['Record URL'] || row['Link'] || row['record_url'] || '').trim() || undefined;
        const guid = extractGuidFromUrl(crmUrl);
        successKeys.set(mk, { crm_record_url: crmUrl, crm_guid: guid });
      }

      // Get all contacts in this batch
      const { data: batchContacts } = await supabase
        .from('contacts_le')
        .select('id, email, first_name, last_name, match_key, crm_status, account_id')
        .eq('batch_id', selectedBatchId);

      let claimed = 0;
      let needsReview = 0;
      const warnings: string[] = [];
      const matchedContactIds = new Set<string>();

      // Step 1: Match file rows against batch contacts
      for (const contact of batchContacts || []) {
        // Get or compute match_key
        let mk = (contact as any).match_key;
        if (!mk) {
          // Get account domain for fallback
          let domain = '';
          if (contact.account_id) {
            const { data: acct } = await supabase.from('accounts').select('domain').eq('id', contact.account_id).single();
            domain = acct?.domain || '';
          }
          mk = normalizeMatchKey({ email: contact.email, first_name: contact.first_name, last_name: contact.last_name, domain });
          // Persist computed match_key
          if (mk && mk !== '@') {
            await supabase.from('contacts_le').update({ match_key: mk } as any).eq('id', contact.id);
          }
        }

        if (!mk || mk === '@') continue;

        if (successKeys.has(mk)) {
          const successData = successKeys.get(mk)!;
          await supabase.from('contacts_le').update({
            crm_status: 'claimed',
            crm_guid: successData.crm_guid || null,
            crm_record_url: successData.crm_record_url || null,
          } as any).eq('id', contact.id);

          // Also update lead_queue claim_status for the account
          if (contact.account_id) {
            await supabase.from('lead_queue')
              .update({ claim_status: 'claimed', claimed_at: new Date().toISOString() } as any)
              .eq('account_id', contact.account_id)
              .eq('claim_status', 'new');
          }

          matchedContactIds.add(contact.id);
          claimed++;
        }
      }

      // Step 2: Mark remaining "new" contacts in this batch as needs_review
      for (const contact of batchContacts || []) {
        if (matchedContactIds.has(contact.id)) continue;
        if (contact.crm_status === 'claimed') continue; // already claimed from prior run

        await supabase.from('contacts_le').update({
          crm_status: 'needs_review',
        } as any).eq('id', contact.id);

        // Also flag account for review
        if (contact.account_id) {
          await supabase.from('accounts').update({ needs_review: true } as any).eq('id', contact.account_id);
        }
        needsReview++;
      }

      // Check for unmatched file rows
      const matchedKeys = new Set((batchContacts || []).map(c => (c as any).match_key || '').filter(Boolean));
      for (const [mk] of successKeys) {
        if (!matchedKeys.has(mk)) {
          warnings.push(`D365 row not found in this batch: ${mk}`);
        }
      }

      setResult({ claimed, needsReview, warnings });
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      queryClient.invalidateQueries({ queryKey: ['claimed-leads'] });
      queryClient.invalidateQueries({ queryKey: ['needs-review-contacts'] });
      toast.success(`Reconciled: ${claimed} claimed, ${needsReview} needs review`);

      await supabase.from('audit_log').insert({
        actor: 'user', action: 'import_d365_success_batch',
        entity_type: 'contacts_le',
        details: { batch_id: selectedBatchId, claimed, needsReview, warnings: warnings.length, totalRows: rows.length },
      });
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }, [queryClient, selectedBatchId, noBatch]);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) setResult(null); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-primary" /> Import D365 Success
          </DialogTitle>
        </DialogHeader>

        {noBatch ? (
          <div className="text-center py-6 space-y-3">
            <AlertTriangle size={32} className="mx-auto text-orange-500" />
            <p className="text-sm font-medium text-foreground">Select a single Batch to reconcile</p>
            <p className="text-xs text-muted-foreground">Use the Batch dropdown on the Lead Queue toolbar first, then open this dialog.</p>
            <Button size="sm" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : result ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-primary" />
            <p className="text-sm text-foreground font-medium">Reconciliation complete</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="text-green-600">{result.claimed} contacts claimed (GUID stamped)</p>
              <p className="text-orange-500">{result.needsReview} contacts sent to Needs Review</p>
              {result.warnings.length > 0 && (
                <details className="text-left mt-2">
                  <summary className="cursor-pointer text-muted-foreground">{result.warnings.length} warnings</summary>
                  <ul className="mt-1 space-y-0.5 max-h-32 overflow-auto text-[10px]">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </details>
              )}
            </div>
            <Button size="sm" onClick={() => { setResult(null); onOpenChange(false); }}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload the D365 success file. Contacts matched by email/name get <code className="text-xs bg-muted px-1 rounded">crm_guid</code> stamped.
              Unmatched contacts in this batch go to <strong>Needs Review</strong>.
            </p>
            <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/30 rounded px-3 py-2">
              <AlertTriangle size={12} />
              Reconciling against the selected batch only.
            </div>
            <DropZone processing={processing} onFile={handleFile} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DropZone({ processing, onFile }: { processing: boolean; onFile: (f: File) => void }) {
  return (
    <div
      className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => {
        if (processing) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.xls';
        input.onchange = (e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) onFile(f);
        };
        input.click();
      }}
    >
      {processing ? (
        <Loader2 size={32} className="mx-auto animate-spin text-primary" />
      ) : (
        <>
          <Upload size={32} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-foreground">Drop file here or click to browse</p>
        </>
      )}
    </div>
  );
}
