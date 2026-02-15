import { useCrm } from '@/store/CrmContext';
import { TouchOutcome, isCallWeek } from '@/types/crm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Mail, Linkedin, Phone, Copy, Check as CheckIcon, ExternalLink, PhoneCall } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getWeekTheme } from '@/lib/weekThemes';

const outcomes: (TouchOutcome | '')[] = ['', 'No Response', 'Positive Reply', 'Negative Reply', 'Meeting Booked', 'Bad Fit', 'Bounced'];

/* ── Token merge helper ── */

function renderWithTokens(template: string, lead: any): string {
  const get = (p: string, d: any) => p.split('.').reduce((o: any, k: string) => (o && o[k] !== undefined ? o[k] : undefined), d);
  return template.replace(/{{\s*([^}|]+?)\s*(\|\s*"([^"]*)")?\s*}}/g, (_m, path, _f, fallback) => {
    const v = get(String(path).trim(), lead);
    return (v !== undefined && v !== null && String(v).trim() !== '') ? String(v) : (fallback !== undefined ? fallback : '');
  });
}

export interface WeekPanelLeadData {
  contact: { first_name: string; last_name: string; full_name: string; email: string; phone: string; linkedin_url: string; title: string };
  company: { name: string; domain?: string; industry_key?: string; industry_label?: string; hq_city?: string; hq_state?: string; employee_count?: string; renewal_month?: string; current_carrier?: string };
  persona: string;
  signals: {
    funding: { stage?: string; days_ago?: number };
    hiring: { jobs_60d?: number; intensity?: string };
    hr_change: { title?: string; days_ago?: number };
    csuite: { role?: string; days_ago?: number };
  };
  reach: { hasEmail: boolean; hasPhone: boolean; hasLinkedIn: boolean };
}

interface Props {
  contactId: string;
  week: number;
  emailTheme: string;
  linkedInTouch: string;
  cta: string;
  asset: string;
  callObjective?: string;
  callTalkTrack?: string;
  voicemailScript?: string;
  liDone: boolean;
  emailDone: boolean;
  phoneDone: boolean;
  outcome: TouchOutcome | '';
  notes: string;
  isCurrent: boolean;
  isPast: boolean;
  isUnsubscribed?: boolean;
  leadData?: WeekPanelLeadData;
}

/* ── Draft generators ── */

function getWeek1Draft(channel: 'email' | 'linkedin' | 'phone'): string {
  if (channel === 'email') {
    return `Hi {{contact.first_name | "there"}},

I came across {{company.name | "your company"}} while reviewing growth-stage firms in {{company.hq_city | "your area"}} — {{signals.funding.stage | "your recent momentum"}} caught my attention.

For companies in the 50–150 employee range, this is often the inflection point where benefits strategy shifts from reactive to competitive. We work with similar organizations to turn that transition into a talent advantage.

Would you have 10–15 minutes next week to explore whether there's a fit?

Best,`;
  }
  if (channel === 'linkedin') {
    return `Hi {{contact.first_name | "there"}} — I noticed {{company.name | "your company"}}'s recent growth and wanted to connect. We help similar firms turn benefits into a talent advantage. Happy to share a brief if helpful.`;
  }
  return `TALKING POINTS:
• Reference {{signals.funding.stage | "recent company momentum"}}
• Mention working with similar 50–150 EE firms in {{company.hq_city | "their area"}}
• Position benefits strategy as a talent lever
• Ask about current renewal timeline
• Offer a 10–15 min intro call

VOICEMAIL (≤20s):
"Hi {{contact.first_name | "there"}}, this is [name] with OneDigital. I noticed {{company.name | "your company"}}'s recent growth and wanted to share how similar firms are turning benefits into a competitive advantage. I'll drop you a note — would love to connect."`;
}

