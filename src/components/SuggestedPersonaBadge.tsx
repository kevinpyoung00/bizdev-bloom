import { Badge } from '@/components/ui/badge';
import { Target, Linkedin, Search, ExternalLink } from 'lucide-react';
import { recommendPersona, buildTitleKeywords, type PersonaRecommendation } from '@/lib/personaRecommend';
import { Button } from '@/components/ui/button';

interface Props {
  employeeCount: number | null | undefined;
  industryKey: string | null | undefined;
  signals?: any;
  companyName?: string;
  zywaveId?: string | null;
  /** compact = inline chips for table rows; full = labeled block */
  variant?: 'compact' | 'full';
}

function buildSearchLinks(rec: PersonaRecommendation, companyName: string) {
  const titleKw = buildTitleKeywords(rec);

  // LinkedIn People Search — direct URL
  const linkedInHref = `https://www.linkedin.com/search/results/people/?company=${encodeURIComponent(companyName)}&keywords=${encodeURIComponent(titleKw)}`;

  // Sales Navigator — direct search URL
  const salesNavHref = `https://www.linkedin.com/sales/search/people?query=${encodeURIComponent('company:' + companyName + ' titles:' + titleKw)}`;

  // ZoomInfo — direct search URL
  const zoomInfoHref = `https://www.zoominfo.com/search?search_query=${encodeURIComponent(companyName)}`;

  return { linkedInHref, salesNavHref, zoomInfoHref };
}

function QuickSearchLinks({ rec, companyName, zywaveId }: { rec: PersonaRecommendation; companyName: string; zywaveId?: string | null }) {
  const { linkedInHref, salesNavHref, zoomInfoHref } = buildSearchLinks(rec, companyName);
  const zywaveHref = zywaveId ? `https://app.zywave.com/company/${zywaveId}` : null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-muted-foreground font-medium">Quick Search:</span>
      <a href={linkedInHref} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
          <Linkedin size={10} /> LinkedIn
        </Button>
      </a>
      <a href={salesNavHref} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
          <Search size={10} /> Sales Nav
        </Button>
      </a>
      <a href={zoomInfoHref} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
          <ExternalLink size={10} /> ZoomInfo
        </Button>
      </a>
      {zywaveHref && (
        <a href={zywaveHref} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
          <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
            <ExternalLink size={10} /> Zywave
          </Button>
        </a>
      )}
    </div>
  );
}

export default function SuggestedPersonaBadge({ employeeCount, industryKey, signals, companyName, zywaveId, variant = 'compact' }: Props) {
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
        <span className="text-xs font-semibold text-foreground">Suggested Persona To Look Up on LinkedIn</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="default" className="text-[10px]">{rec.primary}</Badge>
        {rec.alternates.map((alt) => (
          <Badge key={alt} variant="outline" className="text-[10px]">{alt}</Badge>
        ))}
      </div>
      <div>
        <span className="text-[10px] text-muted-foreground font-medium">Recommended Titles: </span>
        <span className="text-[10px] text-foreground">{rec.recommendedTitles.join(', ')}</span>
      </div>
      {companyName && <QuickSearchLinks rec={rec} companyName={companyName} zywaveId={zywaveId} />}
    </div>
  );
}
