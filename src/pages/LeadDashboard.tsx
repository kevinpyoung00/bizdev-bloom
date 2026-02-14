import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, TrendingUp, MapPin, Globe, Users, Download, Play, Loader2, Eye } from 'lucide-react';
import { useLeadQueue, useLeadStats, useRunScoring } from '@/hooks/useLeadEngine';
import { useCOIQueue } from '@/hooks/useCOIEngine';
import { signalSummary, getSignalStars } from '@/lib/leadPriority';
import { DualStarsBadge, StarsLegend } from '@/components/lead-engine/DualStarsBadge';
import LeadStatusBadge from '@/components/lead-engine/LeadStatusBadge';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import AccountDrawer from '@/components/lead-engine/AccountDrawer';
import type { LeadWithAccount } from '@/hooks/useLeadEngine';

export default function LeadDashboard() {
  const { data: stats } = useLeadStats();
  const { data: leads = [] } = useLeadQueue();
  const { data: coiQueue = [] } = useCOIQueue();
  const runScoring = useRunScoring();
  const [selectedLead, setSelectedLead] = useState<LeadWithAccount | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const top10 = leads.slice(0, 10);

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
          <p className="text-sm text-muted-foreground">MA-first daily lead generation · Claim → Export → Upload → Campaign</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => runScoring.mutate(false)} disabled={runScoring.isPending}>
            {runScoring.isPending ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Play size={16} className="mr-1" />}
            Run Scoring Now
          </Button>
          <Link to="/lead-queue">
            <Button variant="outline" size="sm"><Target size={16} className="mr-1" /> Open Lead Queue</Button>
          </Link>
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
              <Link to="/lead-queue"><Button variant="link" size="sm">View all {leads.length} →</Button></Link>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {top10.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 pb-6">No leads yet. Click "Run Scoring Now".</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead className="w-28">Priority</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="w-16">Region</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top10.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium text-foreground">{lead.priority_rank}</TableCell>
                      <TableCell><DualStarsBadge lead={lead} /></TableCell>
                      <TableCell className="font-medium text-foreground">{lead.account.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">{lead.account.industry || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{lead.account.geography_bucket}</Badge></TableCell>
                      <TableCell><LeadStatusBadge status={(lead as any).claim_status || 'new'} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{signalSummary(lead.account.triggers)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedLead(lead); setDrawerOpen(true); }}>
                          <Eye size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <AccountDrawer lead={selectedLead} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </Layout>
  );
}
