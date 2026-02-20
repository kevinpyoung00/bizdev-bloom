import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Sparkles, Globe, Linkedin, ChevronDown, Copy, Check, Zap, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { inferBaselineTriggers, inferFromEnrichmentText, mergeTriggerSets, extractWebHints } from '@/lib/triggers';
import { generateOutreach } from '@/lib/outreach';
import { normalizeUrl } from '@/lib/normalizeUrl';
import { usePipelineUpdate } from '@/hooks/usePipelineUpdate';
import { toast } from 'sonner';

interface QuickAnalyzeProps {
  entityType: 'contact' | 'account';
  entityId: string;
  accountId?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  roleTitle?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  region?: string | null;
  domain?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  onTriggersUpdated?: (triggers: string[]) => void;
  onBriefGenerated?: (brief: string) => void;
}

export default function QuickAnalyze({
  entityType,
  entityId,
  accountId,
  linkedinUrl,
  websiteUrl,
  roleTitle,
  industry,
  employeeCount,
  region,
  domain,
  companyName,
  firstName,
  lastName,
  email,
  phone,
  onTriggersUpdated,
  onBriefGenerated,
}: QuickAnalyzeProps) {
  const [liUrl, setLiUrl] = useState(linkedinUrl || '');
  const [webUrl, setWebUrl] = useState(websiteUrl || '');
  const [analyzing, setAnalyzing] = useState(false);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [updateTriggersOnSave, setUpdateTriggersOnSave] = useState(true);
  const [outreach, setOutreach] = useState<ReturnType<typeof generateOutreach> | null>(null);
  const [activeTab, setActiveTab] = useState<'email' | 'linkedin' | 'call' | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { advancePipeline } = usePipelineUpdate();

  // Pre-fill triggers from URL params on mount
  useEffect(() => {
    if (linkedinUrl) setLiUrl(linkedinUrl);
    if (websiteUrl) setWebUrl(websiteUrl);
  }, [linkedinUrl, websiteUrl]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setOutreach(null);
    setActiveTab(null);
    try {
      // 1. Baseline triggers from role/industry/size/region/domain
      const baseline = inferBaselineTriggers({
        role_title: roleTitle,
        industry,
        employee_count: employeeCount,
        region,
        domain,
      });

      let enrichmentTriggers: string[] = [];
      let webHints: string[] = [];

      // 2. Scrape website if provided
      const urlToScrape = webUrl.trim() || websiteUrl || '';
      if (urlToScrape) {
        try {
          const { data, error } = await supabase.functions.invoke('company-scrape', {
            body: { website: urlToScrape, company: companyName || '' },
          });
          if (!error && data?.success) {
            const scrapeText = [
              data.summary || '',
              ...(data.key_facts || []),
              ...(data.outreach_angles || []),
              ...(data.pain_points || []),
            ].join(' ');
            enrichmentTriggers = inferFromEnrichmentText(scrapeText);
            webHints = extractWebHints({ websiteHtml: scrapeText });
          }
        } catch (e: any) {
          console.warn('Website scrape failed:', e.message);
          toast.info('Website scrape unavailable, using baseline triggers');
        }
      }

      // 3. Merge all trigger sets
      const merged = mergeTriggerSets([], baseline, enrichmentTriggers, webHints);
      setTriggers(merged);

      // 4. Save triggers + URLs if toggle is on
      if (updateTriggersOnSave) {
        const updatePayload: Record<string, any> = {
          triggers: merged,
        };

        const normalizedLi = normalizeUrl(liUrl.trim());
        if (normalizedLi && entityType === 'contact') {
          updatePayload.linkedin_url = normalizedLi;
        }

        if (entityType === 'contact') {
          await supabase.from('contacts_le').update(updatePayload as any).eq('id', entityId);
        } else if (entityType === 'account') {
          if (webUrl.trim()) {
            updatePayload.website = normalizeUrl(webUrl.trim());
          }
          await supabase.from('accounts').update(updatePayload as any).eq('id', entityId);
        }
        onTriggersUpdated?.(merged);
      }

      // 5. Pre-generate outreach
      const result = generateOutreach({
        contact: {
          first_name: firstName || 'there',
          last_name: lastName || '',
          title: roleTitle,
          email,
          phone,
        },
        company: {
          name: companyName || 'the company',
          industry,
          employee_count: employeeCount,
        },
        triggers: merged,
      });
      setOutreach(result);

      toast.success(`Analyze complete: ${merged.length} triggers found`);
    } catch (err: any) {
      toast.error('Analysis failed: ' + (err.message || 'Unknown error'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmOutreach = async (type: 'email' | 'linkedin' | 'call') => {
    if (entityType !== 'contact') {
      toast.success('Outreach copied! Pipeline update only applies to contacts.');
      return;
    }
    try {
      const actionMap = { email: 'email' as const, linkedin: 'linkedin' as const, call: 'call' as const };
      await advancePipeline(entityId, actionMap[type]);
      toast.success(`Pipeline advanced: ${type} recorded`);
    } catch (e: any) {
      toast.error('Failed to update pipeline: ' + e.message);
    }
  };

  const copyAndConfirm = async (text: string, type: 'email' | 'linkedin' | 'call', field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
    await handleConfirmOutreach(type);
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          Quick Analyze
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* LinkedIn URL */}
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Linkedin size={11} /> LinkedIn URL
          </label>
          <Input
            placeholder="https://linkedin.com/in/..."
            value={liUrl}
            onChange={e => setLiUrl(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Website URL */}
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Globe size={11} /> Company Website
          </label>
          <Input
            placeholder="https://company.com"
            value={webUrl}
            onChange={e => setWebUrl(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Update triggers on save</label>
          <Switch checked={updateTriggersOnSave} onCheckedChange={setUpdateTriggersOnSave} />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            className="gap-1.5 col-span-2"
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing ? (
              <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
            ) : (
              <><Zap size={14} /> Analyze</>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={!outreach}
            onClick={() => setActiveTab(activeTab === 'email' ? null : 'email')}
          >
            <Mail size={13} /> Email
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={!outreach}
            onClick={() => setActiveTab(activeTab === 'linkedin' ? null : 'linkedin')}
          >
            <Linkedin size={13} /> LinkedIn
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 col-span-2"
            disabled={!outreach}
            onClick={() => setActiveTab(activeTab === 'call' ? null : 'call')}
          >
            <Phone size={13} /> Call Script
          </Button>
        </div>

        {/* Trigger Chips */}
        {triggers.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Triggers ({triggers.length})</p>
            <div className="flex flex-wrap gap-1">
              {triggers.map((t, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Outreach Panels */}
        {outreach && activeTab === 'email' && (
          <div className="space-y-2 bg-secondary/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Email Draft</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => copyAndConfirm(`Subject: ${outreach.email.subject}\n\n${outreach.email.body}`, 'email', 'email')}
              >
                {copied === 'email' ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
                Copy & Log
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Subject:</span> {outreach.email.subject}
            </p>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{outreach.email.body}</p>
          </div>
        )}

        {outreach && activeTab === 'linkedin' && (
          <div className="space-y-2 bg-secondary/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">LinkedIn Opener</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => copyAndConfirm(outreach.linkedin.opener, 'linkedin', 'linkedin')}
              >
                {copied === 'linkedin' ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
                Copy & Log
              </Button>
            </div>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{outreach.linkedin.opener}</p>
          </div>
        )}

        {outreach && activeTab === 'call' && (
          <div className="space-y-2 bg-secondary/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Call Script</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => copyAndConfirm(`${outreach.call.talkTrack}\n\nDiscovery Questions:\n${outreach.call.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`, 'call', 'call')}
              >
                {copied === 'call' ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
                Copy & Log
              </Button>
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Talk Track (30s)</p>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{outreach.call.talkTrack}</p>
            <p className="text-xs font-medium text-muted-foreground mb-1 mt-2">Discovery Questions</p>
            <ol className="list-decimal list-inside space-y-1">
              {outreach.call.questions.map((q, i) => (
                <li key={i} className="text-xs text-foreground">{q}</li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
