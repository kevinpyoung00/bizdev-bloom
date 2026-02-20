import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, CheckCircle2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useCrm } from '@/store/CrmContext';
import { mergeTags } from '@/lib/upsertContact';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContactIds: string[];
  onComplete: () => void;
  /** If true, IDs are CRM context contacts (localStorage). Otherwise contacts_le DB IDs. */
  isCrmContacts?: boolean;
}

export default function ContactsCampaignModal({ open, onOpenChange, selectedContactIds, onComplete, isCrmContacts = false }: Props) {
  const queryClient = useQueryClient();
  const { campaigns, contacts: crmContacts, updateContact } = useCrm();
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [campaignId, setCampaignId] = useState('');
  const [newName, setNewName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);

  const handleEnroll = async () => {
    let campaignName = '';
    let selectedCampaignId = '';
    if (mode === 'create') {
      if (!newName.trim()) { toast.error('Enter a campaign name'); return; }
      campaignName = newName.trim();
    } else {
      const found = campaigns.find(c => c.id === campaignId);
      if (!found) { toast.error('Select a campaign'); return; }
      campaignName = found.name;
      selectedCampaignId = found.id;
    }

    setProcessing(true);
    try {
      if (isCrmContacts) {
        // Update CRM context contacts directly
        for (const id of selectedContactIds) {
          updateContact(id, {
            campaignId: selectedCampaignId || campaignName,
          });
        }
        setResult({ count: selectedContactIds.length });
        toast.success(`${selectedContactIds.length} contacts enrolled in "${campaignName}"`);
      } else {
        // DB contacts_le flow
        const { data: contacts } = await supabase
          .from('contacts_le')
          .select('id, match_key, campaign_tags')
          .in('id', selectedContactIds);

        if (!contacts || contacts.length === 0) {
          toast.error('No contacts found');
          setProcessing(false);
          return;
        }

        for (const c of contacts) {
          const existing = ((c as any).campaign_tags || []) as string[];
          const merged = mergeTags(existing, [campaignName]);
          await supabase.from('contacts_le').update({
            campaign_tags: merged as any,
            campaign_batch_id: campaignName,
          } as any).eq('id', c.id);
        }

        const matchKeys = contacts.map(c => (c as any).match_key).filter(Boolean);
        if (matchKeys.length > 0) {
          const { data: contactsWithAccounts } = await supabase
            .from('contacts_le')
            .select('account_id')
            .in('id', selectedContactIds);

          const accountIds = [...new Set((contactsWithAccounts || []).map(c => c.account_id).filter(Boolean))] as string[];
          if (accountIds.length > 0) {
            const { data: leadRows } = await supabase.from('lead_queue')
              .select('id, campaign_tags')
              .in('account_id', accountIds);

            for (const row of leadRows || []) {
              const existing = ((row as any).campaign_tags || []) as string[];
              const merged = mergeTags(existing, [campaignName]);
              await supabase.from('lead_queue').update({
                campaign_tags: merged as any,
              } as any).eq('id', row.id);
            }
          }
        }

        setResult({ count: contacts.length });
        queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
        queryClient.invalidateQueries({ queryKey: ['contacts-le'] });
        queryClient.invalidateQueries({ queryKey: ['campaign-counts'] });
        toast.success(`${contacts.length} contacts enrolled in "${campaignName}"`);
      }

      await supabase.from('audit_log').insert({
        actor: 'user', action: 'contacts_add_campaign',
        entity_type: isCrmContacts ? 'crm_contacts' : 'contacts_le',
        details: { campaign_name: campaignName, count: selectedContactIds.length },
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
    setNewName('');
    setMode('select');
    onOpenChange(false);
    if (result) onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={20} className="text-primary" /> Add to Campaign
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-primary" />
            <p className="text-sm text-foreground font-medium">Enrolled in campaign</p>
            <p className="text-xs text-muted-foreground">{result.count} contacts updated</p>
            <Button size="sm" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enroll {selectedContactIds.length} contact{selectedContactIds.length !== 1 ? 's' : ''} in a campaign.
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
                onKeyDown={e => { if (e.key === 'Enter') handleEnroll(); }}
              />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button size="sm" onClick={handleEnroll} disabled={processing || (mode === 'select' ? !campaignId : !newName.trim())}>
                {processing ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                Enroll
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
