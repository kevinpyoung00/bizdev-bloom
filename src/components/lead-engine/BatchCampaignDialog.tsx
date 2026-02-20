import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRight } from 'lucide-react';
import { useBatchSendToCampaign } from '@/hooks/useBatchPush';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
}

export default function BatchCampaignDialog({ open, onOpenChange, batchId }: Props) {
  const [campaignName, setCampaignName] = useState('');
  const { execute, isPending } = useBatchSendToCampaign();

  const handleSend = async () => {
    if (!campaignName.trim()) return;
    await execute(batchId, campaignName.trim());
    setCampaignName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) setCampaignName(''); onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send Batch to Campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            All <strong>claimed</strong> contacts in this batch will be assigned to the campaign.
          </p>
          <Input
            placeholder="Campaign name or ID"
            value={campaignName}
            onChange={e => setCampaignName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          />
          <Button
            className="w-full"
            disabled={isPending || !campaignName.trim()}
            onClick={handleSend}
          >
            {isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ArrowRight size={16} className="mr-2" />}
            Send to Campaign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
