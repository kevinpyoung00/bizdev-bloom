import { useParams, useNavigate } from 'react-router-dom';
import { useCrm } from '@/store/CrmContext';
import Layout from '@/components/crm/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Mail, Linkedin, Phone, Search, Edit2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo } from 'react';
import { inferBaselineTriggers, mergeTriggerSets } from '@/lib/triggers';

const STAGE_LABELS: Record<number, string> = {
  0: 'New',
  1: 'Emailed',
  2: 'LinkedIn',
  3: 'Called',
  4: 'Meeting',
};
const STAGE_COLORS: Record<number, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-primary/10 text-primary',
  2: 'bg-info/10 text-info',
  3: 'bg-warning/10 text-warning',
  4: 'bg-success/10 text-success',
};

export default function CampaignDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { campaigns, updateCampaign } = useCrm();
  const decodedName = decodeURIComponent(name || '');
  const campaign = campaigns.find(c => c.name === decodedName);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<number | 'all'>('all');

  // Fetch contacts enrolled in this campaign via campaign_tags
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['campaign-contacts', decodedName],
    queryFn: async () => {
      // Fetch all contacts with campaign_tags, filter in JS for array containment
      const { data, error } = await supabase
        .from('contacts_le')
        .select('id, first_name, last_name, title, email, phone, linkedin_url, account_id, campaign_tags, trigger_profile, auto_triggers, manual_triggers, batch_id')
        .not('campaign_tags', 'is', null);
      if (error) throw error;

      // Filter to contacts whose campaign_tags includes our campaign name
      const enrolled = (data || []).filter(c => {
        const tags = (c.campaign_tags || []) as string[];
        return tags.includes(decodedName);
      });

      // Fetch account info for enrolled contacts
      const accountIds = [...new Set(enrolled.map(c => c.account_id).filter(Boolean))] as string[];
      let accountMap = new Map<string, any>();
      if (accountIds.length > 0) {
        const { data: accounts } = await supabase.from('accounts').select('id, name, domain, industry, employee_count, hq_state').in('id', accountIds);
        for (const a of accounts || []) {
          accountMap.set(a.id, a);
        }
      }

      return enrolled.map(c => {
        const acct = accountMap.get(c.account_id || '') || {};
        // Ensure triggers are never empty
        let triggers = [...(c.trigger_profile as string[] || []), ...(c.auto_triggers as string[] || []), ...(c.manual_triggers as string[] || [])];
        if (triggers.length === 0) {
          triggers = inferBaselineTriggers({
            role_title: c.title,
            industry: acct.industry,
            employee_count: acct.employee_count,
            region: acct.hq_state,
            domain: acct.domain,
          });
        }
        return {
          ...c,
          account_name: acct.name || '—',
          industry: acct.industry || '',
          employee_count: acct.employee_count,
          hq_state: acct.hq_state || '',
          triggers,
          pipeline_stage: 0, // Default since column doesn't exist yet
        };
      });
    },
    enabled: !!decodedName,
  });

  const today = new Date().toISOString().split('T')[0];

  const filtered = useMemo(() => {
    let list = contacts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        c.account_name.toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q)
      );
    }
    if (stageFilter !== 'all') {
      list = list.filter(c => c.pipeline_stage === stageFilter);
    }
    return list;
  }, [contacts, search, stageFilter]);

  const todaysTasks = useMemo(() => contacts.filter(() => true).slice(0, 5), [contacts]);

  if (!campaign) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <p className="text-muted-foreground">Campaign "{decodedName}" not found in your campaigns.</p>
          <Button variant="outline" onClick={() => navigate('/campaigns')}><ArrowLeft size={14} className="mr-1" /> Back</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-slide-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/campaigns')}>
              <ArrowLeft size={16} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
              <p className="text-sm text-muted-foreground">{campaign.type} · {contacts.length} contacts enrolled</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={campaign.active ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateCampaign(campaign.id, { active: !campaign.active })}
            >
              {campaign.active ? '🟢 Active' : '⚪ Paused'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/campaigns')}>
              <Edit2 size={14} className="mr-1" /> Edit Campaign
            </Button>
          </div>
        </div>

        {/* Today's Tasks */}
        {todaysTasks.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="font-semibold text-sm text-card-foreground mb-3">Today's Tasks in This Campaign</h3>
            <div className="space-y-2">
              {todaysTasks.map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-md bg-background border border-border">
                  <div>
                    <span className="text-sm font-medium text-foreground">{c.first_name} {c.last_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{c.account_name}</span>
                  </div>
                  <div className="flex gap-1">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-input bg-background hover:bg-accent text-foreground">
                        <Mail size={12} /> Email
                      </a>
                    )}
                    {c.linkedin_url && (
                      <a href={c.linkedin_url.startsWith('http') ? c.linkedin_url : `https://${c.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-input bg-background hover:bg-accent text-foreground">
                        <Linkedin size={12} /> LI
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-input bg-background hover:bg-accent text-foreground">
                        <Phone size={12} /> Call
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contacts Table */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
            <div className="flex gap-1">
              {['all', 0, 1, 2, 3, 4].map(s => (
                <Button
                  key={String(s)}
                  size="sm"
                  variant={stageFilter === s ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => setStageFilter(s as any)}
                >
                  {s === 'all' ? 'All' : STAGE_LABELS[s as number]}
                </Button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-24">Stage</TableHead>
                  <TableHead>Triggers</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading contacts...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No contacts match filters</TableCell></TableRow>
                ) : (
                  filtered.map(c => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-accent/30" onClick={() => navigate(`/contacts/${c.id}`)}>
                      <TableCell>
                        <span className="font-medium text-sm text-foreground">{c.first_name} {c.last_name}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.account_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.title || '—'}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${STAGE_COLORS[c.pipeline_stage] || STAGE_COLORS[0]}`}>
                          {STAGE_LABELS[c.pipeline_stage] || 'New'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {c.triggers.slice(0, 3).map((t: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[9px]">{t}</Badge>
                          ))}
                          {c.triggers.length > 3 && (
                            <Badge variant="secondary" className="text-[9px]">+{c.triggers.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {c.email && (
                            <a href={`mailto:${c.email}`} title="Email">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Mail size={12} /></Button>
                            </a>
                          )}
                          {c.linkedin_url && (
                            <a href={c.linkedin_url.startsWith('http') ? c.linkedin_url : `https://${c.linkedin_url}`} target="_blank" rel="noopener noreferrer" title="LinkedIn">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Linkedin size={12} /></Button>
                            </a>
                          )}
                          {c.phone && (
                            <a href={`tel:${c.phone}`} title="Call">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Phone size={12} /></Button>
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Messaging Presets Preview */}
        {campaign.weeklyPresets && campaign.weeklyPresets.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="font-semibold text-sm text-card-foreground mb-3">Messaging Presets (W1–W12)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {campaign.weeklyPresets.map(p => (
                <div key={p.week} className="p-2 rounded border border-border bg-background text-xs space-y-0.5">
                  <span className="font-medium text-foreground">W{p.week}</span>
                  {p.emailTheme && <p className="text-muted-foreground truncate">📧 {p.emailTheme}</p>}
                  {p.linkedInTouch && <p className="text-muted-foreground truncate">💬 {p.linkedInTouch}</p>}
                  {p.cta && <p className="text-muted-foreground truncate">🎯 {p.cta}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
