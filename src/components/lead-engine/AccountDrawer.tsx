import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAccountContacts } from '@/hooks/useLeadEngine';
import { LeadWithAccount } from '@/hooks/useLeadEngine';
import { useGenerateBrief, useGenerateEmail } from '@/hooks/useAIGeneration';
import { Mail, Phone, Linkedin, ExternalLink, Send, Download, FileText, User, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface AccountDrawerProps {
  lead: LeadWithAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right text-foreground">{value}/{max}</span>
    </div>
  );
}

function getTopTrigger(triggers: any): string {
  if (!triggers) return '—';
  if (triggers.open_roles_60d >= 10) return `Hiring: ${triggers.open_roles_60d} roles`;
  if (triggers.c_suite_changes) return 'C-Suite Change';
  if (triggers.funding) return 'Funding/Expansion';
  if (triggers.open_roles_60d > 0) return `Hiring: ${triggers.open_roles_60d} roles`;
  return '—';
}

export { getTopTrigger };

export default function AccountDrawer({ lead, open, onOpenChange }: AccountDrawerProps) {
  const { data: contacts = [] } = useAccountContacts(lead?.account?.id || null);
  const generateBrief = useGenerateBrief();
  const generateEmail = useGenerateEmail();

  const [briefMarkdown, setBriefMarkdown] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string; persona: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!lead) return null;
  const { account, score, reason, priority_rank } = lead;
  const r = reason || {};

  const handleGenerateBrief = async () => {
    try {
      const result = await generateBrief.mutateAsync(account.id);
      setBriefMarkdown(result.brief);
      toast.success('Account brief generated!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate brief');
    }
  };

  const handleGenerateEmail = async (persona: 'CFO' | 'HR') => {
    try {
      const result = await generateEmail.mutateAsync({ accountId: account.id, persona });
      setEmailDraft({ subject: result.subject, body: result.body, persona });
      toast.success(`${persona} email drafted!`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate email');
    }
  };

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setBriefMarkdown(null); setEmailDraft(null); } }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span className="text-lg">{account.name}</span>
            <Badge variant="outline" className="text-primary font-bold text-sm">{score}</Badge>
            <Badge variant="secondary">#{priority_rank}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
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

          {/* Triggers */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Triggers</h3>
            <p className="text-sm text-foreground">{getTopTrigger(account.triggers)}</p>
            {account.triggers && typeof account.triggers === 'object' && (
              <pre className="mt-2 text-xs bg-secondary p-2 rounded-md overflow-x-auto text-muted-foreground">
                {JSON.stringify(account.triggers, null, 2)}
              </pre>
            )}
          </div>

          <Separator />

          {/* Score Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Score Breakdown</h3>
            <div className="space-y-2">
              <ScoreBar label="Industry Fit" value={r.industry_fit ?? 0} max={18} />
              <ScoreBar label="Size Fit" value={r.size_fit ?? 0} max={18} />
              <ScoreBar label="Geography" value={r.geo_fit ?? 0} max={24} />
              <ScoreBar label="Hiring Velocity" value={r.hiring ?? 0} max={20} />
              <ScoreBar label="C-Suite Movement" value={r.c_suite ?? 0} max={12} />
              <ScoreBar label="Funding" value={r.funding ?? 0} max={8} />
              {r.bonus > 0 && <ScoreBar label="High-Growth Bonus" value={r.bonus} max={5} />}
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
                      {c.is_primary && <Badge className="text-[10px] px-1.5 py-0">Best Fit</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.title || '—'} • {c.department || '—'}</p>
                    <div className="flex gap-3 mt-2">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-xs text-primary flex items-center gap-1 hover:underline">
                          <Mail size={12} /> {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone size={12} /> {c.phone}
                        </span>
                      )}
                      {c.linkedin_url && (
                        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                          <Linkedin size={12} /> LinkedIn
                        </a>
                      )}
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

          {/* AI Actions */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">AI Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleGenerateBrief} disabled={generateBrief.isPending}>
                {generateBrief.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <FileText size={14} className="mr-1" />}
                Generate Brief
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleGenerateEmail('CFO')} disabled={generateEmail.isPending}>
                {generateEmail.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Mail size={14} className="mr-1" />}
                CFO Email
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleGenerateEmail('HR')} disabled={generateEmail.isPending}>
                {generateEmail.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Mail size={14} className="mr-1" />}
                HR Email
              </Button>
              <Button size="sm"><Send size={14} className="mr-1" /> Push to CRM</Button>
              <Button size="sm" variant="outline"><Download size={14} className="mr-1" /> Export CSV</Button>
            </div>
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
                <div className="bg-secondary/50 rounded-lg p-4 text-sm text-foreground prose prose-sm max-w-none whitespace-pre-wrap">
                  {briefMarkdown}
                </div>
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
