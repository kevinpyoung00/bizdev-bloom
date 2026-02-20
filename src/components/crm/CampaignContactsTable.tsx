import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Mail, Linkedin, Phone, ArrowUpDown, Loader2, ExternalLink, ChevronDown, ChevronRight, Check, Copy, Calendar, Building2, Sparkles, Zap, Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePipelineUpdate, PIPELINE_STAGES, PIPELINE_COLORS, getCurrentWeekFromProgress, getCompletedWeeks, type DripWeekProgress } from '@/hooks/usePipelineUpdate';
import { inferBaselineTriggers } from '@/lib/triggers';
import { WEEK_THEMES, getWeekTheme } from '@/lib/weekThemes';
import { isCallWeek } from '@/types/crm';
import { toast } from 'sonner';
import SignalChips, { buildChipsFromTriggers } from '@/components/crm/SignalChips';
import { normalizeUrl, formatTelHref, renderReason } from '@/lib/normalizeUrl';
import { openExternal } from '@/lib/openExternal';
import { useGenerateBrief } from '@/hooks/useAIGeneration';

interface Props {
  campaignName: string;
}

/* ── Simple draft generator for DB contacts ── */
function generateDraft(week: number, channel: 'email' | 'linkedin' | 'phone', contact: any): string {
  const name = contact.first_name || 'there';
  const company = contact.account_name || 'your company';
  const theme = getWeekTheme(week);

  if (channel === 'email') {
    if (week === 1) return `Hi ${name},\n\nI came across ${company} and wanted to reach out. ${theme.description}.\n\nWould you have 10–15 minutes next week to explore whether there's a fit?\n\nBest,`;
    if (week === 12) return `Hi ${name},\n\nI've reached out a few times and I want to be respectful of your time. If benefits strategy isn't a priority right now, completely understood.\n\nThat said — if circumstances change, I'd welcome the chance to help ${company}. My door is always open.\n\nBest,`;
    return `Hi ${name},\n\n[Week ${week}: ${theme.theme}]\n\n${theme.description}. I'd love to share what we're seeing for companies like ${company}.\n\nBest,`;
  }
  if (channel === 'linkedin') {
    if (week === 1) return `Hi ${name} — I noticed ${company} and wanted to connect. We help similar firms turn benefits into a talent advantage. Happy to share a brief if helpful.`;
    return `Hi ${name} — following up regarding ${theme.theme.toLowerCase()} for companies like ${company}. Happy to share a brief if helpful.`;
  }
  return `TALKING POINTS:\n• Reference ${company}'s situation\n• Lead with Week ${week} theme: ${theme.theme}\n• ${theme.description}\n• Ask an open-ended question\n• Offer a specific next step\n\nVOICEMAIL (≤20s):\n"Hi ${name}, this is [name] with OneDigital. Following up on ${theme.theme.toLowerCase()} — would love to connect briefly. I'll send a note as well."`;
}

