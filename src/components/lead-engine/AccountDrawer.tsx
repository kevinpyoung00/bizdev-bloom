import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccountContacts, useUpdateDisposition } from '@/hooks/useLeadEngine';
import { LeadWithAccount } from '@/hooks/useLeadEngine';
import { useGenerateBrief, useGenerateEmail } from '@/hooks/useAIGeneration';
import { Mail, Phone, Linkedin, ExternalLink, Send, Download, FileText, User, Loader2, Copy, Check, AlertTriangle, ShieldX, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { getStars, starsDisplay, starsColor, starsLabel, signalDetails, getActionOrder } from '@/lib/leadPriority';

interface AccountDrawerProps {
  lead: LeadWithAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DISPOSITION_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'rejected_existing_client', label: 'Rejected – Existing Client' },
  { value: 'rejected_owned_by_other_rep', label: 'Rejected – Owned by Other Rep' },
  { value: 'rejected_bad_fit', label: 'Rejected – Bad Fit' },
  { value: 'rejected_no_opportunity', label: 'Rejected – No Opportunity' },
  { value: 'suppressed', label: 'Suppressed' },
];

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-10 text-right text-foreground">{value}/{max}</span>
    </div>
  );
}

export default function AccountDrawer({ lead, open, onOpenChange }: AccountDrawerProps) {
  const { data: contacts = [] } = useAccountContacts(lead?.account?.id || null);
  const generateBrief = useGenerateBrief();
  const generateEmail = useGenerateEmail();
  const updateDisposition = useUpdateDisposition();

  const [briefMarkdown, setBriefMarkdown] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string; persona: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!lead) return null;
  const { account, score, reason, priority_rank } = lead;
  const rawReason = reason || {};
  // Normalize old field names (industry_fit, size_fit, geo_fit, bonus) to new names
  const r = {
    industry: rawReason.industry ?? rawReason.industry_fit ?? 0,
    size: rawReason.size ?? rawReason.size_fit ?? 0,
    hiring: rawReason.hiring ?? 0,
    c_suite: rawReason.c_suite ?? 0,
    recent_role_change: rawReason.recent_role_change ?? 0,
    funding: rawReason.funding ?? 0,
    reachability: rawReason.reachability ?? rawReason.bonus ?? 0,
    raw: rawReason.raw ?? null,
    normalized: rawReason.normalized ?? null,
    guardrail: rawReason.guardrail ?? null,
    signals: rawReason.signals ?? null,
    stars: rawReason.stars ?? null,
  };
  // Compute raw/normalized if not stored
  const computedRaw = r.raw ?? (r.industry + r.size + r.hiring + r.c_suite + r.recent_role_change + r.funding + r.reachability);
  const computedNormalized = r.normalized ?? Math.min(100, Math.round((computedRaw / 110) * 1000) / 10);
  const disposition = account.disposition || 'active';
  const stars = getStars(r, account.triggers);
  const signals = signalDetails(account.triggers);
  const actionOrder = getActionOrder(account.triggers);

  const isBlocked = !!r.guardrail;

  const handleGenerateBrief = async () => {
    try {
      const result = await generateBrief.mutateAsync(account.id);
      setBriefMarkdown(result.brief);
      toast.success('Account brief generated!');
    } catch (e: any) { toast.error(e.message || 'Failed to generate brief'); }
  };

  const handleGenerateEmail = async (persona: 'CFO' | 'HR') => {
    try {
      const result = await generateEmail.mutateAsync({ accountId: account.id, persona });
      setEmailDraft({ subject: result.subject, body: result.body, persona });
      toast.success(`${persona} email drafted!`);
    } catch (e: any) { toast.error(e.message || 'Failed to generate email'); }
  };

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Build action buttons in signal-driven order
  const actionButtons = actionOrder.map((action) => {
    switch (action) {
      case 'push': return <Button key="push" size="sm"><Send size={14} className="mr-1" /> Claim & Push</Button>;
      case 'hr': return (
        <Button key="hr" size="sm" variant="outline" onClick={() => handleGenerateEmail('HR')} disabled={generateEmail.isPending}>
          {generateEmail.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Mail size={14} className="mr-1" />} HR Draft
        </Button>
      );
      case 'cfo': return (
        <Button key="cfo" size="sm" variant="outline" onClick={() => handleGenerateEmail('CFO')} disabled={generateEmail.isPending}>
          {generateEmail.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Mail size={14} className="mr-1" />} CFO Draft
        </Button>
      );
      case 'growth': return (
        <Button key="growth" size="sm" variant="outline" onClick={() => handleGenerateEmail('HR')} disabled={generateEmail.isPending}>
          {generateEmail.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Mail size={14} className="mr-1" />} Growth Email
        </Button>
      );
      case 'brief': return (
        <Button key="brief" size="sm" variant="outline" onClick={handleGenerateBrief} disabled={generateBrief.isPending}>
          {generateBrief.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <FileText size={14} className="mr-1" />} Brief
        </Button>
      );
      case 'export': return (
        <Button key="export" size="sm" variant="outline" onClick={() => {
          const rows = contacts.map((c: any) => ({
            'First Name': c.first_name, 'Last Name': c.last_name,
            Title: c.title || '', Email: c.email || '', Phone: c.phone || '',
            LinkedIn: c.linkedin_url || '', Company: account.name, Domain: account.domain || '',
          }));
          if (rows.length === 0) { toast.info('No contacts to export'); return; }
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
          XLSX.writeFile(wb, `${(account.domain || account.name).replace(/\W/g, '-')}-contacts.csv`);
          toast.success(`Exported ${rows.length} contacts`);
        }}><Download size={14} className="mr-1" /> Export CSV</Button>
      );
      default: return null;
    }
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setBriefMarkdown(null); setEmailDraft(null); } }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{account.name}</span>
            <span className={`text-lg ${starsColor(stars)}`} title={starsLabel(stars)}>{starsDisplay(stars)}</span>
            <Badge variant="secondary">#{priority_rank}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Guardrail banner */}
          {isBlocked && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <AlertCircle size={16} className="text-destructive shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Score blocked by guardrail</p>
                <p className="text-xs text-destructive/80">{r.guardrail?.replace(/_/g, ' ')}</p>
              </div>
            </div>
          )}

          {/* Stars + Signals */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Signals</h3>
            {signals.length > 0 ? (
              <ul className="space-y-1">
                {signals.map((s, i) => (
                  <li key={i} className="text-sm text-foreground">{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No timing signals detected.</p>
            )}
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
                  <a href={account.website.startsWith('http') ? account.website : `https://${account.website}`} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1 hover:underline">
                    <ExternalLink size={12} /> Website
                  </a>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Disposition */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Disposition</h3>
            <Select value={disposition} onValueChange={(val) => updateDisposition.mutate({ accountId: account.id, disposition: val })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISPOSITION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Priority Outreach Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Priority Outreach Breakdown</h3>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Fit (0–40)</p>
              <ScoreBar label="Industry" value={r.industry ?? 0} max={20} />
              <ScoreBar label="Size" value={r.size ?? 0} max={20} />
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mt-3">Timing (0–60)</p>
              <ScoreBar label="Hiring" value={r.hiring ?? 0} max={25} />
              <ScoreBar label="C-Suite Movement" value={r.c_suite ?? 0} max={20} />
              <ScoreBar label="Recent Role Change" value={r.recent_role_change ?? 0} max={10} />
              <ScoreBar label="Funding / Expansion" value={r.funding ?? 0} max={5} />
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mt-3">Reachability (0–10)</p>
              <ScoreBar label="Contact Data" value={r.reachability ?? 0} max={10} />
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Raw / Normalized</span>
                <span className="font-bold text-foreground">{computedRaw} / 110 → {computedNormalized}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Reasons JSON */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Reasons (raw)</h3>
            <pre className="text-xs bg-secondary p-2 rounded-md overflow-x-auto text-muted-foreground max-h-40 overflow-y-auto">
              {JSON.stringify(r, null, 2)}
            </pre>
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
                      {c.is_primary && <Badge className="text-[10px] px-1.5 py-0">Best Fit</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.title || '—'} • {c.department || '—'}</p>
                    <div className="flex gap-3 mt-2">
                      {c.email && <a href={`mailto:${c.email}`} className="text-xs text-primary flex items-center gap-1 hover:underline"><Mail size={12} /> {c.email}</a>}
                      {c.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={12} /> {c.phone}</span>}
                      {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline"><Linkedin size={12} /> LinkedIn</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Notes */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3>
            <p className="text-sm text-muted-foreground">{account.notes || 'No notes.'}</p>
          </div>

          <Separator />

          {/* Actions (signal-ordered) */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Actions</h3>
            <div className="flex flex-wrap gap-2">{actionButtons}</div>
          </div>

          {/* Generated Brief */}
          {briefMarkdown && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Generated Brief</h3>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => copyText(briefMarkdown, 'brief')}>
                    {copiedField === 'brief' ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                  </Button>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4 text-sm text-foreground prose prose-sm max-w-none whitespace-pre-wrap">{briefMarkdown}</div>
              </div>
            </>
          )}

          {/* Generated Email Draft */}
          {emailDraft && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">{emailDraft.persona} Email Draft</h3>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => copyText(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`, 'email')}>
                    {copiedField === 'email' ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                  </Button>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">Subject: {emailDraft.subject}</p>
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{emailDraft.body}</pre>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
