import { useState } from 'react';
import Layout from '@/components/crm/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Download, Send, Play, Loader2, Mail, Phone, Linkedin, Eye } from 'lucide-react';
import { useCOIQueue, useRunCOIScoring } from '@/hooks/useCOIEngine';
import { normalizeUrl } from '@/lib/normalizeUrl';
import { openExternal } from '@/lib/openExternal';
import type { COIWithData } from '@/hooks/useCOIEngine';

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-success/15 text-success' : score >= 60 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{score}</span>;
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-10 text-right text-foreground">{value}/{max}</span>
    </div>
  );
}

function COIDrawer({ coi, open, onOpenChange }: { coi: COIWithData | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  if (!coi) return null;
  const r = coi.reason || {};
  const bc = coi.best_contact;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>{coi.coi.name}</span>
            <Badge variant="outline" className="text-primary font-bold">{coi.score}</Badge>
            <Badge variant="secondary">#{coi.priority_rank}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Firm Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Category:</span> <span className="text-foreground">{coi.coi.firm_type || '—'}</span></div>
              <div><span className="text-muted-foreground">Region:</span> <span className="text-foreground">{coi.coi.region || '—'}</span></div>
              <div><span className="text-muted-foreground">Website:</span> <span className="text-foreground">{coi.coi.website || '—'}</span></div>
            </div>
            {coi.coi.notes && <p className="text-xs text-muted-foreground mt-2">{coi.coi.notes}</p>}
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Score Breakdown</h3>
            <div className="space-y-2">
              <ScoreBar label="ICP Adjacency" value={r.category_relevance ?? 0} max={40} />
              <ScoreBar label="Regional Activity" value={r.regional_activity ?? 0} max={45} />
              <ScoreBar label="Warmth / Mutuals" value={r.warmth ?? 0} max={15} />
              <ScoreBar label="Contactability" value={r.contactability ?? 0} max={10} />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Best Contact</h3>
            {bc ? (
              <div className="border border-border rounded-lg p-3">
                <p className="text-sm font-medium text-foreground">{bc.first_name} {bc.last_name}</p>
                <p className="text-xs text-muted-foreground">{bc.title || '—'}</p>
                <div className="flex gap-3 mt-2">
                  {bc.email && <a href={`mailto:${bc.email}`} className="text-xs text-primary flex items-center gap-1"><Mail size={12} /> {bc.email}</a>}
                  {bc.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={12} /> {bc.phone}</span>}
                  {bc.linkedin_url && <button onClick={e => openExternal(bc.linkedin_url, e)} className="text-xs text-primary flex items-center gap-1"><Linkedin size={12} /> LinkedIn</button>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No contacts imported.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="outline"><Mail size={14} className="mr-1" /> Intro Email Draft</Button>
            <Button size="sm"><Send size={14} className="mr-1" /> Push to CRM</Button>
            <Button size="sm" variant="outline"><Download size={14} className="mr-1" /> Export CSV</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function COIQueue() {
  const { data: cois = [], isLoading } = useCOIQueue();
  const runScoring = useRunCOIScoring();
  const [selected, setSelected] = useState<COIWithData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">COI Prospect Queue</h1>
            <p className="text-sm text-muted-foreground">
              Today's {cois.length} Centers of Influence — MA & NE biased
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runScoring.mutate(false)}
              disabled={runScoring.isPending}
            >
              {runScoring.isPending ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Play size={16} className="mr-1" />}
              Run COI Scoring
            </Button>
            <Button variant="outline" size="sm">
              <Download size={16} className="mr-1" /> Export COIs CSV
            </Button>
            <Button size="sm">
              <Send size={16} className="mr-1" /> Push to CRM
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead className="w-16">Score</TableHead>
                  <TableHead>Firm</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Best Contact</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="inline animate-spin mr-2" size={16} /> Loading COIs...
                    </TableCell>
                  </TableRow>
                ) : cois.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No COIs yet. Click "Run COI Scoring" to generate today's queue.
                    </TableCell>
                  </TableRow>
                ) : (
                  cois.map((coi) => (
                    <TableRow key={coi.id} className="cursor-pointer" onClick={() => { setSelected(coi); setDrawerOpen(true); }}>
                      <TableCell className="font-medium text-foreground">{coi.priority_rank}</TableCell>
                      <TableCell><ScoreBadge score={coi.score} /></TableCell>
                      <TableCell className="font-medium text-foreground">{coi.coi.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{coi.coi.firm_type || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{coi.coi.region || '—'}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {coi.best_contact ? `${coi.best_contact.first_name} ${coi.best_contact.last_name}` : '—'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelected(coi); setDrawerOpen(true); }}>
                          <Eye size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <COIDrawer coi={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </Layout>
  );
}
