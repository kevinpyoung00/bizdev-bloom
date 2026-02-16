import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { matchIndustryKey, getIndustryLabel, DEFAULT_INDUSTRIES } from '@/lib/industry';

const SHORT_LABELS: Record<string, string> = {
  biotech_life_sciences: 'Biotech / LifeSci',
  tech_pst: 'Tech / SaaS',
  advanced_mfg_med_devices: 'Adv Mfg / MedDev',
  healthcare_social_assistance: 'Healthcare',
  higher_ed_nonprofit: 'Higher Ed / NPO',
  cannabis: 'Cannabis',
  general_exec: 'General',
};

interface Props {
  industry?: string | null;
}

export default function IndustryChip({ industry }: Props) {
  const key = matchIndustryKey(industry);
  const short = SHORT_LABELS[key] || 'General';
  const full = getIndustryLabel(key) || industry || 'General';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-[10px] max-w-[110px] truncate cursor-default">
            {short}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{full}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