export default function CampaignContactsTable({ campaignName }: Props) {
  const queryClient = useQueryClient();
  const { markChannelDone } = usePipelineUpdate();
  const generateBrief = useGenerateBrief();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'company' | 'stage' | 'nextTouch'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  // Draft modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalChannel, setModalChannel] = useState<'email' | 'linkedin' | 'phone'>('email');
  const [modalContent, setModalContent] = useState('');
  const [modalWeek, setModalWeek] = useState(1);
  const [modalContactId, setModalContactId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Brief generation state per account
  const [generatingBriefFor, setGeneratingBriefFor] = useState<string | null>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['campaign-contacts', campaignName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts_le')
        .select('id, first_name, last_name, title, email, phone, linkedin_url, account_id, campaign_tags, trigger_profile, auto_triggers, manual_triggers, pipeline_stage, last_touch, next_touch, drip_progress')
        .not('campaign_tags', 'is', null);
      if (error) throw error;

      const enrolled = (data || []).filter(c => {
        const tags = (c.campaign_tags || []) as string[];
        return tags.includes(campaignName);
      });

      const accountIds = [...new Set(enrolled.map(c => c.account_id).filter(Boolean))] as string[];
      let accountMap = new Map<string, any>();
      if (accountIds.length > 0) {
        const { data: accounts } = await supabase.from('accounts').select('id, name, domain, industry, employee_count, hq_state, hq_city, website, triggers, icp_class, high_intent, high_intent_reason, revenue_range, source').in('id', accountIds);
        for (const a of accounts || []) accountMap.set(a.id, a);
      }

      let scrapeMap = new Map<string, any>();
      if (accountIds.length > 0) {
        const { data: briefs } = await supabase.from('account_briefs').select('account_id, brief_markdown').in('account_id', accountIds).order('generated_at', { ascending: false });
        for (const b of briefs || []) {
          if (!scrapeMap.has(b.account_id!)) scrapeMap.set(b.account_id!, b.brief_markdown);
        }
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
        const dripProgress: DripWeekProgress[] = Array.isArray((c as any).drip_progress) ? (c as any).drip_progress : [];
        return {
          ...c,
          account_name: acct.name || '—',
          industry: acct.industry || '',
          hq_state: acct.hq_state || '',
          hq_city: acct.hq_city || '',
          employee_count: acct.employee_count,
          domain: acct.domain || '',
          website: acct.website || '',
          icp_class: acct.icp_class || '',
          source: acct.source || '',
          revenue_range: acct.revenue_range || '',
          account_triggers: acct.triggers || {},
          high_intent: acct.high_intent,
          high_intent_reason: acct.high_intent_reason || '',
          brief_markdown: scrapeMap.get(c.account_id || '') || null,
          triggers,
          pipeline_stage: c.pipeline_stage ?? 0,
          last_touch: c.last_touch || null,
          next_touch: c.next_touch || null,
          dripProgress,
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

  const openDraftModal = (contact: any, week: number, channel: 'email' | 'linkedin' | 'phone') => {
    setModalContactId(contact.id);
    setModalWeek(week);
    setModalChannel(channel);
    setModalContent(generateDraft(week, channel, contact));
    setCopied(false);
    setModalOpen(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(modalContent);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAndAdvance = async () => {
    navigator.clipboard.writeText(modalContent);
    if (modalContactId) {
      const channelKey = modalChannel === 'phone' ? 'phone' : modalChannel;
      await markChannelDone(modalContactId, modalWeek, channelKey as 'email' | 'linkedin' | 'phone');
      queryClient.invalidateQueries({ queryKey: ['campaign-contacts', campaignName] });
    }
    setCopied(true);
    toast.success('Copied & channel marked done!');
    setModalOpen(false);
  };

  const handleCheckboxToggle = async (contactId: string, week: number, channel: 'email' | 'linkedin' | 'phone') => {
    await markChannelDone(contactId, week, channel);
    queryClient.invalidateQueries({ queryKey: ['campaign-contacts', campaignName] });
    toast.success(`Week ${week} ${channel} marked done`);
  };

  const handleGenerateBrief = async (accountId: string) => {
    setGeneratingBriefFor(accountId);
    try {
      await generateBrief.mutateAsync(accountId);
      queryClient.invalidateQueries({ queryKey: ['campaign-contacts', campaignName] });
      toast.success('Analysis generated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate analysis');
    } finally {
      setGeneratingBriefFor(null);
    }
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

  const toggleExpand = (id: string) => {
    setExpandedContactId(prev => prev === id ? null : id);
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
                <th className="px-2 py-3 w-6"></th>
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Progress</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('nextTouch')}>
                  <span className="flex items-center gap-1">Next Touch <ArrowUpDown size={12} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No contacts enrolled in this campaign.</td></tr>
              )}
              {filtered.map(contact => {
                const isOverdue = contact.next_touch && contact.next_touch.split('T')[0] <= today;
                const isExpanded = expandedContactId === contact.id;
                const currentWeek = getCurrentWeekFromProgress(contact.dripProgress);
                const completedWeeks = getCompletedWeeks(contact.dripProgress);
                const progressPct = Math.round((completedWeeks / 12) * 100);
                const currentWP = contact.dripProgress.find((p: DripWeekProgress) => p.week === currentWeek);

                return (
                  <>
                    <tr
                      key={contact.id}
                      className={`border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${isExpanded ? 'bg-primary/5' : ''} ${selectedIds.has(contact.id) ? 'bg-accent/50' : ''}`}
                      onClick={() => toggleExpand(contact.id)}
                    >
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.has(contact.id)} onCheckedChange={() => toggleSelect(contact.id)} />
                      </td>
                      <td className="px-2 py-3">
                        {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{contact.first_name} {contact.last_name}</span>
                          {contact.linkedin_url && (
                            <>
                              <button onClick={e => openExternal(contact.linkedin_url, e)} className="text-muted-foreground hover:text-primary transition-colors" title="Open LinkedIn">
                                <ExternalLink size={12} />
                              </button>
                              <a href={normalizeUrl(contact.linkedin_url)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="LinkedIn (direct)" onClick={e => e.stopPropagation()}>
                                <Linkedin size={12} />
                              </a>
                            </>
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
                      {/* Channel status indicators on collapsed row */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5" title="LinkedIn">
                            <Linkedin size={12} className={currentWP?.liDone ? 'text-success' : 'text-muted-foreground/40'} />
                            {currentWP?.liDone && <Check size={8} className="text-success -ml-1" />}
                          </div>
                          <div className="flex items-center gap-0.5" title="Email">
                            <Mail size={12} className={currentWP?.emailDone ? 'text-success' : 'text-muted-foreground/40'} />
                            {currentWP?.emailDone && <Check size={8} className="text-success -ml-1" />}
                          </div>
                          <div className="flex items-center gap-0.5" title="Phone">
                            <Phone size={12} className={currentWP?.phoneDone ? 'text-success' : 'text-muted-foreground/40'} />
                            {currentWP?.phoneDone && <Check size={8} className="text-success -ml-1" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground ml-1">W{currentWeek}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {contact.next_touch ? new Date(contact.next_touch).toLocaleDateString() : '—'}
                        {isOverdue && ' ⚠'}
                      </td>
                    </tr>

                    {/* ── Expanded view ── */}
                    {isExpanded && (
                      <tr key={`${contact.id}-expanded`}>
                        <td colSpan={8} className="p-0">
                          <div className="bg-muted/20 border-t border-border px-6 py-5 space-y-5">

                            {/* Company Overview (AI Enriched) */}
                            <CompanyOverviewSection
                              contact={contact}
                              onGenerateBrief={() => handleGenerateBrief(contact.account_id || '')}
                              isGeneratingBrief={generatingBriefFor === (contact.account_id || '')}
                            />

                            {/* Trigger / Signal Chips */}
                            <div className="bg-card rounded-lg border border-border p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Zap size={14} className="text-primary" />
                                <h4 className="font-semibold text-sm text-card-foreground">Growth Indicators</h4>
                              </div>
                              <SignalChips chips={buildChipsFromTriggers(contact.triggers)} />
                            </div>

                            {/* ── Action Bar ── */}
                            <ActionBar contact={contact} />

                            {/* 12-Week Drip Workflow */}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar size={16} className="text-primary" />
                                <h4 className="font-semibold text-sm text-foreground">12-Week Drip Workflow</h4>
                                <Badge variant="secondary" className="text-[10px]">Week {currentWeek} of 12</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">
                                <span className="font-medium">Reason selected:</span>{' '}
                                {renderReason(contact.triggers?.length > 0 ? contact.triggers.slice(0, 3) : contact.account_triggers)}
                              </p>

                              {/* Progress bar */}
                              <div className="flex items-center gap-3 mb-4">
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground font-medium">{completedWeeks}/12 weeks</span>
                              </div>

                              {/* Week cards */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {WEEK_THEMES.map(wt => {
                                  const weekProgress = contact.dripProgress.find((p: DripWeekProgress) => p.week === wt.week);
                                  const hasCall = isCallWeek(wt.week);
                                  const weekAllDone = weekProgress
                                    ? weekProgress.liDone && weekProgress.emailDone && (!hasCall || weekProgress.phoneDone)
                                    : false;
                                  const isCurrent = wt.week === currentWeek;

                                  return (
                                    <div
                                      key={wt.week}
                                      className={`rounded-lg border p-4 transition-all ${
                                        weekAllDone ? 'border-success/30 bg-success/5 opacity-70' :
                                        isCurrent ? 'border-primary/40 bg-primary/5 ring-2 ring-primary/20' :
                                        'border-border bg-card'
                                      }`}
                                    >
                                      {/* Week header */}
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                          weekAllDone ? 'bg-success text-success-foreground' :
                                          isCurrent ? 'bg-primary text-primary-foreground' :
                                          'bg-muted text-muted-foreground'
                                        }`}>
                                          {weekAllDone ? <Check size={12} /> : wt.week}
                                        </span>
                                        <div>
                                          <p className="text-sm font-semibold text-foreground">Week {wt.week}: {wt.theme}</p>
                                          <p className="text-[10px] text-muted-foreground">{wt.description}</p>
                                        </div>
                                      </div>

                                      {!contact.email && <p className="text-[10px] text-muted-foreground italic mt-2">No email on file — start with LinkedIn.</p>}

                                      {/* Channel rows with checkboxes */}
                                      <div className="mt-3 space-y-2">
                                        {/* LinkedIn */}
                                        <div className="flex items-center gap-2">
                                          <button
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                              weekProgress?.liDone
                                                ? 'bg-success border-success text-success-foreground'
                                                : 'border-primary/40 hover:border-primary'
                                            }`}
                                            onClick={(e) => { e.stopPropagation(); if (!weekProgress?.liDone) handleCheckboxToggle(contact.id, wt.week, 'linkedin'); }}
                                            disabled={weekProgress?.liDone}
                                          >
                                            {weekProgress?.liDone && <Check size={10} />}
                                          </button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className={`flex-1 h-9 text-xs gap-1.5 justify-center ${weekProgress?.liDone ? 'opacity-50' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); openDraftModal(contact, wt.week, 'linkedin'); }}
                                          >
                                            <Linkedin size={14} />
                                            {wt.week === 1 ? 'Connect / Generate LinkedIn' : 'Generate LinkedIn'}
                                          </Button>
                                        </div>

                                        {/* Email */}
                                        <div className="flex items-center gap-2">
                                          <button
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                              weekProgress?.emailDone
                                                ? 'bg-success border-success text-success-foreground'
                                                : 'border-primary/40 hover:border-primary'
                                            }`}
                                            onClick={(e) => { e.stopPropagation(); if (!weekProgress?.emailDone) handleCheckboxToggle(contact.id, wt.week, 'email'); }}
                                            disabled={weekProgress?.emailDone}
                                          >
                                            {weekProgress?.emailDone && <Check size={10} />}
                                          </button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className={`flex-1 h-9 text-xs gap-1.5 justify-center ${weekProgress?.emailDone ? 'opacity-50' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); openDraftModal(contact, wt.week, 'email'); }}
                                          >
                                            <Mail size={14} />
                                            Generate Email
                                          </Button>
                                        </div>

                                        {/* Phone */}
                                        <div className="flex items-center gap-2">
                                          <button
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                              weekProgress?.phoneDone
                                                ? 'bg-success border-success text-success-foreground'
                                                : 'border-primary/40 hover:border-primary'
                                            }`}
                                            onClick={(e) => { e.stopPropagation(); if (!weekProgress?.phoneDone) handleCheckboxToggle(contact.id, wt.week, 'phone'); }}
                                            disabled={weekProgress?.phoneDone}
                                          >
                                            {weekProgress?.phoneDone && <Check size={10} />}
                                          </button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className={`flex-1 h-9 text-xs gap-1.5 justify-center ${weekProgress?.phoneDone ? 'opacity-50' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); openDraftModal(contact, wt.week, 'phone'); }}
                                          >
                                            <Phone size={14} />
                                            Generate Phone Touch
                                          </Button>
                                          {!hasCall && <span className="text-[10px] text-muted-foreground italic">Optional</span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Draft generation modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalChannel === 'email' && <Mail size={16} />}
              {modalChannel === 'linkedin' && <Linkedin size={16} />}
              {modalChannel === 'phone' && <Phone size={16} />}
              Week {modalWeek}: {modalChannel === 'email' ? 'Email Draft' : modalChannel === 'linkedin' ? 'LinkedIn Message' : 'Phone Script'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              className="w-full min-h-[200px] p-3 text-sm rounded-md border border-input bg-background text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              value={modalContent}
              onChange={e => setModalContent(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <><Check size={14} className="mr-1" /> Copied</> : <><Copy size={14} className="mr-1" /> Copy</>}
              </Button>
              <Button size="sm" onClick={handleCopyAndAdvance}>
                <Copy size={14} className="mr-1" /> Copy & Mark Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Action Bar sub-component ── */
function ActionBar({ contact }: { contact: any }) {
  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 flex-wrap">
        {contact.linkedin_url && (
          <button
            onClick={e => openExternal(contact.linkedin_url, e)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Linkedin size={13} /> Open LinkedIn
          </button>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Mail size={13} /> Email
          </a>
        )}
        {contact.phone && (
          <a
            href={formatTelHref(contact.phone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Phone size={13} /> Call
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Company Overview sub-component ── */
function CompanyOverviewSection({ contact, onGenerateBrief, isGeneratingBrief }: { contact: any; onGenerateBrief: () => void; isGeneratingBrief: boolean }) {
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [showFullBrief, setShowFullBrief] = useState(false);

  const hasEmail = !!contact.email;
  const hasPhone = !!contact.phone;
  const hasLinkedIn = !!contact.linkedin_url;

  return (
    <Collapsible open={overviewOpen} onOpenChange={setOverviewOpen}>
      <div className="bg-card rounded-lg border border-border">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-accent/50 rounded-lg transition-colors">
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-primary" />
            <h4 className="font-semibold text-sm text-card-foreground">Company Overview</h4>
            {contact.brief_markdown && (
              <Badge variant="secondary" className="text-[10px] gap-1"><Sparkles size={10} /> AI Enriched</Badge>
            )}
            {contact.high_intent && (
              <Badge variant="secondary" className="text-[10px] gap-1 border-warning/30 text-warning">High Intent</Badge>
            )}
          </div>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${overviewOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* AI Brief / Analysis */}
            {contact.brief_markdown ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={12} className="text-primary" />
                  <h5 className="text-xs font-semibold text-foreground">Generated Analysis</h5>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3 text-sm text-foreground prose prose-sm max-w-none whitespace-pre-wrap">
                  {showFullBrief || contact.brief_markdown.length <= 600
                    ? contact.brief_markdown
                    : contact.brief_markdown.slice(0, 600) + '…'}
                </div>
                {contact.brief_markdown.length > 600 && (
                  <button
                    className="text-xs text-primary hover:underline mt-1"
                    onClick={e => { e.stopPropagation(); setShowFullBrief(v => !v); }}
                  >
                    {showFullBrief ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">No AI analysis yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1"
                  onClick={e => { e.stopPropagation(); onGenerateBrief(); }}
                  disabled={isGeneratingBrief}
                >
                  {isGeneratingBrief ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} />}
                  {isGeneratingBrief ? 'Generating…' : 'Generate Analysis'}
                </Button>
              </div>
            )}

            {/* Reachability */}
            <div>
              <h5 className="text-xs font-semibold text-foreground mb-2">Reachability</h5>
              <div className="flex flex-wrap gap-4">
                {[
                  { icon: Mail, label: 'Email', has: hasEmail },
                  { icon: Phone, label: 'Phone', has: hasPhone },
                  { icon: Linkedin, label: 'LinkedIn', has: hasLinkedIn },
                ].map(({ icon: Icon, label, has }) => (
                  <div key={label} className={`flex items-center gap-1.5 text-xs ${has ? 'font-medium text-primary' : 'text-muted-foreground opacity-50'}`}>
                    <Icon size={12} /> {label} {has ? '✓' : '✗'}
                  </div>
                ))}
              </div>
            </div>

            {/* Firmographics */}
            <div>
              <h5 className="text-xs font-semibold text-foreground mb-2">Firmographics</h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">Domain:</span> <span className="text-foreground text-xs font-medium">{contact.domain || '—'}</span></div>
                <div><span className="text-muted-foreground text-xs">Industry:</span> <span className="text-foreground text-xs font-medium">{contact.industry || '—'}</span></div>
                <div><span className="text-muted-foreground text-xs">Employees:</span> <span className="text-foreground text-xs font-medium">{contact.employee_count || '—'}</span></div>
                <div><span className="text-muted-foreground text-xs">Location:</span> <span className="text-foreground text-xs font-medium">{contact.hq_city ? `${contact.hq_city}, ${contact.hq_state}` : contact.hq_state || '—'}</span></div>
                <div><span className="text-muted-foreground text-xs">ICP Class:</span> <span className="text-foreground text-xs font-medium">{contact.icp_class || '—'}</span></div>
                <div><span className="text-muted-foreground text-xs">Revenue:</span> <span className="text-foreground text-xs font-medium">{contact.revenue_range || '—'}</span></div>
              </div>
            </div>

            {contact.high_intent_reason && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">High Intent Reason</p>
                <p className="text-sm text-foreground">{contact.high_intent_reason}</p>
              </div>
            )}

            {/* Website link */}
            {(contact.website || contact.domain) && (
              <div className="flex items-center gap-2 text-xs">
                <Globe size={12} className="text-muted-foreground" />
                <a
                  href={normalizeUrl(contact.website || contact.domain)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  {contact.website || contact.domain}
                </a>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
