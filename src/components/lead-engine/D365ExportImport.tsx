import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download, FileSpreadsheet, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { LeadWithAccount } from '@/hooks/useLeadEngine';

// ── Export dual-sheet D365 workbook ──

export function exportD365Workbook(leads: LeadWithAccount[], contacts: any[]) {
  if (leads.length === 0) { toast.info('No leads to export'); return; }

  // Build accounts sheet
  const accountRows = leads.map(l => ({
    'Account Name': l.account.name,
    'Website': l.account.website || (l.account.domain ? `https://${l.account.domain}` : ''),
    'Address City': l.account.hq_city || '',
    'Address State/Region': l.account.hq_state || '',
    'Number of Employees': l.account.employee_count || '',
    'Industry': l.account.industry || '',
  }));

  // Build contacts sheet
  const contactsByAccount = new Map<string, any[]>();
  for (const c of contacts) {
    if (!c.account_id) continue;
    if (!contactsByAccount.has(c.account_id)) contactsByAccount.set(c.account_id, []);
    contactsByAccount.get(c.account_id)!.push(c);
  }

  const contactRows: any[] = [];
  for (const lead of leads) {
    const acctContacts = contactsByAccount.get(lead.account.id) || [];
    for (const c of acctContacts) {
      contactRows.push({
        'First Name': c.first_name,
        'Last Name': c.last_name,
        'Parent Customer': lead.account.name,
        'Email': c.email || '',
        'Business Phone': c.phone || '',
        'Job Title': c.title || '',
        'Address City': lead.account.hq_city || '',
        'Address State/Region': lead.account.hq_state || '',
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const wsA = XLSX.utils.json_to_sheet(accountRows);
  const wsC = XLSX.utils.json_to_sheet(contactRows);
  XLSX.utils.book_append_sheet(wb, wsA, 'Accounts');
  XLSX.utils.book_append_sheet(wb, wsC, 'Contacts');
  XLSX.writeFile(wb, `d365-import-${new Date().toISOString().split('T')[0]}.xlsx`, { bookType: 'xlsx' });
  toast.success(`Exported ${accountRows.length} accounts + ${contactRows.length} contacts for D365`);

  supabase.from('audit_log').insert({
    actor: 'user', action: 'export_d365_workbook',
    entity_type: 'accounts',
    details: { accounts: accountRows.length, contacts: contactRows.length },
  });
}

// Legacy single-sheet check CSV (kept for backward compat)
export function exportD365CheckCSV(leads: LeadWithAccount[]) {
  if (leads.length === 0) { toast.info('No leads to export'); return; }
  const rows = leads.map(l => ({
    'Account Name': l.account.name,
    'Website': l.account.website || (l.account.domain ? `https://${l.account.domain}` : ''),
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
    actor: 'user', action: 'export_d365_check', entity_type: 'accounts', details: { count: rows.length },
  });
}

// ── Import D365 Results Dialog (legacy ownership check) ──

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

      let matched = 0, unmatched = 0, unownedCount = 0, ownedCount = 0, duplicateInactiveCount = 0;

      for (const row of rows) {
        const company = String(row.company || row.Company || row['Account Name'] || '').trim();
        if (!company) { unmatched++; continue; }
        const owned = String(row.owned || row.Owned || '').toLowerCase() === 'true';
        const inactiveFlag = String(row.inactive_flag || row['Inactive Flag'] || row.inactive || '').toLowerCase() === 'true';
        const ownerName = String(row.owner_name || row['Owner Name'] || row.owner || '').trim() || null;
        const lastActivity = String(row.last_activity || row['Last Activity'] || '').trim() || null;
        const d365Id = String(row.d365_account_id || row['D365 Account ID'] || row.d365_id || '').trim() || null;

        const { data: accounts } = await supabase.from('accounts').select('id').ilike('name', company).limit(1);
        if (!accounts || accounts.length === 0) { unmatched++; continue; }

        let d365_status: string;
        let needs_review = false;
        if (!owned) { d365_status = 'unowned'; unownedCount++; }
        else if (owned && !inactiveFlag) { d365_status = 'owned'; ownedCount++; }
        else { d365_status = 'duplicate_inactive'; needs_review = true; duplicateInactiveCount++; }

        await supabase.from('accounts').update({
          d365_status, d365_owner_name: ownerName, d365_last_activity: lastActivity, d365_account_id: d365Id, needs_review,
        } as any).eq('id', accounts[0].id);
        matched++;
      }

      setResult({ matched, unmatched, unowned: unownedCount, owned: ownedCount, duplicateInactive: duplicateInactiveCount });
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      toast.success(`Imported: Unowned ${unownedCount} · Owned ${ownedCount} · Dup/Inactive ${duplicateInactiveCount} · Unmatched ${unmatched}`);
      await supabase.from('audit_log').insert({
        actor: 'user', action: 'import_d365_results', entity_type: 'accounts',
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
              Unowned {result.unowned} · Owned {result.owned} · Dup/Inactive {result.duplicateInactive} · Unmatched {result.unmatched}
            </p>
            <Button size="sm" onClick={() => { setResult(null); onOpenChange(false); }}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV with columns: <code className="text-xs bg-muted px-1 rounded">company, owned, inactive_flag, owner_name, last_activity, d365_account_id</code>
            </p>
            <DropZone processing={processing} onFile={handleFile} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Import D365 Success File (stamps crm_guid on contacts_le) ──

interface ImportD365SuccessProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function extractGuidFromUrl(url?: string): string | undefined {
  if (!url) return;
  const m = url.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m?.[0];
}

export function ImportD365Success({ open, onOpenChange }: ImportD365SuccessProps) {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ claimed: number; needsReview: number; unmatched: number } | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setProcessing(true);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      if (rows.length === 0) { toast.error('File is empty'); setProcessing(false); return; }

      // Collect success emails
      const successEmails = new Set<string>();
      const successByEmail = new Map<string, { crm_record_url?: string; crm_guid?: string }>();

      for (const row of rows) {
        const email = String(row['Email'] || row['Primary Email'] || row['email'] || '').toLowerCase().trim();
        if (!email) continue;
        const crmUrl = String(row['Record URL'] || row['Link'] || row['record_url'] || '').trim() || undefined;
        const guid = extractGuidFromUrl(crmUrl);
        successEmails.add(email);
        successByEmail.set(email, { crm_record_url: crmUrl, crm_guid: guid });
      }

      // Get all contacts_le to find matches
      const { data: allContacts } = await supabase.from('contacts_le').select('id, email').not('email', 'is', null);
      
      let claimed = 0;
      let needsReview = 0;
      let unmatched = 0;

      const matchedContactIds = new Set<string>();

      for (const contact of allContacts || []) {
        const contactEmail = (contact.email || '').toLowerCase().trim();
        if (!contactEmail) continue;
        
        if (successEmails.has(contactEmail)) {
          const successData = successByEmail.get(contactEmail)!;
          await supabase.from('contacts_le').update({
            crm_status: 'claimed',
            crm_guid: successData.crm_guid || null,
            crm_record_url: successData.crm_record_url || null,
          } as any).eq('id', contact.id);
          matchedContactIds.add(contact.id);
          claimed++;
        }
      }

      // Mark unmatched contacts (those with emails not in success file) as needs_review
      // Only mark contacts that were part of a batch (have batch_id)
      const { data: batchContacts } = await supabase.from('contacts_le')
        .select('id, email')
        .not('batch_id', 'is', null)
        .not('email', 'is', null);

      for (const contact of batchContacts || []) {
        if (matchedContactIds.has(contact.id)) continue;
        const contactEmail = (contact.email || '').toLowerCase().trim();
        if (!contactEmail) continue;
        // Only set needs_review if not already claimed
        const { data: current } = await supabase.from('contacts_le').select('crm_status').eq('id', contact.id).single();
        if (current && current.crm_status !== 'claimed') {
          await supabase.from('contacts_le').update({ crm_status: 'needs_review' } as any).eq('id', contact.id);
          needsReview++;
        }
      }

      unmatched = successEmails.size - claimed;

      setResult({ claimed, needsReview, unmatched });
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      queryClient.invalidateQueries({ queryKey: ['needs-review-contacts'] });
      toast.success(`Success file processed: ${claimed} claimed, ${needsReview} needs review`);

      await supabase.from('audit_log').insert({
        actor: 'user', action: 'import_d365_success', entity_type: 'contacts_le',
        details: { claimed, needsReview, unmatched, totalRows: rows.length },
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
            <CheckCircle2 size={20} className="text-primary" /> Import D365 Success File
          </DialogTitle>
        </DialogHeader>
        {result ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-primary" />
            <p className="text-sm text-foreground font-medium">Success file processed</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="text-green-600">{result.claimed} contacts claimed (GUID stamped)</p>
              <p className="text-orange-500">{result.needsReview} contacts sent to Needs Review</p>
              {result.unmatched > 0 && <p className="text-muted-foreground">{result.unmatched} success emails not matched to contacts</p>}
            </div>
            <Button size="sm" onClick={() => { setResult(null); onOpenChange(false); }}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload the D365 success file after importing. Expected columns: <code className="text-xs bg-muted px-1 rounded">Email, Record URL</code>
            </p>
            <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/30 rounded px-3 py-2">
              <AlertTriangle size={12} />
              Contacts matched by email get crm_guid stamped. Unmatched batch contacts go to Needs Review.
            </div>
            <DropZone processing={processing} onFile={handleFile} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Shared drop zone ──

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
