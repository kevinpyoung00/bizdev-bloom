import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink } from 'lucide-react';

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
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: PreviewCandidate[];
  onProceedToScore?: () => void;
  isScoringPending?: boolean;
}

export default function PreviewCandidatesDrawer({ open, onOpenChange, candidates, onProceedToScore, isScoringPending }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>Preview Candidates ({candidates.length})</SheetTitle>
          <SheetDescription>
            Last {candidates.length} kept candidates from the most recent discovery run.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mr-4 pr-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="w-24">HQ</TableHead>
                <TableHead className="w-28">Top Signal</TableHead>
                <TableHead className="w-20">Intent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No candidates yet. Run a discovery first.
                  </TableCell>
                </TableRow>
              ) : (
                candidates.map((c) => (
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
