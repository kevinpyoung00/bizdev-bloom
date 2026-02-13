import { useCrm } from '@/store/CrmContext';
import { TouchOutcome, isCallWeek } from '@/types/crm';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Check, Mail, Linkedin, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const outcomes: (TouchOutcome | '')[] = ['', 'No Response', 'Positive Reply', 'Negative Reply', 'Meeting Booked', 'Bad Fit', 'Bounced'];

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
}

export default function WeekPanel({ contactId, week, emailTheme, linkedInTouch, cta, asset, callObjective, callTalkTrack, voicemailScript, liDone, emailDone, phoneDone, outcome, notes, isCurrent, isPast }: Props) {
  const { markTouchDone, setWeekOutcome, setWeekNotes } = useCrm();
  const hasCall = isCallWeek(week);
  const isComplete = liDone && emailDone && (!hasCall || phoneDone);
  const [callExpanded, setCallExpanded] = useState(false);

  return (
    <div className={`rounded-lg border p-4 transition-all ${
      isComplete ? 'border-success/30 bg-success/5' :
      isCurrent ? 'border-primary/30 bg-primary/5 ring-2 ring-primary/20' :
      isPast ? 'border-border bg-card opacity-60' :
      'border-border bg-card'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            isComplete ? 'bg-success text-success-foreground' :
            isCurrent ? 'bg-primary text-primary-foreground' :
            'bg-muted text-muted-foreground'
          }`}>
            {isComplete ? <Check size={14} /> : week}
          </span>
          <h4 className="font-semibold text-sm text-foreground">Week {week}</h4>
          {hasCall && <Phone size={12} className="text-muted-foreground" />}
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

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">Email:</span>
          <span className="text-foreground">{emailTheme}</span>
        </div>
        <div className="flex items-center gap-2">
          <Linkedin size={14} className="text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">LinkedIn:</span>
          <span className="text-foreground">{linkedInTouch}</span>
        </div>
        {hasCall && callObjective && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Call:</span>
              <span className="text-foreground">{callObjective}</span>
            </div>
            <button
              onClick={() => setCallExpanded(!callExpanded)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 ml-5"
            >
              {callExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {callExpanded ? 'Hide' : 'Show'} talk track & voicemail
            </button>
            {callExpanded && (
              <div className="ml-5 space-y-2 mt-1">
                {callTalkTrack && (
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">📞 Talk Track</p>
                    <p className="text-xs text-foreground leading-relaxed">{callTalkTrack}</p>
                  </div>
                )}
                {voicemailScript && (
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">📱 Voicemail Script</p>
                    <p className="text-xs text-foreground leading-relaxed">{voicemailScript}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {cta && <div className="text-xs text-muted-foreground">CTA: <span className="text-foreground">{cta}</span></div>}
        {asset && <div className="text-xs text-muted-foreground">Asset: <span className="text-foreground">{asset}</span></div>}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border flex-wrap">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={liDone}
            onCheckedChange={() => !liDone && markTouchDone(contactId, week, 'LinkedIn')}
            disabled={liDone}
          />
          <Linkedin size={14} /> LI done
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={emailDone}
            onCheckedChange={() => !emailDone && markTouchDone(contactId, week, 'Email')}
            disabled={emailDone}
          />
          <Mail size={14} /> Email done
        </label>
        {hasCall && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={phoneDone}
              onCheckedChange={() => !phoneDone && markTouchDone(contactId, week, 'Phone')}
              disabled={phoneDone}
            />
            <Phone size={14} /> Call done
          </label>
        )}
      </div>

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
