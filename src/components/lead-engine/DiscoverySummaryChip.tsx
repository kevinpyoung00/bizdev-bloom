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
  rejected_carrier?: number;
  rejected_hospital?: number;
  rejected_university_lab?: number;
  rejected_pdf?: number;
  rejected_generic?: number;
  rejected_unknown_hq?: number;
  rejected_news_domain?: number;
  rejected_path_only?: number;
  rejected_ecosystem?: number;
  rejected_industry_mismatch?: number;
  rejected_repeat_30d?: number;
  kept_candidates?: number;
  kept_by_subtype?: Record<string, number>;
  kept_by_industry?: Record<string, number>;
  diversity?: { life_sci_pct?: number; life_sci_over_cap?: boolean; subtypes?: Record<string, number>; by_industry?: Record<string, number>; under_represented?: string[]; micro_query_fills?: number };
  errors?: string[];
  preview_candidates?: any[];
}

interface Props {
  data: DiscoverySummaryData | null;
  onViewPreview?: () => void;
}

export default function DiscoverySummaryChip({ data, onViewPreview }: Props) {
  if (!data) return null;

  const hasErrors = (data.errors?.length ?? 0) > 0;
  const totalRejected = (data.rejected_carrier ?? 0) + (data.rejected_hospital ?? 0) +
    (data.rejected_university_lab ?? 0) + (data.rejected_pdf ?? 0) + (data.rejected_generic ?? 0) +
    (data.rejected_news_domain ?? 0) + (data.rejected_path_only ?? 0) + (data.rejected_ecosystem ?? 0) +
    (data.rejected_industry_mismatch ?? 0) + (data.rejected_repeat_30d ?? 0);

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
              Found {data.domains_found ?? 0} · MA {data.hq_MA ?? 0} · NE-HI {data.hq_NE ?? 0} · Created {data.candidates_created ?? 0} · Updated {data.candidates_updated ?? 0} · ICP-Rejected {totalRejected}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[440px]">
            <div className="space-y-1">
              <p>Mode: {data.mode} · Theme: {data.theme}</p>
              <p>Queries: {data.queries_run} · Domains: {data.domains_found}</p>
              <p>Discarded (non-NE): {data.discarded_non_NE ?? 0} · Unknown HQ: {data.rejected_unknown_hq ?? 0}</p>
              <p>Rejected → Carrier: {data.rejected_carrier ?? 0} · Hospital: {data.rejected_hospital ?? 0} · Univ Lab: {data.rejected_university_lab ?? 0}</p>
              <p>News/Media: {data.rejected_news_domain ?? 0} · Article Path: {data.rejected_path_only ?? 0} · Ecosystem: {data.rejected_ecosystem ?? 0}</p>
              <p>PDF: {data.rejected_pdf ?? 0} · Generic: {data.rejected_generic ?? 0} · Industry Mismatch: {data.rejected_industry_mismatch ?? 0} · Repeat 30d: {data.rejected_repeat_30d ?? 0}</p>
              {data.kept_by_subtype && Object.keys(data.kept_by_subtype).length > 0 && (
                <p>Kept → {Object.entries(data.kept_by_subtype).map(([k,v]) => `${k}: ${v}`).join(' · ')}</p>
              )}
              {data.diversity?.life_sci_pct !== undefined && (
                <p>Life Sci %: {data.diversity.life_sci_pct}%</p>
              )}
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
