import Layout from '@/components/crm/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, TrendingUp, MapPin, Globe, Users, Download, Play, Loader2 } from 'lucide-react';
import { useLeadQueue, useLeadStats, useRunScoring } from '@/hooks/useLeadEngine';
import { getTopTrigger } from '@/components/lead-engine/AccountDrawer';
import { Link } from 'react-router-dom';

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-success/15 text-success' : score >= 70 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{score}</span>;
}

export default function LeadDashboard() {
  const { data: stats } = useLeadStats();
  const { data: leads = [] } = useLeadQueue();
  const runScoring = useRunScoring();
  const top10 = leads.slice(0, 10);

  const tiles = [
    { label: "Today's 50", value: stats?.total?.toString() || '0', icon: Target, color: 'text-primary' },
    { label: 'Avg Score', value: stats?.avg?.toString() || '—', icon: TrendingUp, color: 'text-success' },
    { label: 'MA', value: stats?.ma?.toString() || '0', icon: MapPin, color: 'text-info' },
    { label: 'NE', value: stats?.ne?.toString() || '0', icon: MapPin, color: 'text-warning' },
    { label: 'National', value: stats?.us?.toString() || '0', icon: Globe, color: 'text-hot' },
    { label: "COIs", value: '0', icon: Users, color: 'text-accent-foreground' },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lead Engine Dashboard</h1>
            <p className="text-sm text-muted-foreground">MA-first daily lead generation</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => runScoring.mutate(false)}
              disabled={runScoring.isPending}
            >
              {runScoring.isPending ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Play size={16} className="mr-1" />}
              Run Scoring Now
            </Button>
            <Button variant="outline" size="sm">
              <Download size={16} className="mr-1" /> Export Today's 50
            </Button>
            <Button size="sm" variant="secondary">Push All to CRM</Button>
          </div>
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
                    <TableHead className="w-14">#</TableHead>
                    <TableHead className="w-16">Score</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="w-20">Emp.</TableHead>
                    <TableHead className="w-16">Geo</TableHead>
                    <TableHead>Top Trigger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top10.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium text-foreground">{lead.priority_rank}</TableCell>
                      <TableCell><ScoreBadge score={lead.score} /></TableCell>
                      <TableCell className="font-medium text-foreground">{lead.account.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">{lead.account.industry || '—'}</TableCell>
                      <TableCell className="text-foreground">{lead.account.employee_count || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{lead.account.geography_bucket}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{getTopTrigger(lead.account.triggers)}</TableCell>
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
