import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, TrendingUp, MapPin, Globe, Users, Download, Play, Loader2, Send, Check } from 'lucide-react';
import { useLeadQueue, useLeadStats, useRunScoring } from '@/hooks/useLeadEngine';
import { useCOIQueue } from '@/hooks/useCOIEngine';
import { signalSummary, getStars, starsDisplay, starsColor, starsLabel } from '@/lib/leadPriority';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

function StarsBadge({ stars }: { stars: 1 | 2 | 3 }) {
  return <span className={`text-sm font-bold tracking-wide ${starsColor(stars)}`} title={starsLabel(stars)}>{starsDisplay(stars)}</span>;
}

export default function LeadDashboard() {
  const { data: stats } = useLeadStats();
  const { data: leads = [] } = useLeadQueue();
  const { data: coiQueue = [] } = useCOIQueue();
  const runScoring = useRunScoring();
  const [exporting, setExporting] = useState(false);
  const [pushing, setPushing] = useState(false);
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
    if (selectedIds.size === top10.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(top10.map(l => l.id)));
    }
  };

  const allSelected = top10.length > 0 && selectedIds.size === top10.length;

  const handleExport = async () => {
    if (leads.length === 0) { toast.info('No leads to export'); return; }
    setExporting(true);
    try {
      // Fetch contacts for all lead accounts
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
            Score: lead.score,
            Company: lead.account.name,
            Domain: lead.account.domain || '',
            Industry: lead.account.industry || '',
            Employees: lead.account.employee_count || '',
            City: lead.account.hq_city || '',
            State: lead.account.hq_state || '',
            Region: lead.account.geography_bucket || '',
            'Contact First': '', 'Contact Last': '', Title: '', Email: '', Phone: '', LinkedIn: '',
          });
        } else {
          for (const c of acctContacts) {
            rows.push({
              Rank: lead.priority_rank,
              Score: lead.score,
              Company: lead.account.name,
              Domain: lead.account.domain || '',
              Industry: lead.account.industry || '',
              Employees: lead.account.employee_count || '',
              City: lead.account.hq_city || '',
              State: lead.account.hq_state || '',
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
      const { error } = await supabase
        .from('lead_queue')
        .update({ status: 'pushed' } as any)
        .in('id', idsToPush);
      if (error) throw error;
      toast.success(`Pushed ${idsToPush.length} lead${idsToPush.length > 1 ? 's' : ''} to CRM`);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e.message || 'Push to CRM failed');
    } finally {
      setPushing(false);
    }
  };

  const tiles = [
    { label: "Today's 50", value: stats?.total?.toString() || '0', icon: Target, color: 'text-primary' },
    { label: 'Avg Priority Score', value: stats?.avg?.toString() || '—', icon: TrendingUp, color: 'text-primary' },
    { label: 'MA', value: stats?.ma?.toString() || '0', icon: MapPin, color: 'text-primary' },
    { label: 'NE', value: stats?.ne?.toString() || '0', icon: MapPin, color: 'text-primary' },
    { label: 'National', value: stats?.us?.toString() || '0', icon: Globe, color: 'text-primary' },
    { label: "Today's COIs", value: coiQueue.length.toString(), icon: Users, color: 'text-primary' },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header: Title + subtitle spanning full width */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lead Engine Dashboard</h1>
          <p className="text-sm text-muted-foreground">MA-first daily lead generation — Priority Outreach Score · {leads.length} leads scored today</p>
        </div>

        {/* Action buttons row */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => runScoring.mutate(false)}
            disabled={runScoring.isPending}
          >
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

        {/* Stats tiles */}
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

        {/* Top 10 leads table */}
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
                    <TableHead className="w-16">Priority</TableHead>
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
                      <TableCell><StarsBadge stars={getStars(lead.reason, lead.account.triggers)} /></TableCell>
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
