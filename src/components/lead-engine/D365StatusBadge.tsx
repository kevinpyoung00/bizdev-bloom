import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, ShieldAlert, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

type D365Status = 'unknown' | 'unowned' | 'owned' | 'duplicate_inactive';

const config: Record<D365Status, { icon: typeof Shield; label: string | ((name?: string | null) => string); className: string }> = {
  unknown: {
    icon: HelpCircle,
    label: 'Unknown',
    className: 'bg-muted text-muted-foreground border-border',
  },
  unowned: {
    icon: Shield,
    label: 'Unowned',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  },
  owned: {
    icon: ShieldCheck,
    label: (name) => name ? `Owned · ${name}` : 'Owned',
    className: 'bg-warning/10 text-warning border-warning/30',
  },
  duplicate_inactive: {
    icon: ShieldAlert,
    label: 'Dup/Inactive',
    className: 'bg-warning/10 text-warning border-warning/30',
  },
};

interface Props {
  status?: string | null;
  ownerName?: string | null;
  d365AccountId?: string | null;
  className?: string;
}

export default function D365StatusBadge({ status, ownerName, d365AccountId, className = '' }: Props) {
  const s = (status || 'unknown') as D365Status;
  const c = config[s] || config.unknown;
  const Icon = c.icon;
  const label = typeof c.label === 'function' ? c.label(ownerName) : c.label;

  const tooltipText = s === 'unknown' ? 'Run D365 Check to determine status'
    : s === 'unowned' ? 'Claimable — not owned in D365'
    : s === 'owned' ? `Owned in D365${ownerName ? ` by ${ownerName}` : ''}`
    : 'Duplicate — Inactive (Needs Review)';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 ${className}`}>
            <Badge variant="outline" className={`text-[10px] gap-1 ${c.className}`}>
              <Icon size={10} /> {label}
            </Badge>
            {s === 'owned' && d365AccountId && (
              <a
                href={`https://dynamics.microsoft.com/en-us/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-primary hover:underline"
                onClick={e => e.stopPropagation()}
              >
                Open D365
              </a>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
