import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowRight, Plus } from 'lucide-react';
import { useBatchSendToCampaign } from '@/hooks/useBatchPush';
import { useCrm } from '@/store/CrmContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
}

export default function BatchCampaignDialog({ open, onOpenChange, batchId }: Props) {
  const { campaigns } = useCrm();
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [campaignId, setCampaignId] = useState('');
  const [newName, setNewName] = useState('');
  const { execute, isPending } = useBatchSendToCampaign();

  const handleSend = async () => {
    let name = '';
    if (mode === 'create') {
      if (!newName.trim()) return;
      name = newName.trim();
    } else {
      const found = campaigns.find(c => c.id === campaignId);
      if (!found) return;
      name = found.name;
    }
    await execute(batchId, name);
    setCampaignId('');
    setNewName('');
    onOpenChange(false);
  };

  const canSubmit = mode === 'create' ? newName.trim().length > 0 : campaignId.length > 0;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { setCampaignId(''); setNewName(''); } onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send Batch to Campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            All <strong>claimed</strong> contacts in this batch will be enrolled in the campaign.
          </p>

          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'select' ? 'default' : 'outline'} onClick={() => setMode('select')}>
              Existing
            </Button>
            <Button size="sm" variant={mode === 'create' ? 'default' : 'outline'} onClick={() => setMode('create')}>
              <Plus size={14} className="mr-1" /> New
            </Button>
          </div>

          {mode === 'select' ? (
            campaigns.length > 0 ? (
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign…" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-3">No campaigns yet. Create one.</p>
            )
          ) : (
            <Input
              placeholder="New campaign name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            />
          )}

          <Button
            className="w-full"
            disabled={isPending || !canSubmit}
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
