import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Users, CheckCircle2, Plus, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useCrm } from '@/store/CrmContext';
import { mergeTags } from '@/lib/upsertContact';
import type { TriggerTag } from '@/types/bizdev';

const DEFAULT_TRIGGERS = [
  'New leadership',
  'Hiring surge',
  'Recent funding',
  'Expansion',
  'Renewal window',
  'Competitor movement',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: string[];
  onComplete: () => void;
}

export default function BulkCampaignModal({ open, onOpenChange, selectedLeadIds, onComplete }: Props) {
  const queryClient = useQueryClient();
  const { campaigns, addCampaign } = useCrm();
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [campaignId, setCampaignId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ added: number } | null>(null);

  // New campaign fields
  const [newName, setNewName] = useState('');
  const [selectedTriggers, setSelectedTriggers] = useState<Set<string>>(new Set());
  const [customTrigger, setCustomTrigger] = useState('');
  const [customTriggers, setCustomTriggers] = useState<string[]>([]);

  // Load custom triggers from DB
  const { data: dbTriggers = [] } = useQuery({
    queryKey: ['trigger-dictionary'],
    queryFn: async () => {
      const { data } = await supabase.from('trigger_dictionary').select('label').eq('is_custom', true);
      return (data || []).map((t: any) => t.label as string);
    },
    enabled: open,
  });

  const allTriggerLabels = [...DEFAULT_TRIGGERS, ...dbTriggers.filter(t => !DEFAULT_TRIGGERS.includes(t)), ...customTriggers.filter(c => !DEFAULT_TRIGGERS.includes(c) && !dbTriggers.includes(c))];

  const toggleTrigger = (label: string) => {
    setSelectedTriggers(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const addCustomTrigger = () => {
    const trimmed = customTrigger.trim();
    if (!trimmed || selectedTriggers.has(trimmed) || customTriggers.includes(trimmed)) return;
    setCustomTriggers(prev => [...prev, trimmed]);
    setSelectedTriggers(prev => new Set([...prev, trimmed]));
    setCustomTrigger('');
  };

  const handleAdd = async () => {
    let campaignName = '';

    if (mode === 'create') {
      if (!newName.trim()) { toast.error('Enter a campaign name'); return; }
      campaignName = newName.trim();

      const triggerTags: TriggerTag[] = Array.from(selectedTriggers).map(label => ({
        label,
        source: 'manual' as const,
        category: DEFAULT_TRIGGERS.includes(label) ? 'standard' : 'custom',
      }));

      // Save custom triggers to dictionary
      for (const label of selectedTriggers) {
        if (!DEFAULT_TRIGGERS.includes(label)) {
          await supabase.from('trigger_dictionary').upsert(
            { label, is_custom: true, created_by: 'user' } as any,
            { onConflict: 'label' }
          ).select();
        }
      }

      const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const campaignDisplayName = `${campaignName} — ${timestamp}`;

      addCampaign({
        name: campaignDisplayName,
        type: 'Custom',
        criteria: `Triggers: ${Array.from(selectedTriggers).join(', ')}`,
        industryTags: [],
        sizeTags: [],
        roleTags: Array.from(selectedTriggers),
        cadenceRules: 'LI touch then email 3 days later; advance weekly',
        weeklyPresets: Array.from({ length: 12 }, (_, i) => ({
          week: i + 1, emailTheme: '', linkedInTouch: '', cta: '', asset: '',
        })),
        active: true,
      });

      campaignName = campaignDisplayName;
    } else {
      if (!campaignId) { toast.error('Select a campaign'); return; }
      const found = campaigns.find(c => c.id === campaignId);
      campaignName = found?.name || campaignId;
    }

    setProcessing(true);
    try {
      // Get leads and their contacts
      const { data: leads } = await supabase.from('lead_queue').select('id, account_id, campaign_tags').in('id', selectedLeadIds);
      if (!leads || leads.length === 0) { toast.error('No leads found'); setProcessing(false); return; }

      const accountIds = leads.map(l => l.account_id).filter(Boolean) as string[];

      const { data: contacts } = await supabase.from('contacts_le')
        .select('id, first_name, last_name, email, account_id, campaign_tags')
        .in('account_id', accountIds);

      if (!contacts || contacts.length === 0) { toast.error('No contacts found for selected leads'); setProcessing(false); return; }

      // Update contacts: merge campaign_tags, set pushed_to_crm_at
      for (const c of contacts) {
        const existing = ((c as any).campaign_tags || []) as string[];
        const merged = mergeTags(existing, [campaignName]);
        await supabase.from('contacts_le').update({
          campaign_tags: merged as any,
          pushed_to_crm_at: new Date().toISOString(),
          campaign_batch_id: campaignName,
        } as any).eq('id', c.id);
      }

      // Update leads: merge campaign_tags, set status
      for (const l of leads) {
        const existing = ((l as any).campaign_tags || []) as string[];
        const merged = mergeTags(existing, [campaignName]);
        await supabase.from('lead_queue').update({
          claim_status: 'in_campaign',
          status: 'in_campaign',
          campaign_tags: merged as any,
          pushed_to_crm_at: new Date().toISOString(),
        } as any).eq('id', l.id);
      }

      setResult({ added: contacts.length });
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      toast.success(`${contacts.length} contacts enrolled in "${campaignName}"`);

      await supabase.from('audit_log').insert({
        actor: 'user', action: 'bulk_add_campaign',
        entity_type: 'contacts_le',
        details: { campaign_name: campaignName, contacts: contacts.length, leads: selectedLeadIds.length },
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
    setMode('select');
    setNewName('');
    setSelectedTriggers(new Set());
    setCustomTrigger('');
    setCustomTriggers([]);
    onOpenChange(false);
    if (result) onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={20} className="text-primary" /> Add to Campaign
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-primary" />
            <p className="text-sm text-foreground font-medium">Enrolled in campaign</p>
            <p className="text-xs text-muted-foreground">{result.added} contacts with campaign tags updated</p>
            <Button size="sm" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add <Badge variant="secondary" className="text-[10px]">{selectedLeadIds.length} leads</Badge> to a campaign.
            </p>

            <div className="flex gap-2">
              <Button size="sm" variant={mode === 'select' ? 'default' : 'outline'} onClick={() => setMode('select')}>
                Select Existing
              </Button>
              <Button size="sm" variant={mode === 'create' ? 'default' : 'outline'} onClick={() => setMode('create')}>
                <Plus size={14} className="mr-1" /> Create New
              </Button>
            </div>

            {mode === 'select' ? (
              campaigns.length > 0 ? (
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
                  No campaigns yet. Switch to "Create New" to make one.
                </div>
              )
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Campaign Name *</Label>
                  <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Q1 Florida Tech 50-250"
                    className="mt-1"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag size={14} className="text-primary" />
                    <Label className="text-xs">Campaign Triggers</Label>
                    {selectedTriggers.size > 0 && (
                      <Badge variant="outline" className="text-[9px]">{selectedTriggers.size} selected</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {allTriggerLabels.map(label => (
                      <label
                        key={label}
                        className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
                      >
                        <Checkbox
                          checked={selectedTriggers.has(label)}
                          onCheckedChange={() => toggleTrigger(label)}
                        />
                        <span className="text-foreground">{label}</span>
                        {!DEFAULT_TRIGGERS.includes(label) && (
                          <Badge variant="secondary" className="text-[8px] ml-auto">custom</Badge>
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={customTrigger}
                      onChange={e => setCustomTrigger(e.target.value)}
                      placeholder="Add custom trigger…"
                      className="text-xs h-8"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTrigger())}
                    />
                    <Button size="sm" variant="outline" className="h-8" onClick={addCustomTrigger} disabled={!customTrigger.trim()}>
                      <Plus size={12} />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={processing}>
                {processing ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                {mode === 'create' ? 'Create & Enroll' : 'Enroll in Campaign'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
