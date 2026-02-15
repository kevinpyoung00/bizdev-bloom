import { Badge } from '@/components/ui/badge';
import { Target, Linkedin, Search, ExternalLink } from 'lucide-react';
import { recommendPersona, buildTitleKeywords, type PersonaRecommendation } from '@/lib/personaRecommend';
import { Button } from '@/components/ui/button';

interface Props {
  employeeCount: number | null | undefined;
  industryKey: string | null | undefined;
  signals?: any;
  companyName?: string;
  /** compact = inline chips for table rows; full = labeled block */
  variant?: 'compact' | 'full';
}

function QuickSearchLinks({ rec, companyName }: { rec: PersonaRecommendation; companyName: string }) {
  const titleKw = buildTitleKeywords(rec);
  const linkedInUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(titleKw)}&company=${encodeURIComponent(companyName)}`;
  const salesNavUrl = `https://www.linkedin.com/sales/search/people?query=(company:${encodeURIComponent(companyName)}+title:(${encodeURIComponent(titleKw)}))`;
  const zoomInfoUrl = `https://www.zoominfo.com/search?search_query=${encodeURIComponent(companyName)}`;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-muted-foreground font-medium">Quick Search:</span>
      <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
          <Linkedin size={10} /> LinkedIn
        </Button>
      </a>
      <a href={salesNavUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
          <Search size={10} /> Sales Nav
        </Button>
      </a>
      <a href={zoomInfoUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
          <ExternalLink size={10} /> ZoomInfo
        </Button>
      </a>
    </div>
  );
}

export default function SuggestedPersonaBadge({ employeeCount, industryKey, signals, companyName, variant = 'compact' }: Props) {
  const rec = recommendPersona(employeeCount, industryKey, signals);

  if (variant === 'compact') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px]" title="Suggested Persona To Look Up on LinkedIn">
        <Target size={10} className="text-primary shrink-0" />
        <span className="text-foreground font-medium truncate max-w-[100px]">{rec.primary}</span>
        {rec.alternates.length > 0 && (
          <span className="text-muted-foreground">+{rec.alternates.length}</span>
        )}
      </span>
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
      {companyName && <QuickSearchLinks rec={rec} companyName={companyName} />}
    </div>
  );
}
