import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Mail, Linkedin, Phone, ArrowUpDown, Loader2, ExternalLink } from 'lucide-react';
import { usePipelineUpdate, PIPELINE_STAGES, PIPELINE_COLORS } from '@/hooks/usePipelineUpdate';
import { inferBaselineTriggers } from '@/lib/triggers';
import { toast } from 'sonner';

interface Props {
  campaignName: string;
}

export default function CampaignContactsTable({ campaignName }: Props) {
  const navigate = useNavigate();
  const { advancePipeline } = usePipelineUpdate();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'company' | 'stage' | 'nextTouch'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['campaign-contacts', campaignName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts_le')
        .select('id, first_name, last_name, title, email, phone, linkedin_url, account_id, campaign_tags, trigger_profile, auto_triggers, manual_triggers, pipeline_stage, last_touch, next_touch')
        .not('campaign_tags', 'is', null);
      if (error) throw error;

      const enrolled = (data || []).filter(c => {
        const tags = (c.campaign_tags || []) as string[];
        return tags.includes(campaignName);
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
          hq_state: acct.hq_state || '',
          triggers,
          pipeline_stage: c.pipeline_stage ?? 0,
          last_touch: c.last_touch || null,
          next_touch: c.next_touch || null,
        };
      });
    },
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
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`); break;
        case 'company': cmp = a.account_name.localeCompare(b.account_name); break;
        case 'stage': cmp = a.pipeline_stage - b.pipeline_stage; break;
        case 'nextTouch': cmp = (a.next_touch || '').localeCompare(b.next_touch || ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [contacts, search, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleAction = async (contactId: string, action: 'email' | 'linkedin' | 'call') => {
    await advancePipeline(contactId, action);
    toast.success(`Pipeline updated: ${action}`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(c => c.id)));
  };

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading contacts...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground self-center">{filtered.length} contacts</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-3 w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('name')}>
                  <span className="flex items-center gap-1">Name <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('company')}>
                  <span className="flex items-center gap-1">Company <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('stage')}>
                  <span className="flex items-center gap-1">Stage <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Touch</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('nextTouch')}>
                  <span className="flex items-center gap-1">Next Touch <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Triggers</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No contacts enrolled in this campaign.</td></tr>
              )}
              {filtered.map(contact => {
                const isOverdue = contact.next_touch && contact.next_touch.split('T')[0] <= today;
                return (
                  <tr
                    key={contact.id}
                    className={`border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${selectedIds.has(contact.id) ? 'bg-accent/50' : ''}`}
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                  >
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(contact.id)} onCheckedChange={() => toggleSelect(contact.id)} />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{contact.first_name} {contact.last_name}</span>
                        {contact.linkedin_url && (
                          <a
                            href={contact.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{contact.account_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{contact.title || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] ${PIPELINE_COLORS[contact.pipeline_stage] || PIPELINE_COLORS[0]}`}>
                        {PIPELINE_STAGES[contact.pipeline_stage] || 'New'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {contact.last_touch ? new Date(contact.last_touch).toLocaleDateString() : '—'}
                    </td>
                    <td className={`px-4 py-3 text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {contact.next_touch ? new Date(contact.next_touch).toLocaleDateString() : '—'}
                      {isOverdue && ' ⚠'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {contact.triggers.slice(0, 2).map((t: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{typeof t === 'string' ? t : t.label}</Badge>
                        ))}
                        {contact.triggers.length > 2 && (
                          <Badge variant="secondary" className="text-[9px]">+{contact.triggers.length - 2}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {contact.email && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Email" onClick={() => handleAction(contact.id, 'email')}>
                            <Mail size={12} />
                          </Button>
                        )}
                        {contact.linkedin_url && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="LinkedIn" onClick={() => handleAction(contact.id, 'linkedin')}>
                            <Linkedin size={12} />
                          </Button>
                        )}
                        {contact.phone && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Call" onClick={() => handleAction(contact.id, 'call')}>
                            <Phone size={12} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
