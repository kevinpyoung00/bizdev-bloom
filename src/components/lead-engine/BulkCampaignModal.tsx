import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: string[];
  onComplete: () => void;
}

export default function BulkCampaignModal({ open, onOpenChange, selectedLeadIds, onComplete }: Props) {
  const queryClient = useQueryClient();
  const [campaignId, setCampaignId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ added: number } | null>(null);

  // Get CRM campaigns from localStorage
  const campaigns = (() => {
    try {
      const raw = localStorage.getItem('crm_campaigns');
      if (!raw) return [];
      return JSON.parse(raw) as { id: string; name: string }[];
    } catch { return []; }
  })();

  const handleAdd = async () => {
    if (!campaignId) { toast.error('Select a campaign'); return; }
    setProcessing(true);
    try {
      // Get the lead_queue rows to find account_ids
      const { data: leads } = await supabase.from('lead_queue').select('id, account_id').in('id', selectedLeadIds);
      if (!leads || leads.length === 0) { toast.error('No leads found'); return; }

      const accountIds = leads.map(l => l.account_id).filter(Boolean) as string[];

      // Get contacts for these accounts with their trigger_profile and campaign_batch_id
      const { data: contacts } = await supabase.from('contacts_le')
        .select('id, first_name, last_name, email, trigger_profile, campaign_batch_id, account_id')
        .in('account_id', accountIds);

      if (!contacts || contacts.length === 0) { toast.error('No contacts found for selected leads'); setProcessing(false); return; }

      // Snapshot: save campaign membership via message_snapshots (reusing existing table)
      const snapshots = contacts.map(c => ({
        account_id: c.account_id,
        contact_id: c.id,
        channel: 'campaign_membership',
        body: JSON.stringify({
          campaign_id: campaignId,
          trigger_profile_snapshot: c.trigger_profile,
          campaign_batch_id: c.campaign_batch_id,
          added_at: new Date().toISOString(),
        }),
        week_number: 0,
        persona: null,
        industry_key: null,
      }));

      const { error } = await supabase.from('message_snapshots').insert(snapshots as any);
      if (error) throw error;

      // Update lead_queue status to in_campaign
      await supabase.from('lead_queue')
        .update({ claim_status: 'in_campaign', status: 'in_campaign' } as any)
        .in('id', selectedLeadIds);

      setResult({ added: contacts.length });
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      toast.success(`${contacts.length} contacts added to campaign`);

      await supabase.from('audit_log').insert({
        actor: 'user', action: 'bulk_add_campaign', entity_type: 'contacts_le',
        details: { campaign_id: campaignId, contacts: contacts.length, leads: selectedLeadIds.length },
      });
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setCampaignId('');
    onOpenChange(false);
    if (result) onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={20} className="text-primary" /> Add to Campaign
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-primary" />
            <p className="text-sm text-foreground font-medium">Added to campaign</p>
            <p className="text-xs text-muted-foreground">{result.added} contacts with trigger profiles preserved</p>
            <Button size="sm" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add <Badge variant="secondary" className="text-[10px]">{selectedLeadIds.length} leads</Badge> to a 12-week drip campaign. Trigger profiles and batch IDs will be snapshotted.
            </p>

            {campaigns.length > 0 ? (
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign…" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3">
                No campaigns found. Create a campaign first from the Campaigns page, or contacts will be marked as "In Campaign" directly.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={processing}>
                {processing ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                {campaigns.length > 0 ? 'Add to Campaign' : 'Mark In Campaign'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
