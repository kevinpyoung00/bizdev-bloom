import { useParams, useNavigate } from 'react-router-dom';
import { useCrm } from '@/store/CrmContext';
import Layout from '@/components/crm/Layout';
import StatusBadge from '@/components/crm/StatusBadge';
import WeekPanel from '@/components/crm/WeekPanel';
import type { WeekPanelLeadData } from '@/components/crm/WeekPanel';
import ContactForm from '@/components/crm/ContactForm';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Calendar, Mail, Linkedin, Phone, ExternalLink, Edit2, RotateCcw, Trophy, XCircle, CalendarPlus, ChevronDown, Building2, Zap, Globe, Loader2, Sparkles, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getContactProgress, getHiringIntensity } from '@/types/crm';
import SignalChips, { buildChipsFromSignals } from '@/components/crm/SignalChips';
import { useState, useMemo } from 'react';
import { detectPersona } from '@/lib/persona';
import { matchIndustryKey } from '@/lib/industry';
import { buildReasonSelectedLine, contactSignalsToLeadSignals } from '@/lib/signals';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

function getEmployeeTier(count: string): string {
  const n = parseInt(count, 10);
  if (isNaN(n)) return count || '—';
  if (n < 50) return `<50`;
  if (n < 75) return '50–74';
  if (n < 100) return '75–99';
  if (n < 150) return '100–149';
  return '150+';
}

function getPriorityLabel(signals: any): { label: string; className: string } {
  const s = contactSignalsToLeadSignals(signals);
  const hasFunding = s.funding?.days_ago != null && s.funding.days_ago <= 90;
  const hasHRLarge = s.hr_change?.days_ago != null && s.hr_change.days_ago <= 14;
  const hasHiringLarge = s.hiring?.intensity === 'Large';
  const hasCarrier = s.carrier_change?.recent;
  if (hasFunding || hasHRLarge || hasHiringLarge || hasCarrier) return { label: 'High', className: 'bg-destructive/10 text-destructive border-destructive/30' };
  const hasMediumSignal = (s.hr_change?.days_ago != null && s.hr_change.days_ago <= 60) || s.hiring?.intensity === 'Medium' || (s.csuite?.days_ago != null && s.csuite.days_ago <= 90);
  if (hasMediumSignal) return { label: 'Medium', className: 'bg-warning/10 text-warning border-warning/30' };
  return { label: 'Low', className: 'bg-muted text-muted-foreground' };
}

function buildCompanySummary(contact: any): string {
  const parts: string[] = [];
  const name = contact.company || 'This company';
  const industry = contact.industry ? `in the ${contact.industry} industry` : '';
  const emp = contact.employeeCount ? `with approximately ${contact.employeeCount} employees` : '';
  const base = [name, industry, emp].filter(Boolean).join(' ');
  parts.push(base + '.');

  if (contact.currentCarrier) parts.push(`Currently using ${contact.currentCarrier} for benefits.`);
  if (contact.renewalMonth) parts.push(`Benefits renewal is in ${contact.renewalMonth}.`);

  const jobs = contact.signals?.jobs_60d;
  if (jobs && jobs >= 3) parts.push(`Actively hiring with ${jobs} open roles in the last 60 days.`);
  if (contact.signals?.funding_stage && contact.signals.funding_stage !== 'None') {
    const daysAgo = contact.signals.funding_days_ago;
    parts.push(`Recently completed a ${contact.signals.funding_stage} funding round${daysAgo ? ` (${daysAgo} days ago)` : ''}.`);
  }
  if (contact.signals?.hr_change_title) {
    parts.push(`Underwent an HR leadership change — new ${contact.signals.hr_change_title}${contact.signals.hr_change_days_ago ? ` (${contact.signals.hr_change_days_ago}d ago)` : ''}.`);
  }
  if (contact.signals?.carrier_change?.recent) parts.push('Recently changed benefits carriers, signaling openness to new solutions.');
  if (contact.signals?.talent_risk?.risk) parts.push('Showing signs of employee retention challenges.');
  if (contact.source) parts.push(`Sourced via ${contact.source}.`);

  return parts.join(' ');
}

