import { Badge } from '@/components/ui/badge';
import {
  getSignalStars, computeReachStars, signalStarsDisplay,
  getPriorityLabel, priorityBadgeColor,
} from '@/lib/leadPriority';
import type { LeadWithAccount } from '@/hooks/useLeadEngine';

export function DualStarsBadge({ lead }: { lead: LeadWithAccount }) {
  const signalStars = getSignalStars(lead.reason, lead.account.triggers);
  const reachStars = computeReachStars(undefined, lead.reason);
  const priority = getPriorityLabel(signalStars);
  const reachFilled = "★".repeat(reachStars) + "☆".repeat(3 - reachStars);
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-sm font-bold tracking-wide" style={{ color: '#FFA500' }} title={`Signals: ${signalStars}`}>
        {signalStarsDisplay(signalStars)}
      </span>
      <span className="text-sm font-bold tracking-wide" style={{ color: '#1E90FF' }} title={`Reach: ${reachStars}`}>
        {reachFilled}
      </span>
      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 mt-0.5 ${priorityBadgeColor(priority)}`}>
        {priority.toUpperCase()}
      </Badge>
    </div>
  );
}

export function StarsLegend() {
  return (
    <div className="flex items-center gap-6 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold" style={{ color: '#FFA500' }}>★</span>
        <span>Signal Strength</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold" style={{ color: '#1E90FF' }}>★</span>
        <span>Contact Reach</span>
      </div>
    </div>
  );
}
