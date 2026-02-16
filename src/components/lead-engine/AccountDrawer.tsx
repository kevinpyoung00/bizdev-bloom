import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccountContacts, useUpdateDisposition, useUpdateAccountField } from '@/hooks/useLeadEngine';
import { Input } from '@/components/ui/input';
import { useClaimLead, useRejectLead, useStartCampaign, REJECT_REASONS } from '@/hooks/useLeadActions';
import { useGenerateDrip } from '@/hooks/useGenerateDrip';
import { LeadWithAccount } from '@/hooks/useLeadEngine';
import { useGenerateBrief } from '@/hooks/useAIGeneration';
import { Mail, Phone, Linkedin, ExternalLink, FileText, User, Loader2, Copy, Check, AlertCircle, Play, Pencil, Save, AlertTriangle } from 'lucide-react';
import SuggestedPersonaBadge from '@/components/SuggestedPersonaBadge';
import D365StatusBadge from '@/components/lead-engine/D365StatusBadge';
import { toast } from 'sonner';
import LeadStatusBadge from '@/components/lead-engine/LeadStatusBadge';
import DripWeekPanel from '@/components/lead-engine/DripWeekPanel';
import {
  getSignalStars, computeReachStars, signalStarsDisplay, reachStarsDisplay,
  getPriorityLabel, priorityBadgeColor, signalDetails, classifySignals
} from '@/lib/leadPriority';
import SignalChips, { buildChipsFromTriggers } from '@/components/crm/SignalChips';
import { detectPersona, PERSONA_LABELS, type PersonaTrack } from '@/lib/persona';
import { matchIndustryKey, getIndustryLabel } from '@/lib/industry';

interface AccountDrawerProps {
  lead: LeadWithAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AccountDrawer({ lead, open, onOpenChange }: AccountDrawerProps) {
  const { data: contacts = [] } = useAccountContacts(lead?.account?.id || null);
  const generateBrief = useGenerateBrief();
  const updateDisposition = useUpdateDisposition();
  const updateAccountField = useUpdateAccountField();
  const claimLead = useClaimLead();
  const rejectLead = useRejectLead();
  const startCampaign = useStartCampaign();
  const generateDrip = useGenerateDrip();

  const [briefMarkdown, setBriefMarkdown] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [personaOverride, setPersonaOverride] = useState<PersonaTrack | null>(null);
  const [showDrip, setShowDrip] = useState(false);
  const [generatingChannel, setGeneratingChannel] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [editingZywave, setEditingZywave] = useState(false);
  const [zywaveDraft, setZywaveDraft] = useState('');

  if (!lead) return null;
  const { account, reason, priority_rank } = lead;
  const rawReason = reason || {};
  const claimStatus = (lead as any).claim_status || 'new';

  const signalStars = getSignalStars(rawReason, account.triggers, contacts);
  const reachStars = computeReachStars(contacts, rawReason);
  const priority = getPriorityLabel(signalStars);
  const signals = signalDetails(account.triggers);
  const guardrail = rawReason.guardrail ?? null;
  const isBlocked = !!guardrail;

  // Persona detection
  const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0];
  const autoPersona = detectPersona(primaryContact?.title);
  const persona = personaOverride || (lead as any).persona || autoPersona;
  const industryKey = (lead as any).industry_key || matchIndustryKey(account.industry);
  const industryLabel = getIndustryLabel(industryKey);

  // Trigger detection for chips
  const triggersFired = rawReason.triggers_fired ?? { hiring: false, role_change: false, funding: false, csuite: false };

  // Reachability breakdown
  const hasEmail = (rawReason.contact_email ?? 0) > 0 || contacts.some((c: any) => c.email);
  const hasPhone = (rawReason.contact_phone ?? 0) > 0 || contacts.some((c: any) => c.phone);
  const hasLinkedIn = (rawReason.contact_linkedin ?? 0) > 0 || contacts.some((c: any) => c.linkedin_url);

  // D365 status helpers
  const d365Status = (account as any).d365_status || 'unknown';
  const d365OwnerName = (account as any).d365_owner_name;
  const showD365Section = d365Status === 'owned' && d365OwnerName;

  // Zywave helpers
  const zywaveId = (account as any).zywave_id;

