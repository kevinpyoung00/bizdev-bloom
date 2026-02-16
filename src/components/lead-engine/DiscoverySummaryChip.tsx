import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { CheckCircle2, AlertTriangle, Eye } from 'lucide-react';

export interface DiscoverySummaryData {
  mode?: string;
  theme?: string;
  queries_run?: number;
  domains_found?: number;
  candidates_created?: number;
  candidates_updated?: number;
  hq_MA?: number;
  hq_NE?: number;
  discarded_non_NE?: number;
  discarded_unknown_HQ?: number;
  kept_candidates?: number;
  errors?: string[];
}

interface Props {
  data: DiscoverySummaryData | null;
  onViewPreview?: () => void;
}

export default function DiscoverySummaryChip({ data, onViewPreview }: Props) {
  if (!data) return null;

  const hasErrors = (data.errors?.length ?? 0) > 0;
  const total = (data.candidates_created ?? 0) + (data.candidates_updated ?? 0);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 flex-wrap">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={hasErrors ? 'destructive' : 'secondary'}
              className="text-[11px] px-3 py-1 cursor-default flex items-center gap-1.5"
            >
              {hasErrors ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
              Discovery: Found {data.domains_found ?? 0} · Kept MA {data.hq_MA ?? 0} · NE-HI {data.hq_NE ?? 0} · Created {data.candidates_created ?? 0} · Updated {data.candidates_updated ?? 0}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[360px]">
            <div className="space-y-1">
              <p>Mode: {data.mode} · Theme: {data.theme}</p>
              <p>Queries: {data.queries_run} · Domains: {data.domains_found}</p>
              <p>Discarded (non-NE): {data.discarded_non_NE ?? 0} · Unknown HQ: {data.discarded_unknown_HQ ?? 0}</p>
              {hasErrors && <p className="text-destructive">Errors: {data.errors?.length}</p>}
            </div>
          </TooltipContent>
        </Tooltip>

        {onViewPreview && (data.kept_candidates ?? 0) > 0 && (
          <Badge
            variant="outline"
            className="text-[11px] px-3 py-1 cursor-pointer hover:bg-accent flex items-center gap-1"
            onClick={onViewPreview}
          >
            <Eye size={12} /> Preview ({data.kept_candidates})
          </Badge>
        )}
      </div>
    </TooltipProvider>
  );
}