const WEEK_EMAIL_TEMPLATES: Record<number, string> = {
  2: `Hi {{contact.first_name | "there"}},

Following up on my earlier note — many leaders in your role are navigating the tension between rising benefits costs and the need to stay competitive on talent.

At {{company.name | "your company"}}'s size, small shifts in plan design can unlock meaningful savings without sacrificing employee experience. We've helped similar firms recapture 10–15% on renewals.

Worth a quick conversation?

Best,`,
  3: `Hi {{contact.first_name | "there"}},

I wanted to share a resource that's been resonating with teams like yours — a practical guide on aligning HR compliance with growth-stage operations.

It's a quick read and covers the gaps that tend to surface between 50 and 150 employees. Happy to send it over if useful.

Best,`,
  4: `Hi {{contact.first_name | "there"}},

A trend we're seeing across {{company.industry_label | "your industry"}}: companies are re-evaluating their benefits positioning as a competitive differentiator, not just a cost center.

The firms getting ahead are the ones benchmarking against peers and adjusting proactively. I'd be glad to share what we're seeing in your space.

Best,`,
  5: `Hi {{contact.first_name | "there"}},

With {{company.renewal_month | "your next renewal"}} approaching, now is the window to evaluate whether your current plan structure is still the right fit.

We typically recommend starting the review process 90–120 days out to preserve leverage with carriers. Happy to walk through what that looks like.

Best,`,
  6: `Hi {{contact.first_name | "there"}},

One area where we've seen outsized impact: tying benefits communications directly to employee experience metrics.

Companies that invest in how they communicate benefits — not just what they offer — see measurably higher satisfaction and retention. Worth exploring?

Best,`,
  7: `Hi {{contact.first_name | "there"}},

Cost containment doesn't have to mean cutting coverage. The most effective levers we see at {{company.name | "your company"}}'s stage are plan design optimization, contribution strategy, and pharmacy carve-outs.

Would it be helpful to see how similar firms have reduced spend without reducing value?

Best,`,
  8: `Hi {{contact.first_name | "there"}},

As {{company.name | "your company"}} scales, the HR technology stack becomes a force multiplier — or a bottleneck. We're helping firms at your stage align BenAdmin, payroll, and compliance tools into a single ecosystem.

Happy to share what's working for companies in {{company.hq_city | "your area"}}.

Best,`,
  9: `Hi {{contact.first_name | "there"}},

Compliance requirements are shifting again this year, and the firms that stay ahead tend to be the ones with a structured review cadence.

We've put together a brief on the key regulatory updates impacting companies at your size. Want me to send it your way?

Best,`,
  10: `Hi {{contact.first_name | "there"}},

I wanted to share a quick proof point: a firm similar to {{company.name | "your company"}} — same industry, similar headcount — restructured their benefits strategy and saw a 12% cost reduction while improving employee satisfaction scores.

Happy to walk through the specifics if that resonates.

Best,`,
  11: `Hi {{contact.first_name | "there"}},

Quick question: if you could change one thing about how {{company.name | "your company"}} approaches benefits and HR strategy, what would it be?

No pitch — genuinely curious. Either way, happy to be a resource.

Best,`,
  12: `Hi {{contact.first_name | "there"}},

I've reached out a few times and I want to be respectful of your time. If benefits strategy isn't a priority right now, completely understood.

That said — if circumstances change, I'd welcome the chance to help {{company.name | "your company"}} turn benefits into a talent advantage. My door is always open.

Best,`,
};

