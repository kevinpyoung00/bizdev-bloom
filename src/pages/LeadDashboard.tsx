import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, TrendingUp, MapPin, Globe, Users, Download, Play, Loader2, Send } from 'lucide-react';
import { useLeadQueue, useLeadStats, useRunScoring } from '@/hooks/useLeadEngine';
import { useCOIQueue } from '@/hooks/useCOIEngine';
import {
  signalSummary, getSignalStars, computeReachStars, signalStarsDisplay,
  getPriorityLabel, priorityBadgeColor
} from '@/lib/leadPriority';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { useCrm } from '@/store/CrmContext';
import type { RolePersona } from '@/types/crm';

function DualStarsBadge({ lead }: { lead: any }) {
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

export default function LeadDashboard() {
  const { data: stats } = useLeadStats();
  const { data: leads = [] } = useLeadQueue();
  const { data: coiQueue = [] } = useCOIQueue();
  const runScoring = useRunScoring();
  const [exporting, setExporting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const { addContact, contacts: crmContacts } = useCrm();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const top10 = leads.slice(0, 10);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === top10.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(top10.map(l => l.id)));
  };

  const allSelected = top10.length > 0 && selectedIds.size === top10.length;

  const handleExport = async () => {
    if (leads.length === 0) { toast.info('No leads to export'); return; }
    setExporting(true);
    try {
      const accountIds = leads.map(l => l.account.id);
      const { data: contacts } = await supabase.from('contacts_le').select('*').in('account_id', accountIds);
      const contactsByAccount = new Map<string, any[]>();
      for (const c of contacts || []) {
        if (!c.account_id) continue;
        if (!contactsByAccount.has(c.account_id)) contactsByAccount.set(c.account_id, []);
        contactsByAccount.get(c.account_id)!.push(c);
      }

      const rows: any[] = [];
      for (const lead of leads) {
        const acctContacts = contactsByAccount.get(lead.account.id) || [];
        if (acctContacts.length === 0) {
          rows.push({
            Rank: lead.priority_rank,
            'Signal Stars': getSignalStars(lead.reason, lead.account.triggers),
            'Reach Stars': computeReachStars(undefined, lead.reason),
            Priority: getPriorityLabel(getSignalStars(lead.reason, lead.account.triggers)),
            Company: lead.account.name, Domain: lead.account.domain || '',
            Industry: lead.account.industry || '', Employees: lead.account.employee_count || '',
            City: lead.account.hq_city || '', State: lead.account.hq_state || '',
            Region: lead.account.geography_bucket || '',
            'Contact First': '', 'Contact Last': '', Title: '', Email: '', Phone: '', LinkedIn: '',
          });
        } else {
          for (const c of acctContacts) {
            rows.push({
              Rank: lead.priority_rank,
              'Signal Stars': getSignalStars(lead.reason, lead.account.triggers),
              'Reach Stars': computeReachStars(undefined, lead.reason),
              Priority: getPriorityLabel(getSignalStars(lead.reason, lead.account.triggers)),
              Company: lead.account.name, Domain: lead.account.domain || '',
              Industry: lead.account.industry || '', Employees: lead.account.employee_count || '',
              City: lead.account.hq_city || '', State: lead.account.hq_state || '',
              Region: lead.account.geography_bucket || '',
              'Contact First': c.first_name, 'Contact Last': c.last_name,
              Title: c.title || '', Email: c.email || '', Phone: c.phone || '',
              LinkedIn: c.linkedin_url || '',
            });
          }
        }
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads');
      XLSX.writeFile(wb, `lead-queue-${new Date().toISOString().split('T')[0]}.csv`);
      toast.success(`Exported ${leads.length} leads (${rows.length} rows)`);
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handlePushToCRM = async () => {
    const idsToPush = selectedIds.size > 0 ? Array.from(selectedIds) : leads.map(l => l.id);
    if (idsToPush.length === 0) { toast.info('No leads selected'); return; }
    setPushing(true);
    try {
      const selectedLeads = leads.filter(l => idsToPush.includes(l.id));
      const accountIds = selectedLeads.map(l => l.account.id);
      const { data: leContacts } = await supabase.from('contacts_le').select('*').in('account_id', accountIds);

      let created = 0;
      for (const lead of selectedLeads) {
        const acctContacts = (leContacts || []).filter(c => c.account_id === lead.account.id);
        if (acctContacts.length === 0) {
          const exists = crmContacts.some(c => c.company.toLowerCase() === lead.account.name.toLowerCase() && c.email === '');
          if (!exists) {
            const today = new Date().toISOString().split('T')[0];
            addContact({ firstName: lead.account.name.split(' ')[0] || 'Unknown', lastName: lead.account.name.split(' ').slice(1).join(' ') || 'Contact', company: lead.account.name, title: '', rolePersona: 'Other', industry: lead.account.industry || '', employeeCount: lead.account.employee_count?.toString() || '', email: '', linkedInUrl: '', phone: '', source: 'ZoomInfo', renewalMonth: '', campaignId: '', status: 'Unworked', startDate: today, notes: `Pushed from Lead Engine. Domain: ${lead.account.domain || 'N/A'}` });
            created++;
          }
        } else {
          for (const c of acctContacts) {
            if (c.email && crmContacts.some(crm => crm.email.toLowerCase() === c.email!.toLowerCase())) continue;
            const today = new Date().toISOString().split('T')[0];
            const t = `${(c.title || '').toLowerCase()} ${(c.department || '').toLowerCase()}`;
            let role: RolePersona = 'Other';
            if (t.includes('ceo')) role = 'CEO'; else if (t.includes('cfo')) role = 'CFO'; else if (t.includes('coo')) role = 'COO'; else if (t.includes('chro')) role = 'CHRO'; else if (t.includes('founder')) role = 'Founder'; else if (t.includes('hr') || t.includes('people')) role = 'HR'; else if (t.includes('benefit')) role = 'Benefits Leader'; else if (t.includes('finance')) role = 'Finance'; else if (t.includes('ops')) role = 'Ops';
            addContact({ firstName: c.first_name, lastName: c.last_name, company: lead.account.name, title: c.title || '', rolePersona: role, industry: lead.account.industry || '', employeeCount: lead.account.employee_count?.toString() || '', email: c.email || '', linkedInUrl: c.linkedin_url || '', phone: c.phone || '', source: 'ZoomInfo', renewalMonth: '', campaignId: '', status: 'Unworked', startDate: today, notes: `Pushed from Lead Engine. Domain: ${lead.account.domain || 'N/A'}` });
            created++;
          }
        }
      }

      const { error } = await supabase.from('lead_queue').update({ status: 'pushed' } as any).in('id', idsToPush);
      if (error) throw error;
      toast.success(`Pushed ${selectedLeads.length} lead${selectedLeads.length > 1 ? 's' : ''} → ${created} contact${created !== 1 ? 's' : ''} added to CRM`);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e.message || 'Push to CRM failed');
    } finally {
      setPushing(false);
    }
  };

  const starCounts = { high: 0, medium: 0, low: 0 };
  for (const lead of leads) {
    const s = getSignalStars(lead.reason, lead.account.triggers);
    if (s === 3) starCounts.high++;
    else if (s === 2) starCounts.medium++;
    else starCounts.low++;
  }

  const tiles = [
    { label: "Today's 50", value: stats?.total?.toString() || '0', icon: Target, color: 'text-primary' },
    { label: '★★★ High', value: starCounts.high.toString(), icon: TrendingUp, color: 'text-orange-500' },
    { label: 'MA', value: stats?.ma?.toString() || '0', icon: MapPin, color: 'text-primary' },
    { label: 'NE', value: stats?.ne?.toString() || '0', icon: MapPin, color: 'text-primary' },
    { label: 'National', value: stats?.us?.toString() || '0', icon: Globe, color: 'text-primary' },
    { label: "Today's COIs", value: coiQueue.length.toString(), icon: Users, color: 'text-primary' },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lead Engine Dashboard</h1>
          <p className="text-sm text-muted-foreground">MA-first daily lead generation — Signal & Reachability Stars · {leads.length} leads scored today</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => runScoring.mutate(false)} disabled={runScoring.isPending}>
            {runScoring.isPending ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Play size={16} className="mr-1" />}
            Run Scoring Now
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || leads.length === 0}>
            {exporting ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Download size={16} className="mr-1" />}
            Export Today's 50
          </Button>
          <Button size="sm" variant="secondary" onClick={handlePushToCRM} disabled={pushing || leads.length === 0}>
            {pushing ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Send size={16} className="mr-1" />}
            Push to CRM{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {tiles.map(tile => (
            <Card key={tile.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <tile.icon size={16} className={tile.color} />
                  <span className="text-xs text-muted-foreground">{tile.label}</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{tile.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <StarsLegend />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Top 10 Leads</CardTitle>
            {leads.length > 0 && (
              <Link to="/lead-queue">
                <Button variant="link" size="sm">View all {leads.length} →</Button>
              </Link>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {top10.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 pb-6">
                No leads generated yet. Click "Run Scoring Now" to generate today's queue.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead className="w-28">Priority</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="w-20">Emp.</TableHead>
                    <TableHead className="w-16">Region</TableHead>
                    <TableHead>Signals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top10.map((lead) => (
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
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">{lead.account.industry || '—'}</TableCell>
                      <TableCell className="text-foreground">{lead.account.employee_count || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{lead.account.geography_bucket}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{signalSummary(lead.account.triggers)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
