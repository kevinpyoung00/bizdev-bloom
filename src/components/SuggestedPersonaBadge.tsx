import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import { recommendPersona, type PersonaRecommendation } from '@/lib/personaRecommend';

interface Props {
  employeeCount: number | null | undefined;
  industryKey: string | null | undefined;
  signals?: any;
  /** compact = inline chips for table rows; full = labeled block */
  variant?: 'compact' | 'full';
}

export default function SuggestedPersonaBadge({ employeeCount, industryKey, signals, variant = 'compact' }: Props) {
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
    <div className="space-y-1.5">
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
    </div>
  );
}