function getDripDraft(week: number, channel: 'email' | 'linkedin' | 'phone'): string {
  const theme = getWeekTheme(week);
  if (channel === 'email') {
    return WEEK_EMAIL_TEMPLATES[week] || `Hi {{contact.first_name | "there"}},\n\n[Week ${week}: ${theme.theme}]\n\nBest,`;
  }
  if (channel === 'linkedin') {
    const liTemplates: Record<number, string> = {
      2: `Hi {{contact.first_name | "there"}} — wanted to follow up on benefits strategy for growing teams like {{company.name | "your company"}}. Happy to share a quick benchmark if useful.`,
      3: `Hi {{contact.first_name | "there"}} — we put together an HR compliance guide for firms at your stage. Happy to share the brief if you're interested.`,
      4: `Hi {{contact.first_name | "there"}} — seeing some interesting trends in {{company.industry_label | "your industry"}} around benefits as a talent lever. Worth a quick exchange?`,
      5: `Hi {{contact.first_name | "there"}} — with renewal season ahead, wanted to flag a few strategies that have helped similar firms. Happy to share.`,
      6: `Hi {{contact.first_name | "there"}} — curious how {{company.name | "your company"}} approaches benefits communications. We've seen it move the needle on retention.`,
      7: `Hi {{contact.first_name | "there"}} — cost containment without cutting coverage is possible. Happy to share what's working for similar firms.`,
      8: `Hi {{contact.first_name | "there"}} — as you scale, aligning HR tech can be a game-changer. Happy to share what we're seeing work.`,
      9: `Hi {{contact.first_name | "there"}} — compliance updates are shifting again. We have a brief that may be relevant — happy to share.`,
      10: `Hi {{contact.first_name | "there"}} — a firm similar to {{company.name | "your company"}} cut costs 12% while boosting satisfaction. Happy to share the case.`,
      11: `Hi {{contact.first_name | "there"}} — one quick question: what would you change about how {{company.name | "your company"}} approaches benefits? Genuinely curious.`,
      12: `Hi {{contact.first_name | "there"}} — wanted to leave the door open. If benefits strategy becomes a priority, I'd love to help {{company.name | "your company"}}.`,
    };
    return liTemplates[week] || `Hi {{contact.first_name | "there"}} — following up regarding ${theme.theme.toLowerCase()}. Happy to share a brief if helpful.`;
  }
  // phone
  const phoneTemplates: Record<number, string> = {
    2: `TALKING POINTS:\n• Reference previous outreach / email\n• Lead with persona-specific pain (cost, compliance, talent)\n• Ask about current broker/advisor relationship\n• Position OneDigital as a strategic partner\n\nVOICEMAIL (≤20s):\n"Hi {{contact.first_name | "there"}}, this is [name] with OneDigital. I followed up on my earlier note about benefits strategy for growing firms like {{company.name | "your company"}}. Would love to connect — I'll send a quick email as well."`,
    3: `TALKING POINTS:\n• Mention the compliance guide you offered to share\n• Ask if they've had any recent compliance concerns\n• Reference firms at their size hitting common gaps\n\nVOICEMAIL (≤20s):\n"Hi {{contact.first_name | "there"}}, [name] with OneDigital. I have a compliance resource that's been helpful for firms like yours — happy to send it over. I'll drop you a note."`,
    5: `TALKING POINTS:\n• Reference renewal timeline\n• Ask when their current plan year ends\n• Mention the 90–120 day review window\n• Offer a no-obligation renewal audit\n\nVOICEMAIL (≤20s):\n"Hi {{contact.first_name | "there"}}, [name] with OneDigital. With renewals coming up, I wanted to share a few strategies that have helped similar firms. I'll follow up by email."`,
    7: `TALKING POINTS:\n• Lead with cost containment angle\n• Mention plan design optimization and pharmacy carve-outs\n• Ask about their biggest cost driver\n• Position a quick cost audit\n\nVOICEMAIL (≤20s):\n"Hi {{contact.first_name | "there"}}, [name] with OneDigital. Wanted to share some cost containment strategies we've seen work for firms your size. I'll send a note as well."`,
    10: `TALKING POINTS:\n• Reference the case study / proof point\n• Ask if they've seen similar challenges\n• Offer to walk through specifics\n\nVOICEMAIL (≤20s):\n"Hi {{contact.first_name | "there"}}, [name] with OneDigital. I have a case study from a firm similar to {{company.name | "your company"}} that delivered strong results — happy to share. I'll follow up by email."`,
    12: `TALKING POINTS:\n• Acknowledge this is a final touch\n• Recap the value proposition briefly\n• Leave the door open gracefully\n• Ask if there's a better time or contact\n\nVOICEMAIL (≤20s):\n"Hi {{contact.first_name | "there"}}, [name] with OneDigital. I've reached out a few times and want to respect your time. If benefits strategy becomes a priority, my door is open. All the best."`,
  };
  return phoneTemplates[week] || `TALKING POINTS:\n• Reference Week ${week} theme: ${theme.theme}\n• Connect to {{company.name | "your company"}}'s situation\n• Ask an open-ended question\n• Offer a specific next step\n\nVOICEMAIL (≤20s):\n"Hi {{contact.first_name | "there"}}, [name] with OneDigital. Following up on ${theme.theme.toLowerCase()} — would love to connect briefly. I'll send a note as well."`;
}

function getDraft(week: number, channel: 'email' | 'linkedin' | 'phone'): string {
  return week === 1 ? getWeek1Draft(channel) : getDripDraft(week, channel);
}

/* ── Component ── */

