import { useState } from 'react';
import Layout from '@/components/crm/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Send, Eye, Loader2, AlertTriangle, ShieldX } from 'lucide-react';
import { useLeadQueue, useRunScoring } from '@/hooks/useLeadEngine';
import AccountDrawer, { getTopTrigger } from '@/components/lead-engine/AccountDrawer';
import type { LeadWithAccount } from '@/hooks/useLeadEngine';

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-success/15 text-success' : score >= 70 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{score}</span>;
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

export default function LeadQueue() {
  const { data: leads = [], isLoading } = useLeadQueue();
  const runScoring = useRunScoring();
  const [selectedLead, setSelectedLead] = useState<LeadWithAccount | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleView = (lead: LeadWithAccount) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lead Queue</h1>
            <p className="text-sm text-muted-foreground">
              Today's ranked leads — {leads.length} companies scored by Priority Outreach Score
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runScoring.mutate(false)}
              disabled={runScoring.isPending}
            >
              {runScoring.isPending ? <Loader2 size={16} className="mr-1 animate-spin" /> : null}
              Run Scoring
            </Button>
            <Button variant="outline" size="sm">
              <Download size={16} className="mr-1" /> Export CSV
            </Button>
            <Button variant="outline" size="sm">
              <Download size={16} className="mr-1" /> Export Contacts
            </Button>
            <Button size="sm">
              <Send size={16} className="mr-1" /> Push All to CRM
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead className="w-16">Priority</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Domain</TableHead>
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
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="inline animate-spin mr-2" size={16} /> Loading leads...
                    </TableCell>
                  </TableRow>
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      No leads yet. Click "Run Scoring" to generate today's queue.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => {
                    const disposition = (lead.account as any).disposition || 'active';
                    return (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer"
                        onClick={() => handleView(lead)}
                      >
                        <TableCell className="font-medium text-foreground">{lead.priority_rank}</TableCell>
                        <TableCell><ScoreBadge score={lead.score} /></TableCell>
                        <TableCell className="font-medium text-foreground">{lead.account.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{lead.account.domain || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{lead.account.industry || '—'}</TableCell>
                        <TableCell className="text-foreground">{lead.account.employee_count || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{lead.account.geography_bucket}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{getTopTrigger(lead.account.triggers)}</TableCell>
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
