import { useState } from 'react';
import { useCrm } from '@/store/CrmContext';
import Layout from '@/components/crm/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, Users, Megaphone } from 'lucide-react';
import { Campaign, CampaignType, WeekPreset } from '@/types/crm';
import { useCampaignCounts } from '@/hooks/useCampaignCounts';

const emptyPresets = (): WeekPreset[] => Array.from({ length: 12 }, (_, i) => ({
  week: i + 1, emailTheme: '', linkedInTouch: '', cta: '', asset: '',
}));

export default function Campaigns() {
  const { campaigns, contacts, addCampaign, updateCampaign, deleteCampaign } = useCrm();
  const { getCountFor } = useCampaignCounts();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<CampaignType>('Custom');
  const [criteria, setCriteria] = useState('');
  const [industryTags, setIndustryTags] = useState('');
  const [sizeTags, setSizeTags] = useState('');
  const [roleTags, setRoleTags] = useState('');
  const [cadenceRules, setCadenceRules] = useState('LI touch then email 3 days later; advance weekly');
  const [presets, setPresets] = useState<WeekPreset[]>(emptyPresets());

  const resetForm = () => {
    setName(''); setType('Custom'); setCriteria(''); setIndustryTags(''); setSizeTags('');
    setRoleTags(''); setCadenceRules('LI touch then email 3 days later; advance weekly');
    setPresets(emptyPresets()); setEditingId(null);
  };

  const openEdit = (c: Campaign) => {
    setEditingId(c.id); setName(c.name); setType(c.type); setCriteria(c.criteria);
    setIndustryTags(c.industryTags.join(', ')); setSizeTags(c.sizeTags.join(', '));
    setRoleTags(c.roleTags.join(', ')); setCadenceRules(c.cadenceRules);
    setPresets(c.weeklyPresets.length === 12 ? c.weeklyPresets : emptyPresets());
    setShowForm(true);
  };

  const handleSave = () => {
    const data = {
      name, type, criteria, cadenceRules, weeklyPresets: presets, active: true,
      industryTags: industryTags.split(',').map(s => s.trim()).filter(Boolean),
      sizeTags: sizeTags.split(',').map(s => s.trim()).filter(Boolean),
      roleTags: roleTags.split(',').map(s => s.trim()).filter(Boolean),
    };
    if (editingId) updateCampaign(editingId, data);
    else addCampaign(data);
    resetForm(); setShowForm(false);
  };

  const updatePreset = (week: number, field: keyof WeekPreset, value: string) => {
    setPresets(prev => prev.map(p => p.week === week ? { ...p, [field]: value } : p));
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-slide-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
            <p className="text-sm text-muted-foreground">Create and manage your outbound drip campaigns</p>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={16} className="mr-1" /> New Campaign
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(campaign => {
            const crmCount = contacts.filter(c => c.campaignId === campaign.id).length;
            const dbCount = getCountFor(campaign.name);
            const contactCount = crmCount + dbCount;
            return (
              <div key={campaign.id} className="bg-card rounded-lg border border-border p-5 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Megaphone size={16} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-card-foreground">{campaign.name}</h3>
                      <span className="text-xs text-muted-foreground">{campaign.type}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(campaign)}>
                      <Edit2 size={12} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteCampaign(campaign.id)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{campaign.criteria || 'No criteria defined'}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users size={12} /> {contactCount} contacts</span>
                  <span>{campaign.active ? '🟢 Active' : '⚪ Inactive'}</span>
                </div>
                {campaign.industryTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {campaign.industryTags.map(t => (
                      <span key={t} className="bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Campaign' : 'Create New Campaign'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Campaign Name *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q2 Florida Tech 50-250" />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={type} onValueChange={v => setType(v as CampaignType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="Industry">Industry</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Criteria / Targeting Logic</Label>
                <Textarea value={criteria} onChange={e => setCriteria(e.target.value)} placeholder="Describe who this campaign targets..." rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Industry Tags (comma-separated)</Label>
                  <Input value={industryTags} onChange={e => setIndustryTags(e.target.value)} placeholder="Tech, Healthcare" />
                </div>
                <div>
                  <Label>Size Tags</Label>
                  <Input value={sizeTags} onChange={e => setSizeTags(e.target.value)} placeholder="50-250, 250-500" />
                </div>
                <div>
                  <Label>Role Tags</Label>
                  <Input value={roleTags} onChange={e => setRoleTags(e.target.value)} placeholder="CEO, CFO, CHRO" />
                </div>
              </div>
              <div>
                <Label>Cadence Rules</Label>
                <Input value={cadenceRules} onChange={e => setCadenceRules(e.target.value)} />
              </div>

              <div>
                <Label className="mb-2 block">Weekly Presets (12 Weeks)</Label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-2">
                  {presets.map(p => (
                    <div key={p.week} className="grid grid-cols-[50px_1fr_1fr_1fr_1fr] gap-2 items-center">
                      <span className="text-xs font-medium text-muted-foreground">W{p.week}</span>
                      <Input className="h-8 text-xs" placeholder="Email theme" value={p.emailTheme} onChange={e => updatePreset(p.week, 'emailTheme', e.target.value)} />
                      <Input className="h-8 text-xs" placeholder="LI touch" value={p.linkedInTouch} onChange={e => updatePreset(p.week, 'linkedInTouch', e.target.value)} />
                      <Input className="h-8 text-xs" placeholder="CTA" value={p.cta} onChange={e => updatePreset(p.week, 'cta', e.target.value)} />
                      <Input className="h-8 text-xs" placeholder="Asset" value={p.asset} onChange={e => updatePreset(p.week, 'asset', e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleSave} disabled={!name}>{editingId ? 'Save Changes' : 'Create Campaign'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