  const handleZywaveSearch = () => {
    const searchText = `${account.name || ''} ${account.hq_state || ''}`.trim();
    navigator.clipboard.writeText(searchText);
    window.open('https://miedge.zywave.com/edge/eb', '_blank', 'noopener');
    toast.success(`Copied '${searchText}' — paste in Zywave's search`);
  };

  // Build lead data for drip generation
  const buildLeadData = () => {
    const triggers = account.triggers || {};
    return {
      lead_queue_id: lead.id,
      company_name: account.name,
      industry_key: industryKey,
      industry_label: industryLabel,
      hq_city: account.hq_city,
      hq_state: account.hq_state,
      employee_count: account.employee_count,
      persona,
      signals: {
        funding: triggers.funding || triggers.expansion ? { stage: triggers.funding?.stage, days_ago: (triggers.funding?.months_ago || 12) * 30 } : undefined,
        hiring: triggers.open_roles_60d || triggers.hiring_velocity ? { jobs_60d: triggers.open_roles_60d || triggers.hiring_velocity, intensity: classifySignals(triggers).hiring_size } : undefined,
        hr_change: triggers.recent_role_changes ? { title: Array.isArray(triggers.recent_role_changes) ? triggers.recent_role_changes[0]?.title : triggers.recent_role_changes?.title, days_ago: Array.isArray(triggers.recent_role_changes) ? triggers.recent_role_changes[0]?.days_ago : triggers.recent_role_changes?.days_ago } : undefined,
        csuite: triggers.c_suite_changes ? { role: triggers.c_suite_changes?.title || triggers.c_suite_changes?.role, days_ago: (triggers.c_suite_changes?.months_ago || 6) * 30 } : undefined,
      },
      contact: primaryContact ? { first_name: primaryContact.first_name } : undefined,
      reach: { email: hasEmail, phone: hasPhone, linkedin: hasLinkedIn },
    };
  };

  const handleGenerate = async (week: number, channel: string) => {
    setGeneratingChannel(channel);
    try {
      const result = await generateDrip.mutateAsync({
        week,
        channel,
        leadData: buildLeadData(),
        accountId: account.id,
        contactId: primaryContact?.id,
      });
      return result;
    } finally {
      setGeneratingChannel(null);
    }
  };

  const handleClaim = () => {
    claimLead.mutate({
      leadId: lead.id,
      contactTitle: primaryContact?.title,
      accountIndustry: account.industry || undefined,
    });
  };

  const handleReject = (reason: string) => {
    rejectLead.mutate({ leadId: lead.id, reason });
    setRejectReason(null);
  };

