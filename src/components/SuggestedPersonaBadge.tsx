import { Badge } from '@/components/ui/badge';
import { Target, Search, ExternalLink } from 'lucide-react';
import { recommendPersona, buildTitleKeywords, type PersonaRecommendation } from '@/lib/personaRecommend';
import { Button } from '@/components/ui/button';

interface Props {
  employeeCount: number | null | undefined;
  industryKey: string | null | undefined;
  signals?: any;
  companyName?: string;
  zywaveId?: string | null;
  hqState?: string | null;
  /** compact = inline chips for table rows; full = labeled block */
  variant?: 'compact' | 'full';
}

function buildSalesNavUrl(companyName: string, titles: string[]): string {
  const keywords = companyName + ' ' + titles.join(' ');
  return `https://www.linkedin.com/sales/search/people?keywords=${encodeURIComponent(keywords)}`;
}

function buildZywaveSearchUrl(companyName: string, state?: string | null): string {
  const q = state ? `${companyName} ${state}` : companyName;
  return `https://app.zywave.com/search?query=${encodeURIComponent(q)}`;
}

function QuickSearchLinks({ rec, companyName, zywaveId, hqState }: { rec: PersonaRecommendation; companyName: string; zywaveId?: string | null; hqState?: string | null }) {
  const primarySalesNav = buildSalesNavUrl(companyName, [rec.primary]);
  const backupTitles = rec.alternates.slice(0, 2);
  const backupSalesNav = backupTitles.length > 0 ? buildSalesNavUrl(companyName, backupTitles) : null;
  const zywaveHref = zywaveId
    ? `https://app.zywave.com/search?query=${encodeURIComponent(zywaveId)}`
    : buildZywaveSearchUrl(companyName, hqState);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-foreground">{rec.primary}</span>
        <a href={primarySalesNav} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
          <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
            <Search size={10} /> Open SalesNav — {rec.primary}
          </Button>
        </a>
      </div>
      {backupTitles.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">{backupTitles[0]}</span>
          <a href={backupSalesNav!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
              <Search size={10} /> Open SalesNav — {backupTitles[0]}
            </Button>
          </a>
        </div>
      )}
      <a href={zywaveHref} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
          <ExternalLink size={10} /> {zywaveId ? 'Open Zywave' : 'Search Zywave'}
        </Button>
      </a>
    </div>
  );
}

export default function SuggestedPersonaBadge({ employeeCount, industryKey, signals, companyName, zywaveId, hqState, variant = 'compact' }: Props) {
  const rec = recommendPersona(employeeCount, industryKey, signals);

  if (variant === 'compact') {
    return (
      <div className="space-y-0.5" title="Suggested Persona To Look Up on LinkedIn">
        <span className="inline-flex items-center gap-1 text-[10px]">
          <Target size={10} className="text-primary shrink-0" />
          <span className="text-foreground font-medium truncate max-w-[120px]">{rec.primary}</span>
          {rec.alternates.length > 0 && (
            <span className="text-muted-foreground">+{rec.alternates.length}</span>
          )}
        </span>
        <p className="text-[9px] text-muted-foreground truncate max-w-[160px]">
          {rec.recommendedTitles.slice(0, 3).join(', ')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Target size={12} className="text-primary" />
        <span className="text-xs font-semibold text-foreground">Suggested Persona</span>
      </div>
      {companyName && <QuickSearchLinks rec={rec} companyName={companyName} zywaveId={zywaveId} hqState={hqState} />}
    </div>
  );
}
