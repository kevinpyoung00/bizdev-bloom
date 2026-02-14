import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Linkedin, Phone, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getWeekTheme } from '@/lib/weekThemes';
import type { PersonaTrack } from '@/lib/persona';

interface DripWeekPanelProps {
  week: number;
  persona: PersonaTrack;
  industryKey: string;
  leadData: any;
  onGenerate: (week: number, channel: string) => Promise<{ subject?: string; body: string }>;
  isGenerating: boolean;
  generatingChannel: string | null;
  locked: boolean; // true if not yet uploaded to D365
}

export default function DripWeekPanel({
  week, persona, industryKey, leadData,
  onGenerate, isGenerating, generatingChannel, locked,
}: DripWeekPanelProps) {
  const theme = getWeekTheme(week);
  const [drafts, setDrafts] = useState<Record<string, { subject?: string; body: string }>>({});
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);

  const handleGenerate = async (channel: string) => {
    try {
      const result = await onGenerate(week, channel);
      setDrafts(prev => ({ ...prev, [channel]: result }));
      setEditedBodies(prev => ({ ...prev, [channel]: result.body }));
    } catch (e: any) {
      toast.error(e.message || 'Generation failed');
    }
  };

  const handleCopy = (channel: string) => {
    const body = editedBodies[channel] || drafts[channel]?.body || '';
    const subject = drafts[channel]?.subject;
    const text = subject ? `Subject: ${subject}\n\n${body}` : body;
    navigator.clipboard.writeText(text);
    setCopiedChannel(channel);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedChannel(null), 2000);
  };

  const isWeek1 = week === 1;

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
            {week}
          </span>
          <div>
            <h4 className="font-semibold text-sm text-foreground">Week {week}: {theme.theme}</h4>
            <p className="text-xs text-muted-foreground">{theme.description}</p>
          </div>
        </div>
        {locked && (
          <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/30">
            Upload to D365 first
          </Badge>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          onClick={() => handleGenerate('email')}
          disabled={locked || (isGenerating && generatingChannel === 'email')}
        >
          {isGenerating && generatingChannel === 'email' ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
          Email
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          onClick={() => handleGenerate('linkedin')}
          disabled={locked || (isGenerating && generatingChannel === 'linkedin')}
        >
          {isGenerating && generatingChannel === 'linkedin' ? <Loader2 size={12} className="animate-spin" /> : <Linkedin size={12} />}
          {isWeek1 ? 'Connect Note' : 'LinkedIn'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          onClick={() => handleGenerate('phone')}
          disabled={locked || (isGenerating && generatingChannel === 'phone')}
        >
          {isGenerating && generatingChannel === 'phone' ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
          Phone Touch
        </Button>
      </div>

      {/* Generated drafts */}
      {Object.entries(drafts).map(([channel, draft]) => (
        <div key={channel} className="mt-3 border border-border rounded-lg p-3 bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {channel === 'email' && <Mail size={12} className="text-muted-foreground" />}
              {channel === 'linkedin' && <Linkedin size={12} className="text-muted-foreground" />}
              {channel === 'phone' && <Phone size={12} className="text-muted-foreground" />}
              <span className="text-xs font-medium text-foreground capitalize">{channel === 'phone' ? 'Phone Touch' : channel}</span>
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleCopy(channel)}>
              {copiedChannel === channel ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            </Button>
          </div>
          {draft.subject && (
            <p className="text-xs font-medium text-foreground mb-1">Subject: {draft.subject}</p>
          )}
          <Textarea
            value={editedBodies[channel] || draft.body}
            onChange={(e) => setEditedBodies(prev => ({ ...prev, [channel]: e.target.value }))}
            className="text-xs min-h-[80px] resize-y font-sans"
          />
        </div>
      ))}
    </div>
  );
}
