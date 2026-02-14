import { Badge } from '@/components/ui/badge';
import type { ClaimStatus } from '@/hooks/useLeadActions';
import { CLAIM_STATUS_LABELS } from '@/hooks/useLeadActions';

const statusStyles: Record<ClaimStatus, string> = {
  new: 'bg-muted text-muted-foreground border-border',
  claimed: 'bg-warning/15 text-warning border-warning/30',
  uploaded: 'bg-info/15 text-info border-info/30',
  in_campaign: 'bg-success/15 text-success border-success/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function LeadStatusBadge({ status }: { status: string }) {
  const s = (status || 'new') as ClaimStatus;
  return (
    <Badge variant="outline" className={`text-[10px] whitespace-nowrap ${statusStyles[s] || statusStyles.new}`}>
      {CLAIM_STATUS_LABELS[s] || status}
    </Badge>
  );
}
