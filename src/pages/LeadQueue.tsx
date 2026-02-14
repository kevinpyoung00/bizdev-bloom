import { useState } from 'react';
import Layout from '@/components/crm/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Send, Eye, Loader2, AlertTriangle, ShieldX } from 'lucide-react';
import { useLeadQueue, useRunScoring, useAccountContacts } from '@/hooks/useLeadEngine';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import AccountDrawer from '@/components/lead-engine/AccountDrawer';
import {
  getSignalStars, computeReachStars, signalStarsDisplay,
  getPriorityLabel, priorityBadgeColor, signalSummary
} from '@/lib/leadPriority';
import type { LeadWithAccount } from '@/hooks/useLeadEngine';
import { useCrm } from '@/store/CrmContext';

function DualStarsBadge({ lead }: { lead: LeadWithAccount }) {
  const signalStars = getSignalStars(lead.reason, lead.account.triggers);
  const reachStars = computeReachStars(undefined, lead.reason);
  const priority = getPriorityLabel(signalStars);
  const reachFilled = "★".repeat(reachStars) + "☆".repeat(3 - reachStars);
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-sm font-bold tracking-wide" style={{ color: '#FFA500' }} title={`Signals: ${signalStars}`}>
        {signalStarsDisplay(signalStars)}
      </span>
      <span className="text-sm font-bold tracking-wide" style={{ color: '#1E90FF' }} title={`Reach: ${reachStars}`}>
        {reachFilled}
      </span>
      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 mt-0.5 ${priorityBadgeColor(priority)}`}>
        {priority.toUpperCase()}
      </Badge>
    </div>
  );
}

function StarsLegend() {
  return (
    <div className="flex items-center gap-6 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold" style={{ color: '#FFA500' }}>★</span>
        <span>Signal Strength</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold" style={{ color: '#1E90FF' }}>★</span>
        <span>Contact Reach</span>
      </div>
    </div>
  );
}

function DispositionCell({ disposition }: { disposition: string }) {
  if (disposition === 'active') return <Badge variant="secondary" className="text-[10px]">Active</Badge>;
  if (disposition === 'needs_review') return <Badge variant="outline" className="text-[10px] border-warning text-warning">Review</Badge>;
  if (disposition === 'suppressed') return <Badge variant="destructive" className="text-[10px] gap-1"><ShieldX size={10} />Suppressed</Badge>;
  if (disposition.startsWith('rejected_')) {
    const short = disposition.replace('rejected_', '').replace(/_/g, ' ');
    return <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle size={10} />{short}</Badge>;
  }
  return <Badge variant="secondary" className="text-[10px]">{disposition}</Badge>;
}

async function exportLeadsCsv(leads: LeadWithAccount[]) {
  const rows = leads.map((l) => ({
    Rank: l.priority_rank,
    'Signal Stars': getSignalStars(l.reason, l.account.triggers),
    'Reach Stars': computeReachStars(undefined, l.reason),
    Priority: getPriorityLabel(getSignalStars(l.reason, l.account.triggers)),
    Company: l.account.name, Domain: l.account.domain || '', Industry: l.account.industry || '',
    Employees: l.account.employee_count || '', City: l.account.hq_city || '',
    State: l.account.hq_state || '', Region: l.account.geography_bucket || '',
    Disposition: l.account.disposition || 'active', Signal: signalSummary(l.account.triggers),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  XLSX.writeFile(wb, `lead-queue-${new Date().toISOString().split('T')[0]}.csv`);
  toast.success(`Exported ${rows.length} leads`);
}

async function exportContactsCsv(leads: LeadWithAccount[]) {
  const accountIds = leads.map((l) => l.account.id);
  const { data: contacts } = await supabase.from('contacts_le').select('*, accounts(name, domain)').in('account_id', accountIds);
  if (!contacts || contacts.length === 0) { toast.info('No contacts to export'); return; }
  const rows = contacts.map((c: any) => ({
    'First Name': c.first_name, 'Last Name': c.last_name, Title: c.title || '',
    Department: c.department || '', Email: c.email || '', Phone: c.phone || '',
    LinkedIn: c.linkedin_url || '', Company: c.accounts?.name || '', Domain: c.accounts?.domain || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
  XLSX.writeFile(wb, `lead-contacts-${new Date().toISOString().split('T')[0]}.csv`);
  toast.success(`Exported ${rows.length} contacts`);
}

export default function LeadQueue() {
  const { data: leads = [], isLoading } = useLeadQueue();
  const runScoring = useRunScoring();
  const [selectedLead, setSelectedLead] = useState<LeadWithAccount | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const { addContact, contacts: crmContacts } = useCrm();

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

  const handlePushToCRM = async () => {
    const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : leads.map(l => l.id);
    if (targetIds.length === 0) { toast.info('No leads selected'); return; }
    setPushing(true);
    try {
      const selectedLeads = leads.filter(l => targetIds.includes(l.id));
      const accountIds = selectedLeads.map(l => l.account.id);
      const { data: leContacts } = await supabase.from('contacts_le').select('*').in('account_id', accountIds);

      let created = 0;
      for (const lead of selectedLeads) {
        const acctContacts = (leContacts || []).filter(c => c.account_id === lead.account.id);
        if (acctContacts.length === 0) {
          const existsAlready = crmContacts.some(c => c.company.toLowerCase() === lead.account.name.toLowerCase() && c.email === '');
          if (!existsAlready) {
            const today = new Date().toISOString().split('T')[0];
            addContact({ firstName: lead.account.name.split(' ')[0] || 'Unknown', lastName: lead.account.name.split(' ').slice(1).join(' ') || 'Contact', company: lead.account.name, title: '', rolePersona: 'Other', industry: lead.account.industry || '', employeeCount: lead.account.employee_count?.toString() || '', email: '', linkedInUrl: '', phone: '', source: 'ZoomInfo', renewalMonth: '', campaignId: '', status: 'Unworked', startDate: today, notes: `Pushed from Lead Engine. Domain: ${lead.account.domain || 'N/A'}` });
            created++;
          }
        } else {
          for (const c of acctContacts) {
            const existsAlready = c.email && crmContacts.some(crm => crm.email.toLowerCase() === c.email!.toLowerCase());
            if (existsAlready) continue;
            const today = new Date().toISOString().split('T')[0];
            addContact({ firstName: c.first_name, lastName: c.last_name, company: lead.account.name, title: c.title || '', rolePersona: mapRolePersona(c.title, c.department), industry: lead.account.industry || '', employeeCount: lead.account.employee_count?.toString() || '', email: c.email || '', linkedInUrl: c.linkedin_url || '', phone: c.phone || '', source: 'ZoomInfo', renewalMonth: '', campaignId: '', status: 'Unworked', startDate: today, notes: `Pushed from Lead Engine. Domain: ${lead.account.domain || 'N/A'}` });
            created++;
          }
        }
      }

      const { error } = await supabase.from('lead_queue').update({ status: 'pushed' } as any).in('id', targetIds);
      if (error) throw error;
      toast.success(`Pushed ${selectedLeads.length} lead${selectedLeads.length > 1 ? 's' : ''} → ${created} contact${created !== 1 ? 's' : ''} added to CRM`);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e.message || 'Push to CRM failed');
    } finally {
      setPushing(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lead Queue</h1>
            <p className="text-sm text-muted-foreground">
              Today's ranked leads — {leads.length} companies prioritized by Signal & Reachability Stars
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => runScoring.mutate(false)} disabled={runScoring.isPending}>
              {runScoring.isPending ? <Loader2 size={16} className="mr-1 animate-spin" /> : null}
              Run Scoring
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportLeadsCsv(leads)}>
              <Download size={16} className="mr-1" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportContactsCsv(leads)}>
              <Download size={16} className="mr-1" /> Export Contacts
            </Button>
            <Button size="sm" onClick={handlePushToCRM} disabled={pushing || leads.length === 0}>
              {pushing ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Send size={16} className="mr-1" />}
              Push to CRM{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
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
                  <TableHead className="w-24">Disposition</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={16} /> Loading leads...</TableCell></TableRow>
                ) : leads.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No leads yet. Click "Run Scoring" to generate today's queue.</TableCell></TableRow>
                ) : (
                  leads.map((lead) => {
                    const disposition = lead.account.disposition || 'active';
                    return (
                      <TableRow
                        key={lead.id}
                        className={`cursor-pointer ${selectedIds.has(lead.id) ? 'bg-accent/50' : ''}`}
                        onClick={() => toggleSelect(lead.id)}
                      >
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} aria-label={`Select ${lead.account.name}`} />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{lead.priority_rank}</TableCell>
                        <TableCell><DualStarsBadge lead={lead} /></TableCell>
                        <TableCell className="font-medium text-foreground">{lead.account.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{lead.account.industry || '—'}</TableCell>
                        <TableCell className="text-foreground">{lead.account.employee_count || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{lead.account.geography_bucket}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{signalSummary(lead.account.triggers)}</TableCell>
                        <TableCell><DispositionCell disposition={disposition} /></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleView(lead); }}>
                            <Eye size={14} />
                          </Button>
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

function mapRolePersona(title?: string | null, department?: string | null): import('@/types/crm').RolePersona {
  const t = `${(title || '').toLowerCase()} ${(department || '').toLowerCase()}`;
  if (t.includes('ceo') || t.includes('chief executive')) return 'CEO';
  if (t.includes('cfo') || t.includes('chief financial')) return 'CFO';
  if (t.includes('coo') || t.includes('chief operating')) return 'COO';
  if (t.includes('chro') || t.includes('chief human')) return 'CHRO';
  if (t.includes('founder')) return 'Founder';
  if (t.includes('hr') || t.includes('human resources') || t.includes('people')) return 'HR';
  if (t.includes('benefit')) return 'Benefits Leader';
  if (t.includes('finance') || t.includes('controller') || t.includes('payroll')) return 'Finance';
  if (t.includes('operations') || t.includes('ops')) return 'Ops';
  return 'Other';
}
