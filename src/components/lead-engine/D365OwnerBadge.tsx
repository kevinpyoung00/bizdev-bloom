import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck } from 'lucide-react';

interface Props {
  ownerName?: string | null;
  className?: string;
}

export default function D365OwnerBadge({ ownerName, className = '' }: Props) {
  if (ownerName) {
    return (
      <Badge variant="outline" className={`text-[10px] gap-1 bg-warning/10 text-warning border-warning/30 ${className}`}>
        <ShieldCheck size={10} /> Owned in D365 by {ownerName}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={`text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ${className}`}>
      <Shield size={10} /> Unclaimed in D365
    </Badge>
  );
}
