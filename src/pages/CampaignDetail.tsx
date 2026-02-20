import { useParams, useNavigate } from 'react-router-dom';
import { useCrm } from '@/store/CrmContext';
import Layout from '@/components/crm/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Mail, Linkedin, Phone, Search, Edit2, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo } from 'react';
import { inferBaselineTriggers } from '@/lib/triggers';
import { usePipelineUpdate, PIPELINE_STAGES, PIPELINE_COLORS } from '@/hooks/usePipelineUpdate';
import { toast } from 'sonner';

export default function CampaignDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { campaigns, updateCampaign } = useCrm();
  const { advancePipeline } = usePipelineUpdate();
  const decodedName = decodeURIComponent(name || '');
  const campaign = campaigns.find(c => c.name === decodedName);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<number | 'all'>('all');

  // Fetch contacts enrolled in this campaign via campaign_tags
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['campaign-contacts', decodedName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts_le')
        .select('id, first_name, last_name, title, email, phone, linkedin_url, account_id, campaign_tags, trigger_profile, auto_triggers, manual_triggers, batch_id, pipeline_stage, last_touch, next_touch')
        .not('campaign_tags', 'is', null);
      if (error) throw error;

      const enrolled = (data || []).filter(c => {
        const tags = (c.campaign_tags || []) as string[];
        return tags.includes(decodedName);
      });

      const accountIds = [...new Set(enrolled.map(c => c.account_id).filter(Boolean))] as string[];
      let accountMap = new Map<string, any>();
      if (accountIds.length > 0) {
        const { data: accounts } = await supabase.from('accounts').select('id, name, domain, industry, employee_count, hq_state').in('id', accountIds);
        for (const a of accounts || []) accountMap.set(a.id, a);
      }

      return enrolled.map(c => {
        const acct = accountMap.get(c.account_id || '') || {};
        let triggers = [...(c.trigger_profile as string[] || []), ...(c.auto_triggers as string[] || []), ...(c.manual_triggers as string[] || [])];
        if (triggers.length === 0) {
          triggers = inferBaselineTriggers({
            role_title: c.title, industry: acct.industry,
            employee_count: acct.employee_count, region: acct.hq_state, domain: acct.domain,
          });
        }
        return {
          ...c,
          account_name: acct.name || '—',
          industry: acct.industry || '',
          employee_count: acct.employee_count,
          hq_state: acct.hq_state || '',
          triggers,
          pipeline_stage: (c as any).pipeline_stage ?? 0,
          last_touch: (c as any).last_touch || null,
          next_touch: (c as any).next_touch || null,
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
    // Sort by next_touch asc (nulls last)
    list = [...list].sort((a, b) => {
      if (!a.next_touch && !b.next_touch) return 0;
      if (!a.next_touch) return 1;
      if (!b.next_touch) return -1;
      return a.next_touch < b.next_touch ? -1 : 1;
    });
    return list;
  }, [contacts, search, stageFilter]);

  const todaysTasks = useMemo(() =>
    contacts.filter(c => c.next_touch && c.next_touch.split('T')[0] <= today),
    [contacts, today]
  );

  const handleAction = async (contactId: string, action: 'email' | 'linkedin' | 'call') => {
    await advancePipeline(contactId, action);
    toast.success(`Pipeline updated: ${action}`);
  };

  // For DB-only campaigns (enrolled via Lead Queue), campaign may be null
  const isDbOnly = !campaign;

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
              <h1 className="text-2xl font-bold text-foreground">{decodedName}</h1>
              <p className="text-sm text-muted-foreground">{campaign?.type || 'Enrolled'} · {contacts.length} contacts enrolled</p>
            </div>
          </div>
          <div className="flex gap-2">
            {campaign && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Today's Tasks */}
        {todaysTasks.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="font-semibold text-sm text-card-foreground mb-3 flex items-center gap-2">
              <Clock size={14} className="text-primary" /> Today's Tasks ({todaysTasks.length})
            </h3>
            <div className="space-y-2">
              {todaysTasks.map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-md bg-background border border-border">
                  <div className="flex items-center gap-3">
                    <Badge className={`text-[10px] ${PIPELINE_COLORS[c.pipeline_stage] || PIPELINE_COLORS[0]}`}>
                      {PIPELINE_STAGES[c.pipeline_stage] || 'New'}
                    </Badge>
                    <div>
                      <span className="text-sm font-medium text-foreground">{c.first_name} {c.last_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{c.account_name}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {c.email && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleAction(c.id, 'email')}>
                        <Mail size={12} /> Email
                      </Button>
                    )}
                    {c.linkedin_url && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleAction(c.id, 'linkedin')}>
                        <Linkedin size={12} /> LI
                      </Button>
                    )}
                    {c.phone && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleAction(c.id, 'call')}>
                        <Phone size={12} /> Call
                      </Button>
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
              <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
            </div>
            <div className="flex gap-1">
              {(['all', 0, 1, 2, 3, 4] as const).map(s => (
                <Button key={String(s)} size="sm" variant={stageFilter === s ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setStageFilter(s as any)}>
                  {s === 'all' ? 'All' : PIPELINE_STAGES[s as number]}
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
                  <TableHead className="w-28">Last Touch</TableHead>
                  <TableHead className="w-28">Next Touch</TableHead>
                  <TableHead>Triggers</TableHead>
                  <TableHead className="w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading contacts...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No contacts match filters</TableCell></TableRow>
                ) : (
                  filtered.map(c => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-accent/30">
                      <TableCell>
                        <span className="font-medium text-sm text-foreground">{c.first_name} {c.last_name}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.account_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.title || '—'}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${PIPELINE_COLORS[c.pipeline_stage] || PIPELINE_COLORS[0]}`}>
                          {PIPELINE_STAGES[c.pipeline_stage] || 'New'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.last_touch ? new Date(c.last_touch).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        {c.next_touch ? (
                          <span className={`text-xs ${c.next_touch.split('T')[0] <= today ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            {new Date(c.next_touch).toLocaleDateString()}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {c.triggers.slice(0, 3).map((t: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[9px]">{typeof t === 'string' ? t : t.label}</Badge>
                          ))}
                          {c.triggers.length > 3 && (
                            <Badge variant="secondary" className="text-[9px]">+{c.triggers.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {c.email && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Generate Email" onClick={() => handleAction(c.id, 'email')}>
                              <Mail size={12} />
                            </Button>
                          )}
                          {c.linkedin_url && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Generate LinkedIn" onClick={() => handleAction(c.id, 'linkedin')}>
                              <Linkedin size={12} />
                            </Button>
                          )}
                          {c.phone && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Generate Call" onClick={() => handleAction(c.id, 'call')}>
                              <Phone size={12} />
                            </Button>
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
        {campaign?.weeklyPresets && campaign.weeklyPresets.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-4">
...
          </div>
        )}
      </div>
    </Layout>
  );
}