  const handleStartCampaign = () => {
    startCampaign.mutate([lead.id]);
    setShowDrip(true);
  };

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isLocked = claimStatus !== 'uploaded' && claimStatus !== 'in_campaign';

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setBriefMarkdown(null); setShowDrip(false); setPersonaOverride(null); } }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" onCloseAutoFocus={() => { setBriefMarkdown(null); setShowDrip(false); setPersonaOverride(null); setEditingZywave(false); }}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{account.name}</span>
            <Badge variant="secondary">#{priority_rank}</Badge>
            <LeadStatusBadge status={claimStatus} />
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Guardrail banner */}
          {isBlocked && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <AlertCircle size={16} className="text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">
                {guardrail?.includes('domain') ? 'Score withheld: missing domain/website' : 'Score withheld: disposition is rejected/suppressed'}
              </p>
            </div>
          )}

          {/* Dual Star Display */}
          <div className="border border-border rounded-lg p-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16">Signals</span>
                <span className="text-xl font-bold tracking-wide" style={{ color: '#FFA500' }}>{signalStarsDisplay(signalStars)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16">Reach</span>
                <span className="text-xl font-bold tracking-wide" style={{ color: '#1E90FF' }}>{reachStarsDisplay(reachStars)}</span>
              </div>
              <Badge variant="outline" className={`w-fit text-xs mt-1 ${priorityBadgeColor(priority)}`}>
                {priority.toUpperCase()} PRIORITY
              </Badge>
            </div>
          </div>

          {/* Persona + Industry */}
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <span className="text-xs text-muted-foreground">Persona: </span>
              <Select value={persona} onValueChange={(v) => setPersonaOverride(v as PersonaTrack)}>
                <SelectTrigger className="h-7 w-40 text-xs inline-flex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERSONA_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!personaOverride && <span className="text-[10px] text-muted-foreground ml-1">(Auto)</span>}
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Industry: </span>
              <Badge variant="outline" className="text-xs">{industryLabel}</Badge>
            </div>
          </div>

          {/* D365 Ownership — only show if owned with owner name */}
          {showD365Section && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">D365:</span>
              <D365StatusBadge status={d365Status} ownerName={d365OwnerName} d365AccountId={(account as any).d365_account_id} />
            </div>
          )}

          {/* D365 status chip (always visible, subtle) */}
          {!showD365Section && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">D365:</span>
              <D365StatusBadge status={d365Status} ownerName={null} d365AccountId={null} />
            </div>
          )}

          {/* Zywave — editable */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Zywave:</span>
            {editingZywave ? (
              <div className="flex items-center gap-1">
                <Input className="h-7 w-48 text-xs" placeholder="Zywave ID or URL" value={zywaveDraft} onChange={e => setZywaveDraft(e.target.value)} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                  updateAccountField.mutate({ accountId: account.id, field: 'zywave_id', value: zywaveDraft.trim() || null });
                  setEditingZywave(false);
                  toast.success('Zywave ID updated');
                }}><Save size={12} /></Button>
              </div>
            ) : (
              <>
                {zywaveId ? (
                  <a href="https://miedge.zywave.com/edge/eb" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <ExternalLink size={12} /> Open Zywave
                  </a>
                ) : (
                  <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={(e) => { e.stopPropagation(); handleZywaveSearch(); }}>
                    <ExternalLink size={12} /> Zywave — Search EB
                  </button>
                )}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setZywaveDraft(zywaveId || ''); setEditingZywave(true); }}>
                  <Pencil size={11} />
                </Button>
              </>
            )}
          </div>

          {/* Contact / Suggested Persona */}
          <div className="border border-border rounded-lg p-3">
            {primaryContact ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <User size={12} className="text-primary" />
                  <span className="text-xs font-semibold text-foreground">Primary Contact</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">{primaryContact.first_name} {primaryContact.last_name}</span>
                  {primaryContact.title && <p className="text-xs text-muted-foreground">{primaryContact.title}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  {primaryContact.email && (
                    <a href={`mailto:${primaryContact.email}`} className="text-xs text-primary flex items-center gap-1 hover:underline" onClick={e => e.stopPropagation()}>
                      <Mail size={12} /> {primaryContact.email}
                    </a>
                  )}
                  {primaryContact.phone && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={12} /> {primaryContact.phone}</span>
                  )}
                  {primaryContact.linkedin_url && (
                    <a href={primaryContact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline" onClick={e => e.stopPropagation()}>
                      <Linkedin size={12} /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <SuggestedPersonaBadge
                employeeCount={account.employee_count}
                industryKey={industryKey}
                signals={rawReason}
                companyName={account.name}
                zywaveId={zywaveId}
                hqState={account.hq_state}
                variant="full"
              />
            )}
          </div>

          {/* Signal Details */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Signal Breakdown</h3>
            <SignalChips chips={buildChipsFromTriggers(account.triggers)} />
            {signals.length > 0 && (
              <ul className="space-y-1 mt-3">{signals.map((s, i) => <li key={i} className="text-sm text-foreground">{s}</li>)}</ul>
            )}
          </div>

          <Separator />

          {/* Reachability */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Reachability</h3>
            <div className="flex flex-wrap gap-4">
              {[{ icon: Mail, label: 'Email', has: hasEmail }, { icon: Phone, label: 'Phone', has: hasPhone }, { icon: Linkedin, label: 'LinkedIn', has: hasLinkedIn }].map(({ icon: Icon, label, has }) => (
                <div key={label} className={`flex items-center gap-1.5 text-xs ${has ? 'font-medium' : 'text-muted-foreground opacity-50'}`} style={has ? { color: '#1E90FF' } : {}}>
                  <Icon size={12} /> {label} {has ? '✓' : '✗'}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Firmographics */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Firmographics</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Domain:</span> <span className="text-foreground">{account.domain || '—'}</span></div>
              <div><span className="text-muted-foreground">Industry:</span> <span className="text-foreground">{account.industry || '—'}</span></div>
              <div><span className="text-muted-foreground">Employees:</span> <span className="text-foreground">{account.employee_count || '—'}</span></div>
              <div><span className="text-muted-foreground">Location:</span> <span className="text-foreground">{account.hq_city}, {account.hq_state}</span></div>
              <div><span className="text-muted-foreground">Geography:</span> <Badge variant="outline" className="text-xs">{account.geography_bucket}</Badge></div>
              {account.website && (
                <div>
                  <a href={account.website.startsWith('http') ? account.website : `https://${account.website}`} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1 hover:underline" onClick={e => e.stopPropagation()}>
                    <ExternalLink size={12} /> Website
                  </a>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Contacts */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Contacts ({contacts.length})</h3>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts imported yet.</p>
            ) : (
              <div className="space-y-3">
                {contacts.map((c: any) => (
                  <div key={c.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={14} className="text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{c.first_name} {c.last_name}</span>
                      {c.is_primary && <Badge className="text-[10px] px-1.5 py-0">Primary</Badge>}
                      <Badge variant="outline" className="text-[9px]">{PERSONA_LABELS[detectPersona(c.title)] || 'General'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.title || '—'}</p>
                    <div className="flex gap-3 mt-2">
                      {c.email && <a href={`mailto:${c.email}`} className="text-xs text-primary flex items-center gap-1 hover:underline" onClick={e => e.stopPropagation()}><Mail size={12} /> {c.email}</a>}
                      {c.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={12} /> {c.phone}</span>}
                      {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline" onClick={e => e.stopPropagation()}><Linkedin size={12} /> LinkedIn</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Actions — Bottom action bar */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Actions</h3>
            <div className="flex flex-wrap gap-2">
              {claimStatus === 'new' && (
                <>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleClaim} disabled={claimLead.isPending}>
                    {claimLead.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                    Claim
                  </Button>
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={async () => {
                    await (await import('@/integrations/supabase/client')).supabase.from('accounts').update({ needs_review: true } as any).eq('id', account.id);
                    toast.success('Sent to Needs Review');
                  }}>
                    <AlertTriangle size={14} className="mr-1" /> Review
                  </Button>
                  {rejectReason === null ? (
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setRejectReason('')}>Reject</Button>
                  ) : (
                    <Select onValueChange={handleReject}>
                      <SelectTrigger className="h-8 w-48 text-xs">
                        <SelectValue placeholder="Select reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        {REJECT_REASONS.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}
              {claimStatus === 'uploaded' && (
                <Button size="sm" onClick={handleStartCampaign} disabled={startCampaign.isPending}>
                  <Play size={14} className="mr-1" /> Start Campaign
                </Button>
              )}
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={async () => {
                try {
                  const result = await generateBrief.mutateAsync(account.id);
                  setBriefMarkdown(result.brief);
                  toast.success('Analysis generated!');
                } catch (e: any) { toast.error(e.message); }
              }} disabled={generateBrief.isPending}>
                {generateBrief.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <FileText size={14} className="mr-1" />}
                Analysis
              </Button>
            </div>
          </div>

          {/* Brief / Analysis */}
          {briefMarkdown && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Generated Analysis</h3>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => copyText(briefMarkdown, 'brief')}>
                    {copiedField === 'brief' ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                  </Button>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4 text-sm text-foreground prose prose-sm max-w-none whitespace-pre-wrap">{briefMarkdown}</div>
              </div>
            </>
          )}

          {/* Drip Weeks */}
          {(claimStatus === 'uploaded' || claimStatus === 'in_campaign' || showDrip) && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">12-Week Drip Cadence</h3>
                <div className="space-y-3">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(week => (
                    <DripWeekPanel
                      key={week}
                      week={week}
                      persona={persona}
                      industryKey={industryKey}
                      leadData={buildLeadData()}
                      onGenerate={handleGenerate}
                      isGenerating={generateDrip.isPending}
                      generatingChannel={generatingChannel}
                      locked={isLocked}
                      hasEmail={hasEmail}
                      hasPhone={hasPhone}
                      hasLinkedIn={hasLinkedIn}
                      isUnsubscribed={!!(account as any).unsubscribed}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
