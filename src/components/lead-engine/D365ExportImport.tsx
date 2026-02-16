import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download, FileSpreadsheet, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { LeadWithAccount } from '@/hooks/useLeadEngine';

// ── Export to D365 Check CSV ──

export function exportD365CheckCSV(leads: LeadWithAccount[]) {
  if (leads.length === 0) { toast.info('No leads to export'); return; }

  const rows = leads.map(l => ({
    'Account Name': l.account.name,
    'Website': l.account.website || l.account.domain ? `https://${l.account.domain}` : '',
    'Address 1: City': l.account.hq_city || '',
    'Address 1: State/Province': l.account.hq_state || '',
    'Industry': l.account.industry || '',
    'Number of Employees': l.account.employee_count || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
  XLSX.writeFile(wb, `d365-check-${new Date().toISOString().split('T')[0]}.xlsx`, { bookType: 'xlsx' });
  toast.success(`Exported ${rows.length} companies for D365 check`);

  supabase.from('audit_log').insert({
    actor: 'user', action: 'export_d365_check',
    entity_type: 'accounts',
    details: { count: rows.length },
  });
}

// ── Import D365 Results Dialog ──

interface ImportD365ResultsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportD365Results({ open, onOpenChange }: ImportD365ResultsProps) {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ matched: number; unmatched: number; unowned: number; owned: number; duplicateInactive: number } | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setProcessing(true);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

      if (rows.length === 0) { toast.error('File is empty'); setProcessing(false); return; }

      let matched = 0;
      let unmatched = 0;
      let unownedCount = 0;
      let ownedCount = 0;
      let duplicateInactiveCount = 0;

      for (const row of rows) {
        const company = String(row.company || row.Company || row['Account Name'] || '').trim();
        if (!company) { unmatched++; continue; }

        const owned = String(row.owned || row.Owned || '').toLowerCase() === 'true';
        const inactiveFlag = String(row.inactive_flag || row['Inactive Flag'] || row.inactive || '').toLowerCase() === 'true';
        const ownerName = String(row.owner_name || row['Owner Name'] || row.owner || '').trim() || null;
        const lastActivity = String(row.last_activity || row['Last Activity'] || '').trim() || null;
        const d365Id = String(row.d365_account_id || row['D365 Account ID'] || row.d365_id || '').trim() || null;

        // Match by company name (case-insensitive)
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id')
          .ilike('name', company)
          .limit(1);

        if (!accounts || accounts.length === 0) { unmatched++; continue; }

        let d365_status: string;
        let needs_review = false;

        if (!owned) {
          d365_status = 'unowned';
          unownedCount++;
        } else if (owned && !inactiveFlag) {
          d365_status = 'owned';
          ownedCount++;
        } else {
          d365_status = 'duplicate_inactive';
          needs_review = true;
          duplicateInactiveCount++;
        }

        await supabase.from('accounts').update({
          d365_status,
          d365_owner_name: ownerName,
          d365_last_activity: lastActivity,
          d365_account_id: d365Id,
          needs_review,
        } as any).eq('id', accounts[0].id);

        matched++;
      }

      setResult({ matched, unmatched, unowned: unownedCount, owned: ownedCount, duplicateInactive: duplicateInactiveCount });
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      toast.success(`Imported: Unowned ${unownedCount} · Owned ${ownedCount} · Duplicate/Inactive ${duplicateInactiveCount} · Unmatched ${unmatched}`);

      await supabase.from('audit_log').insert({
        actor: 'user', action: 'import_d365_results',
        entity_type: 'accounts',
        details: { matched, unmatched, unowned: unownedCount, owned: ownedCount, duplicateInactive: duplicateInactiveCount, total: rows.length },
      });
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }, [queryClient]);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) setResult(null); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-primary" /> Import D365 Results
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-primary" />
            <p className="text-sm text-foreground font-medium">Import complete</p>
            <p className="text-xs text-muted-foreground">
              Unowned {result.unowned} · Owned {result.owned} · Duplicate/Inactive {result.duplicateInactive} · Unmatched {result.unmatched}
            </p>
            <Button size="sm" onClick={() => { setResult(null); onOpenChange(false); }}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV with columns: <code className="text-xs bg-muted px-1 rounded">company, owned, inactive_flag, owner_name, last_activity, d365_account_id</code>
            </p>
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => {
                if (processing) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv,.xlsx,.xls';
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) handleFile(f);
                };
                input.click();
              }}
            >
              {processing ? (
                <Loader2 size={32} className="mx-auto animate-spin text-primary" />
              ) : (
                <>
                  <Upload size={32} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-foreground">Drop CSV here or click to browse</p>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
