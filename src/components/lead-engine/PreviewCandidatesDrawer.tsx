import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

export interface PreviewCandidate {
  id: string;
  name: string;
  domain: string;
  hq_state: string | null;
  geography_bucket: string | null;
  high_intent: boolean;
  intent_reasons: string[];
  top_signal: string | null;
  icp_class?: string;
  entity_subtype?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: PreviewCandidate[];
  onProceedToScore?: () => void;
  isScoringPending?: boolean;
  keptBySubtype?: Record<string, number>;
}

const PAGE_SIZE = 15;

const SUBTYPE_LABELS: Record<string, string> = {
  private: 'Private',
  nonprofit: 'Nonprofit',
  municipal: 'Municipal',
  school: 'School',
  bank_cu: 'Bank/CU',
  cannabis: 'Cannabis',
  clinic: 'Clinic',
};

export default function PreviewCandidatesDrawer({ open, onOpenChange, candidates, onProceedToScore, isScoringPending, keptBySubtype }: Props) {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<'name' | 'subtype' | 'state'>('name');
  const [filterSubtype, setFilterSubtype] = useState<string>('all');

  const filtered = useMemo(() => {
    let list = [...candidates];
    if (filterSubtype !== 'all') {
      list = list.filter(c => (c.entity_subtype || 'private') === filterSubtype);
    }
    list.sort((a, b) => {
      if (sortBy === 'subtype') return ((a.entity_subtype || 'private')).localeCompare(b.entity_subtype || 'private');
      if (sortBy === 'state') return (a.hq_state || '').localeCompare(b.hq_state || '');
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [candidates, sortBy, filterSubtype]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const handleFilterChange = (v: string) => { setFilterSubtype(v); setPage(0); };
  const handleSortChange = (v: string) => { setSortBy(v as any); setPage(0); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[640px] sm:max-w-[640px] overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>Preview Candidates ({candidates.length})</SheetTitle>
          <SheetDescription>
            All kept candidates from the most recent discovery run.
          </SheetDescription>
        </SheetHeader>

        {/* Subtype counters */}
        {keptBySubtype && Object.keys(keptBySubtype).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {Object.entries(keptBySubtype).map(([k, v]) => (
              <Badge key={k} variant="secondary" className="text-[10px]">
                {SUBTYPE_LABELS[k] || k}: {v}
              </Badge>
            ))}
          </div>
        )}

        {/* Sort + filter controls */}
        <div className="flex items-center gap-2 mt-2">
          <Select value={filterSubtype} onValueChange={handleFilterChange}>
            <SelectTrigger className="h-7 w-[130px] text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All types</SelectItem>
              {Object.entries(SUBTYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="h-7 w-[120px] text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name" className="text-xs">Name</SelectItem>
              <SelectItem value="subtype" className="text-xs">Type</SelectItem>
              <SelectItem value="state" className="text-xs">HQ State</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {filtered.length} shown · Page {page + 1}/{Math.max(totalPages, 1)}
          </span>
        </div>

        <ScrollArea className="flex-1 -mr-4 pr-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-20">HQ</TableHead>
                <TableHead className="w-24">Top Signal</TableHead>
                <TableHead className="w-16">Intent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {candidates.length === 0 ? 'No candidates yet. Run a discovery first.' : 'No matches for this filter.'}
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground text-sm">{c.name}</span>
                        <a
                          href={`https://${c.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-500 hover:underline flex items-center gap-1"
                          onClick={e => e.stopPropagation()}
                        >
                          {c.domain} <ExternalLink size={10} />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px]">
                        {SUBTYPE_LABELS[c.entity_subtype || 'private'] || c.entity_subtype || 'Private'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {c.hq_state || '?'} / {c.geography_bucket || '?'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.top_signal ? (
                        <Badge variant="secondary" className="text-[10px]">{c.top_signal}</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">none</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.high_intent ? (
                        <Badge className="text-[10px] bg-green-600 text-white">HI</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="ghost" size="sm" className="h-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
            <Button variant="ghost" size="sm" className="h-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={14} />
            </Button>
          </div>
        )}

        {onProceedToScore && candidates.length > 0 && (
          <div className="pt-4 border-t">
            <Button onClick={onProceedToScore} disabled={isScoringPending} className="w-full">
              {isScoringPending ? 'Scoring…' : 'Proceed to Score'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
