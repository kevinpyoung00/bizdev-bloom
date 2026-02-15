import { useState } from 'react';
import Layout from '@/components/crm/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Eye, Loader2, CheckCircle2, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLeadQueue, useRunScoring, useAccountContacts } from '@/hooks/useLeadEngine';
import { useClaimLead, useRejectLead, useMarkUploaded, REJECT_REASONS } from '@/hooks/useLeadActions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import AccountDrawer from '@/components/lead-engine/AccountDrawer';
import { DualStarsBadge, StarsLegend } from '@/components/lead-engine/DualStarsBadge';
import LeadStatusBadge from '@/components/lead-engine/LeadStatusBadge';
import SignalChips, { buildChipsFromTriggers } from '@/components/crm/SignalChips';
import type { LeadWithAccount } from '@/hooks/useLeadEngine';

async function exportClaimedExcel(leads: LeadWithAccount[]) {
  const claimed = leads.filter(l => (l as any).claim_status === 'claimed');
  if (claimed.length === 0) { toast.info('No claimed leads to export'); return; }

  const accountIds = claimed.map(l => l.account.id);
  const { data: contacts } = await supabase.from('contacts_le').select('*').in('account_id', accountIds);
  const contactsByAccount = new Map<string, any[]>();
  for (const c of contacts || []) {
    if (!c.account_id) continue;
    if (!contactsByAccount.has(c.account_id)) contactsByAccount.set(c.account_id, []);
    contactsByAccount.get(c.account_id)!.push(c);
  }

  const rows: any[] = [];
  for (const lead of claimed) {
    const acctContacts = contactsByAccount.get(lead.account.id) || [];
    const base = {
      'Account Name': lead.account.name,
      Website: lead.account.website || lead.account.domain || '',
      'HQ City': lead.account.hq_city || '',
      'HQ State': lead.account.hq_state || '',
      Industry: lead.account.industry || '',
      'Employee Count': lead.account.employee_count || '',
      Notes: lead.account.notes || '',
      'Claimed On': (lead as any).claimed_at || '',
    };

    if (acctContacts.length === 0) {
      rows.push({ ...base, 'First Name': '', 'Last Name': '', Title: '', Email: '', Phone: '', 'LinkedIn URL': '', 'Persona (Auto)': (lead as any).persona || '' });
    } else {
      for (const c of acctContacts) {
        rows.push({ ...base, 'First Name': c.first_name, 'Last Name': c.last_name, Title: c.title || '', Email: c.email || '', Phone: c.phone || '', 'LinkedIn URL': c.linkedin_url || '', 'Persona (Auto)': (lead as any).persona || '' });
      }
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'D365 Export');
  XLSX.writeFile(wb, `d365-export-${new Date().toISOString().split('T')[0]}.xlsx`);
  toast.success(`Exported ${claimed.length} claimed leads (${rows.length} rows)`);

  // Audit
  await supabase.from('audit_log').insert({
    actor: 'user', action: 'export_claimed',
    entity_type: 'lead_queue',
    details: { count: claimed.length, rows: rows.length },
  });
}

export default function LeadQueue() {
  const { data: leads = [], isLoading } = useLeadQueue();
  const runScoring = useRunScoring();
  const claimLead = useClaimLead();
  const rejectLead = useRejectLead();
  const markUploaded = useMarkUploaded();
  const [selectedLead, setSelectedLead] = useState<LeadWithAccount | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const handleView = (lead: LeadWithAccount) => { setSelectedLead(lead); setDrawerOpen(true); };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === leads.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(leads.map(l => l.id)));
  };

  const allSelected = leads.length > 0 && selectedIds.size === leads.length;

  const handleMarkUploaded = () => {
    const claimedIds = leads
      .filter(l => selectedIds.has(l.id) && (l as any).claim_status === 'claimed')
      .map(l => l.id);
    if (claimedIds.length === 0) { toast.info('Select claimed leads to mark as uploaded'); return; }
    markUploaded.mutate(claimedIds);
    setSelectedIds(new Set());
  };

  const handleClaim = (lead: LeadWithAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    const primaryContact = undefined; // Will be detected from contacts
    claimLead.mutate({
      leadId: lead.id,
      contactTitle: undefined,
      accountIndustry: lead.account.industry || undefined,
    });
  };

  const handleReject = (leadId: string, reason: string) => {
    rejectLead.mutate({ leadId, reason });
    setRejectingId(null);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lead Queue</h1>
            <p className="text-sm text-muted-foreground">
              Today's ranked leads — {leads.length} companies · Claim → Export → Upload → Campaign
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => runScoring.mutate(false)} disabled={runScoring.isPending}>
              {runScoring.isPending ? <Loader2 size={16} className="mr-1 animate-spin" /> : null}
              Run Scoring
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportClaimedExcel(leads)}>
              <Download size={16} className="mr-1" /> Export Claimed → Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleMarkUploaded} disabled={markUploaded.isPending || selectedIds.size === 0}>
              {markUploaded.isPending ? <Loader2 size={16} className="mr-1 animate-spin" /> : <CheckCircle2 size={16} className="mr-1" />}
              Mark as Uploaded
            </Button>
          </div>
        </div>

        <StarsLegend />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead className="w-28">Priority</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead className="w-20">Emp.</TableHead>
                  <TableHead className="w-16">Region</TableHead>
                  <TableHead>Signals</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={16} /> Loading leads...</TableCell></TableRow>
                ) : leads.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No leads yet. Click "Run Scoring" to generate today's queue.</TableCell></TableRow>
                ) : (
                  leads.map((lead) => {
                    const claimStatus = (lead as any).claim_status || 'new';
                    return (
                      <TableRow
                        key={lead.id}
                        className={`cursor-pointer ${selectedIds.has(lead.id) ? 'bg-accent/50' : ''}`}
                        onClick={() => toggleSelect(lead.id)}
                      >
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{lead.priority_rank}</TableCell>
                        <TableCell><DualStarsBadge lead={lead} /></TableCell>
                        <TableCell className="font-medium text-foreground">{lead.account.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{lead.account.industry || '—'}</TableCell>
                        <TableCell className="text-foreground">{lead.account.employee_count || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{lead.account.geography_bucket}</Badge></TableCell>
                        <TableCell className="max-w-[220px]"><SignalChips chips={buildChipsFromTriggers(lead.account.triggers)} /></TableCell>
                        <TableCell><LeadStatusBadge status={claimStatus} /></TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {claimStatus === 'new' && (
                              <>
                                <Button variant="default" size="sm" className="h-7 text-xs px-2" onClick={(e) => handleClaim(lead, e)} disabled={claimLead.isPending}>
                                  Claim
                                </Button>
                                {rejectingId === lead.id ? (
                                  <Select onValueChange={(v) => handleReject(lead.id, v)}>
                                    <SelectTrigger className="h-7 w-24 text-[10px]">
                                      <SelectValue placeholder="Reason" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {REJECT_REASONS.map(r => (
                                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setRejectingId(lead.id)}>
                                    <X size={14} />
                                  </Button>
                                )}
                              </>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleView(lead)}>
                              <Eye size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <AccountDrawer lead={selectedLead} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </Layout>
  );
}