export default function WeekPanel({ contactId, week, emailTheme, linkedInTouch, cta, asset, callObjective, callTalkTrack, voicemailScript, liDone, emailDone, phoneDone, outcome, notes, isCurrent, isPast, isUnsubscribed = false, leadData }: Props) {
  const { markTouchDone, setWeekOutcome, setWeekNotes } = useCrm();
  const hasCall = isCallWeek(week);
  const isComplete = liDone && emailDone && (!hasCall || phoneDone);

  const theme = getWeekTheme(week);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalChannel, setModalChannel] = useState<'email' | 'linkedin' | 'phone'>('email');
  const [modalContent, setModalContent] = useState('');
  const [copied, setCopied] = useState(false);

  const openGenModal = (channel: 'email' | 'linkedin' | 'phone') => {
    setModalChannel(channel);
    const raw = getDraft(week, channel);
    const merged = leadData ? renderWithTokens(raw, leadData) : raw;
    setModalContent(merged);
    setCopied(false);
    setModalOpen(true);
  };

  const handleCopy = (text?: string) => {
    navigator.clipboard.writeText(text ?? modalContent);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Derived contact info for action buttons
  const contactEmail = leadData?.contact?.email || '';
  const contactLinkedIn = leadData?.contact?.linkedin_url || '';
  const contactPhone = leadData?.contact?.phone || '';

  // Extract subject from email body (first line after "Subject: " or use theme)
  const getEmailSubject = () => {
    const subjectMatch = modalContent.match(/^Subject:\s*(.+)$/m);
    return subjectMatch ? subjectMatch[1].trim() : `Week ${week}: ${theme.theme}`;
  };

  const getEmailBody = () => {
    return modalContent.replace(/^Subject:\s*.+\n\n?/m, '');
  };

  // Split phone touch into bullets and voicemail
  const getPhoneParts = () => {
    const parts = modalContent.split(/VOICEMAIL\s*\(.*?\):\s*/i);
    return { bullets: parts[0]?.trim() || modalContent, voicemail: parts[1]?.trim() || '' };
  };

  const openOutlookWeb = () => {
    const subject = encodeURIComponent(getEmailSubject());
    const body = encodeURIComponent(getEmailBody().replace(/\n/g, '\r\n'));
    window.open(`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(contactEmail)}&subject=${subject}&body=${body}`, '_blank');
  };

  const openMailto = () => {
    const subject = encodeURIComponent(getEmailSubject());
    const body = encodeURIComponent(getEmailBody().replace(/\n/g, '\r\n'));
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  };

  const channelLabel = modalChannel === 'email' ? 'Email'
    : modalChannel === 'linkedin' ? (week === 1 ? 'LinkedIn Connect Note' : 'LinkedIn Message')
    : 'Phone Touch';

  return (
    <div className={`rounded-lg border p-4 transition-all ${
      isComplete ? 'border-success/30 bg-success/5' :
      isCurrent ? 'border-primary/30 bg-primary/5 ring-2 ring-primary/20' :
      isPast ? 'border-border bg-card opacity-60' :
      'border-border bg-card'
    }`}>
      {/* Debug banner */}
      <div
        id="weekpanel-proof"
        style={{ position: 'sticky', top: 0, zIndex: 9999, background: '#fff3cd', border: '1px solid #b08900', color: '#5d4a00', padding: '4px 6px', fontSize: '12px' }}
      >
        WeekPanel.tsx active — week={week}
      </div>

      <div className="flex items-center justify-between mb-3 mt-2">
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            isComplete ? 'bg-success text-success-foreground' :
            isCurrent ? 'bg-primary text-primary-foreground' :
            'bg-muted text-muted-foreground'
          }`}>
            {isComplete ? <Check size={14} /> : week}
          </span>
          <div>
            <h4 className="font-semibold text-sm text-foreground">Week {week}: {theme.theme}</h4>
            <p className="text-xs text-muted-foreground">{theme.description}</p>
          </div>
        </div>
        {outcome && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            outcome === 'Meeting Booked' ? 'bg-success/10 text-success' :
            outcome === 'Positive Reply' ? 'bg-warning/10 text-warning' :
            outcome === 'Negative Reply' || outcome === 'Bad Fit' ? 'bg-destructive/10 text-destructive' :
            'bg-muted text-muted-foreground'
          }`}>
            {outcome}
          </span>
        )}
      </div>

      {/* Unsubscribed hint */}
      {isUnsubscribed && (
        <p className="text-[10px] text-destructive mb-2 italic">⛔ Contact is unsubscribed — email suppressed.</p>
      )}

      {/* Theme info */}
      <div className="space-y-1 text-sm mb-3">
        {emailTheme && (
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Theme:</span>
            <span className="text-foreground">{emailTheme}</span>
          </div>
        )}
        {cta && <div className="text-xs text-muted-foreground">CTA: <span className="text-foreground">{cta}</span></div>}
        {asset && <div className="text-xs text-muted-foreground">Asset: <span className="text-foreground">{asset}</span></div>}
      </div>

      {/* Three generation buttons — all weeks */}
      <div className="flex gap-2 flex-wrap mb-3">
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => openGenModal('email')}>
          <Mail size={12} /> Generate Email
        </Button>
        <Button
          size="sm"
          variant={!contactEmail ? 'default' : 'outline'}
          className={`gap-1 text-xs ${!contactEmail ? 'ring-2 ring-primary/30' : ''}`}
          onClick={() => openGenModal('linkedin')}
        >
          <Linkedin size={12} /> Generate LinkedIn Message
          {!contactEmail && <span className="text-[9px] ml-1 opacity-70">★ Recommended</span>}
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => openGenModal('phone')}>
          <Phone size={12} /> Generate Phone Touch
        </Button>
      </div>

      {/* Generation modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Week {week}: {theme.theme} — {channelLabel}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={modalContent}
            onChange={(e) => setModalContent(e.target.value)}
            className="text-xs min-h-[160px] resize-y font-sans"
          />

          {/* Email actions */}
          {modalChannel === 'email' && (
            <div className="space-y-2">
              {isUnsubscribed && (
                <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
                  ⛔ Email disabled — contact is unsubscribed. Use LinkedIn or Phone.
                </p>
              )}
              <div className="flex flex-wrap gap-2 justify-end">
                <Button size="sm" variant="secondary" className="gap-1 text-xs" onClick={() => handleCopy()}>
                  {copied ? <CheckIcon size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={openOutlookWeb}
                  disabled={isUnsubscribed || !contactEmail}
                  title={!contactEmail ? 'No email on file' : undefined}
                >
                  <ExternalLink size={12} /> Open in Outlook Web
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={openMailto}
                  disabled={isUnsubscribed || !contactEmail}
                  title={!contactEmail ? 'No email on file' : undefined}
                >
                  <Mail size={12} /> Open with mailto
                </Button>
              </div>
            </div>
          )}

          {/* LinkedIn actions */}
          {modalChannel === 'linkedin' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 justify-end">
                <Button size="sm" variant="secondary" className="gap-1 text-xs" onClick={() => handleCopy()}>
                  {copied ? <CheckIcon size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => window.open(contactLinkedIn, '_blank')}
                  disabled={!contactLinkedIn}
                >
                  <Linkedin size={12} /> Open LinkedIn Profile
                </Button>
              </div>
              {!contactLinkedIn && (
                <p className="text-[10px] text-muted-foreground italic text-right">No LinkedIn profile URL on file.</p>
              )}
            </div>
          )}

          {/* Phone Touch actions */}
          {modalChannel === 'phone' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 justify-end">
                <Button size="sm" variant="secondary" className="gap-1 text-xs" onClick={() => handleCopy(getPhoneParts().bullets)}>
                  <Copy size={12} /> Copy Bullets
                </Button>
                {getPhoneParts().voicemail && (
                  <Button size="sm" variant="secondary" className="gap-1 text-xs" onClick={() => handleCopy(getPhoneParts().voicemail)}>
                    <Copy size={12} /> Copy Voicemail
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => window.open(`tel:${contactPhone}`, '_self')}
                  disabled={!contactPhone}
                >
                  <PhoneCall size={12} /> Dial
                </Button>
              </div>
              {!contactPhone && (
                <p className="text-[10px] text-muted-foreground italic text-right">No phone number on file.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <Select value={outcome} onValueChange={v => setWeekOutcome(contactId, week, v as TouchOutcome | '')}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            {outcomes.map(o => <SelectItem key={o || 'none'} value={o || 'none'}>{o || 'No outcome'}</SelectItem>)}
          </SelectContent>
        </Select>
        <Textarea
          value={notes}
          onChange={e => setWeekNotes(contactId, week, e.target.value)}
          placeholder="Notes..."
          className="text-xs h-8 min-h-[32px] resize-none"
          rows={1}
        />
      </div>
    </div>
  );
}
