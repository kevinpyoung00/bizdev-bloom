import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { BatchMeta } from '@/lib/batchLabel';
import { buildBatchLabel } from '@/lib/batchLabel';

interface BatchChipProps {
  batch: BatchMeta;
  onClick?: (batchId: string) => void;
  isActive?: boolean;
}

export default function BatchChip({ batch, onClick, isActive }: BatchChipProps) {
  const label = buildBatchLabel(batch);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`text-[9px] cursor-pointer whitespace-nowrap transition-colors hover:bg-accent ${
            isActive ? 'bg-accent border-primary text-primary' : ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(batch.batch_id);
          }}
        >
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="text-xs max-w-[320px]">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">ID: {batch.batch_id}</p>
        {batch.source_batch_id && (
          <p className="text-muted-foreground text-[10px]">File: {batch.source_batch_id}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