function inferBenefitsPainPoints(contact: any): string[] {
  const pains: string[] = [];
  const emp = parseInt(contact.employeeCount, 10);
  if (!isNaN(emp)) {
    if (emp >= 50 && emp < 100) pains.push('ACA compliance threshold');
    if (emp >= 100) pains.push('Benefits administration complexity');
    if (emp >= 75) pains.push('Open enrollment scalability');
  }
  if (contact.signals?.jobs_60d >= 6) pains.push('Rapid headcount growth strain on HR');
  if (contact.signals?.carrier_change?.recent) pains.push('Carrier transition risk');
  if (contact.signals?.talent_risk?.risk) pains.push('Employee retention pressure');
  if (contact.renewalMonth) pains.push('Upcoming renewal planning');
  if (pains.length === 0) pains.push('Benefits optimization opportunity');
  return pains;
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contacts, campaigns, bookMeeting, setContactStatus, reactivateContact, updateContact } = useCrm();
  const [editing, setEditing] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');

  const contact = contacts.find(c => c.id === id);

  const handleScrape = async () => {
    if (!contact) return;
    const url = scrapeUrl.trim() || contact.website;
    if (!url) {
      toast.error('Please enter a website URL');
      return;
    }
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('company-scrape', {
        body: { website: url },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Scrape failed');
      updateContact(contact.id, {
        companyScrape: {
          summary: data.summary,
          key_facts: data.key_facts || [],
          outreach_angles: data.outreach_angles || [],
          pain_points: data.pain_points || [],
          scrapedAt: new Date().toISOString(),
        },
        website: url,
      } as any);
      toast.success('Company intel updated from website');
      setScrapeUrl('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to scrape website');
    } finally {
      setScraping(false);
    }
  };

  const leadSignals = useMemo(() => contact ? contactSignalsToLeadSignals(contact.signals) : null, [contact]);
  const reasonLine = useMemo(() => buildReasonSelectedLine(leadSignals), [leadSignals]);

  const leadData: WeekPanelLeadData | undefined = useMemo(() => {
    if (!contact) return undefined;
    return {
      contact: {
        first_name: contact.firstName,
        last_name: contact.lastName,
        full_name: `${contact.firstName} ${contact.lastName}`,
        email: contact.email,
        phone: contact.phone,
        linkedin_url: contact.linkedInUrl,
        title: contact.title,
      },
      company: {
        name: contact.company,
        industry_key: matchIndustryKey(contact.industry),
        industry_label: contact.industry,
        hq_city: '',
        hq_state: '',
        employee_count: contact.employeeCount,
        renewal_month: contact.renewalMonth,
        current_carrier: contact.currentCarrier,
      },
      persona: detectPersona(contact.title),
      signals: contact.signals ? {
        funding: contact.signals.funding_stage !== 'None' ? { stage: contact.signals.funding_stage, days_ago: contact.signals.funding_days_ago } : {},
        hiring: contact.signals.jobs_60d ? { jobs_60d: contact.signals.jobs_60d, intensity: getHiringIntensity(contact.signals.jobs_60d) } : {},
        hr_change: contact.signals.hr_change_title ? { title: contact.signals.hr_change_title, days_ago: contact.signals.hr_change_days_ago } : {},
        csuite: contact.signals.csuite_role ? { role: contact.signals.csuite_role, days_ago: contact.signals.csuite_days_ago } : {},
        carrier_change: contact.signals.carrier_change,
        talent_risk: contact.signals.talent_risk,
      } : { funding: {}, hiring: {}, hr_change: {}, csuite: {} },
      reach: {
        hasEmail: !!contact.email,
        hasPhone: !!contact.phone,
        hasLinkedIn: !!contact.linkedInUrl,
      },
      _rawSignals: contact.signals,
      manual_notes_for_ai: contact.manualNotesForAI,
      company_scrape: contact.companyScrape,
    };
  }, [contact]);

  if (!contact) return <Layout><div className="p-6"><p className="text-muted-foreground">Contact not found.</p><Button variant="outline" onClick={() => navigate('/contacts')}>Back</Button></div></Layout>;

  const campaign = campaigns.find(c => c.id === contact.campaignId);
  const progress = getContactProgress(contact);
  const presets = campaign?.weeklyPresets || [];
  const priority = getPriorityLabel(contact.signals);
  const persona = detectPersona(contact.title);
  const painPoints = inferBenefitsPainPoints(contact);

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-slide-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/contacts')}>
              <ArrowLeft size={16} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{contact.firstName} {contact.lastName}</h1>
              <p className="text-sm text-muted-foreground">{contact.title} at {contact.company}</p>
            </div>
            <StatusBadge status={contact.status} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit2 size={14} className="mr-1" /> Edit</Button>
            {contact.email && (
              <a
                href={`mailto:${contact.email}?subject=${encodeURIComponent(`Meeting Request — ${contact.firstName} ${contact.lastName} / OneDigital`)}&body=${encodeURIComponent(`Hi ${contact.firstName},\n\nI'd like to schedule a brief meeting to discuss how we can support ${contact.company}. Would any of these times work?\n\n• [Option 1]\n• [Option 2]\n• [Option 3]\n\nLooking forward to connecting.\n\nBest,`)}`}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium h-8"
              >
                <CalendarPlus size={14} /> Book Meeting via Outlook
              </a>
            )}
            {contact.status !== 'Hot' && (
              <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => bookMeeting(contact.id)}>
                <Trophy size={14} className="mr-1" /> Meeting Booked
              </Button>
            )}
            {contact.status !== 'Disqualified' && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setContactStatus(contact.id, 'Disqualified')}>
                <XCircle size={14} className="mr-1" /> Disqualify
              </Button>
            )}
            {(contact.status === 'Disqualified' || contact.status === 'Hot') && (
              <Button variant="outline" size="sm" onClick={() => reactivateContact(contact.id)}>
                <RotateCcw size={14} className="mr-1" /> Re-activate
              </Button>
            )}
          </div>
        </div>

        {/* Lead Quality Summary */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-primary" />
            <h3 className="font-semibold text-sm text-card-foreground">Lead Quality Summary</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <Badge variant="outline" className={`text-xs ${priority.className}`}>{priority.label} Priority</Badge>
            <Badge variant="secondary" className="text-xs">{contact.industry || 'General'}</Badge>
            <Badge variant="secondary" className="text-xs">{persona}</Badge>
            <Badge variant="outline" className="text-xs">{getEmployeeTier(contact.employeeCount)} EE</Badge>
            {contact.renewalMonth && <Badge variant="outline" className="text-xs">Renewal: {contact.renewalMonth}</Badge>}
            {contact.currentCarrier && <Badge variant="outline" className="text-xs">Carrier: {contact.currentCarrier}</Badge>}
          </div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-muted-foreground">Reachability:</span>
            <Mail size={14} className={contact.email ? 'text-primary' : 'text-muted-foreground/30'} />
            <Phone size={14} className={contact.phone ? 'text-primary' : 'text-muted-foreground/30'} />
            <Linkedin size={14} className={contact.linkedInUrl ? 'text-primary' : 'text-muted-foreground/30'} />
          </div>
          <SignalChips chips={buildChipsFromSignals(contact.signals)} />
        </div>

        {/* Company Overview (Collapsible) */}
        <Collapsible open={overviewOpen} onOpenChange={setOverviewOpen}>
          <div className="bg-card rounded-lg border border-border">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-accent/50 rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-primary" />
                <h3 className="font-semibold text-sm text-card-foreground">Company Overview</h3>
                {contact.companyScrape?.scrapedAt && (
                  <Badge variant="secondary" className="text-[10px] gap-1"><Sparkles size={10} /> AI Enriched</Badge>
                )}
              </div>
              <ChevronDown size={14} className={`text-muted-foreground transition-transform ${overviewOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-3">
                {/* Company Summary — scraped or inferred */}
                <div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {contact.companyScrape?.summary || buildCompanySummary(contact)}
                  </p>
                </div>

                {/* Scraped Key Facts */}
                {contact.companyScrape?.key_facts && contact.companyScrape.key_facts.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Key Facts</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {contact.companyScrape.key_facts.map((fact, i) => (
                        <li key={i} className="text-xs text-foreground">{fact}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Industry</p>
                    <p className="text-foreground font-medium">{contact.industry || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Employees</p>
                    <p className="text-foreground font-medium">{contact.employeeCount || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="text-foreground font-medium">{contact.source}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Carrier</p>
                    <p className="text-foreground font-medium">{contact.currentCarrier || '—'}</p>
                  </div>
                </div>

                {/* Growth Indicators */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Growth Indicators</p>
                  <div className="flex flex-wrap gap-1">
                    {contact.signals?.jobs_60d && contact.signals.jobs_60d >= 3 && (
                      <Badge variant="secondary" className="text-[10px]">Hiring: {contact.signals.jobs_60d} roles</Badge>
                    )}
                    {contact.signals?.funding_stage && contact.signals.funding_stage !== 'None' && (
                      <Badge variant="secondary" className="text-[10px]">{contact.signals.funding_stage}</Badge>
                    )}
                    {!contact.signals?.jobs_60d && (!contact.signals?.funding_stage || contact.signals.funding_stage === 'None') && (
                      <span className="text-xs text-muted-foreground italic">No growth signals detected</span>
                    )}
                  </div>
                </div>

                {/* Outreach Angles (from scrape) */}
                {contact.companyScrape?.outreach_angles && contact.companyScrape.outreach_angles.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Target size={10} /> AI-Suggested Outreach Angles</p>
                    <div className="flex flex-wrap gap-1">
                      {contact.companyScrape.outreach_angles.map((angle, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-primary/30 text-primary">{angle}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pain Points — scraped or inferred */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Likely Benefits Pain Points</p>
                  <div className="flex flex-wrap gap-1">
                    {(contact.companyScrape?.pain_points && contact.companyScrape.pain_points.length > 0
                      ? contact.companyScrape.pain_points
                      : painPoints
                    ).map((p, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{p}</Badge>
                    ))}
                  </div>
                </div>

                {/* Website Scrape Action */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Globe size={12} className="text-muted-foreground" />
                    <Input
                      placeholder={contact.website || 'Enter company website URL...'}
                      value={scrapeUrl}
                      onChange={e => setScrapeUrl(e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleScrape} disabled={scraping}>
                      {scraping ? <><Loader2 size={12} className="animate-spin" /> Scanning...</> : <><Sparkles size={12} /> {contact.companyScrape ? 'Re-scan' : 'Enrich from Website'}</>}
                    </Button>
                  </div>
                  {contact.companyScrape?.scrapedAt && (
                    <p className="text-[10px] text-muted-foreground mt-1">Last enriched: {new Date(contact.companyScrape.scrapedAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Additional Context (Notes to AI) */}
        {contact.manualNotesForAI && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="font-semibold text-sm text-card-foreground mb-2">Additional Context (Notes to AI)</h3>
            <p className="text-sm text-foreground">{contact.manualNotesForAI}</p>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg border border-border p-4 space-y-2">
            <h3 className="font-semibold text-sm text-card-foreground">Contact Info</h3>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Role: <span className="text-foreground">{contact.rolePersona}</span></p>
              <p className="text-muted-foreground">Industry: <span className="text-foreground">{contact.industry}</span></p>
              <p className="text-muted-foreground">Employees: <span className="text-foreground">{contact.employeeCount}</span></p>
              <p className="text-muted-foreground">Source: <span className="text-foreground">{contact.source}</span></p>
              {contact.renewalMonth && <p className="text-muted-foreground">Renewal: <span className="text-foreground">{contact.renewalMonth}</span></p>}
              {contact.currentCarrier && <p className="text-muted-foreground">Carrier: <span className="text-foreground">{contact.currentCarrier}</span></p>}
            </div>
            <div className="flex gap-2 pt-2">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="text-primary hover:text-primary/80 text-xs flex items-center gap-1">
                  <Mail size={12} /> {contact.email}
                </a>
              )}
            </div>
            {contact.linkedInUrl && (
              <a href={contact.linkedInUrl?.startsWith('http') ? contact.linkedInUrl : `https://${contact.linkedInUrl}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 text-xs flex items-center gap-1">
                <Linkedin size={12} /> LinkedIn Profile <ExternalLink size={10} />
              </a>
            )}
          </div>

          <div className="bg-card rounded-lg border border-border p-4 space-y-2">
            <h3 className="font-semibold text-sm text-card-foreground">Sequence Status</h3>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Campaign: <span className="text-foreground">{campaign?.name || 'None'}</span></p>
              <p className="text-muted-foreground">Current Week: <span className="text-foreground font-bold">{contact.currentWeek} / 12</span></p>
              <p className="text-muted-foreground">Start Date: <span className="text-foreground">{contact.startDate}</span></p>
              <p className="text-muted-foreground">Last Touch: <span className="text-foreground">{contact.lastTouchDate || '—'}</span></p>
              <p className="text-muted-foreground">Next Touch: <span className={`font-medium ${contact.nextTouchDate < new Date().toISOString().split('T')[0] ? 'text-destructive' : 'text-foreground'}`}>{contact.nextTouchDate || '—'}</span></p>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="font-semibold text-sm text-card-foreground mb-2">Progress</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-lg font-bold text-foreground">{progress}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{contact.touchLogs.length} total touches logged</p>
            {contact.notes && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Notes:</p>
                <p className="text-sm text-foreground">{contact.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* 12-Week Workflow */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
            <Calendar size={18} /> 12-Week Drip Workflow
          </h2>
          {/* Reason Selected */}
          <p className="text-xs text-muted-foreground mb-3">
            <span className="font-medium">Reason selected:</span> {reasonLine}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 12 }, (_, i) => {
              const week = i + 1;
              const wp = contact.weekProgress[i];
              const preset = presets[i] || { emailTheme: '', linkedInTouch: '', cta: '', asset: '', callObjective: '', callTalkTrack: '', voicemailScript: '' };
              return (
                <WeekPanel
                  key={week}
                  contactId={contact.id}
                  week={week}
                  emailTheme={preset.emailTheme}
                  linkedInTouch={preset.linkedInTouch}
                  cta={preset.cta}
                  asset={preset.asset}
                  callObjective={preset.callObjective}
                  callTalkTrack={preset.callTalkTrack}
                  voicemailScript={preset.voicemailScript}
                  liDone={wp.liDone}
                  emailDone={wp.emailDone}
                  phoneDone={wp.phoneDone}
                  outcome={wp.outcome}
                  notes={wp.notes}
                  isCurrent={week === contact.currentWeek}
                  isPast={week < contact.currentWeek}
                  leadData={leadData}
                />
              );
            })}
          </div>
        </div>

        {/* Touch Log */}
        {contact.touchLogs.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="font-semibold text-sm text-card-foreground mb-3">Touch Log</h3>
            <div className="space-y-2">
              {contact.touchLogs.slice().reverse().map(log => (
                <div key={log.id} className="flex items-center gap-3 text-sm py-2 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground w-20">{log.date}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${log.channel === 'LinkedIn' ? 'bg-info/10 text-info' : 'bg-primary/10 text-primary'}`}>{log.channel}</span>
                  <span className="text-muted-foreground">Week {log.weekNum}</span>
                  <span className="text-muted-foreground">Touch #{log.touchNum}</span>
                  {log.outcome && <span className="text-xs text-foreground">{log.outcome}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <ContactForm open={editing} onOpenChange={setEditing} editContact={contact} />
      </div>
    </Layout>
  );
}
