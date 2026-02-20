import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Sparkles, Globe, Linkedin, ChevronDown, Copy, Check, Zap, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGenerateBrief } from '@/hooks/useAIGeneration';
import { inferBaselineTriggers, inferFromEnrichmentText, mergeTriggerSets } from '@/lib/triggers';
import { normalizeUrl } from '@/lib/normalizeUrl';
import { toast } from 'sonner';

interface QuickAnalyzeProps {
  /** 'contact' for contacts_le, 'account' for accounts table */
  entityType: 'contact' | 'account';
  entityId: string;
  accountId?: string | null;
  /** Pre-fill values */
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  roleTitle?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  region?: string | null;
  domain?: string | null;
  companyName?: string | null;
  /** Called after triggers are updated so parent can refresh */
  onTriggersUpdated?: (triggers: string[]) => void;
  /** Called after analysis brief is generated */
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
  onTriggersUpdated,
  onBriefGenerated,
}: QuickAnalyzeProps) {
  const [liUrl, setLiUrl] = useState(linkedinUrl || '');
  const [webUrl, setWebUrl] = useState(websiteUrl || '');
  const [scraping, setScraping] = useState(false);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [scrapeData, setScrapeData] = useState<any>(null);
  const [briefMarkdown, setBriefMarkdown] = useState<string | null>(null);
  const [briefExpanded, setBriefExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const generateBrief = useGenerateBrief();

  const handleAnalyze = async () => {
    setScraping(true);
    try {
      // 1. Compute baseline triggers from role/industry/etc
      const baseline = inferBaselineTriggers({
        role_title: roleTitle,
        industry,
        employee_count: employeeCount,
        region,
        domain,
      });

      let enrichmentTriggers: string[] = [];
      let scrapeResult: any = null;

      // 2. Scrape company website if provided (LinkedIn is blocked by Firecrawl)
      const urlToScrape = webUrl.trim() || websiteUrl || '';
      if (urlToScrape) {
        try {
          const { data, error } = await supabase.functions.invoke('company-scrape', {
            body: { website: urlToScrape, company: companyName || '' },
          });
          if (!error && data?.success) {
            scrapeResult = data;
            setScrapeData(data);
            // Extract triggers from scrape text
            const scrapeText = [
              data.summary || '',
              ...(data.key_facts || []),
              ...(data.outreach_angles || []),
              ...(data.pain_points || []),
            ].join(' ');
            enrichmentTriggers = inferFromEnrichmentText(scrapeText);
          }
        } catch (e: any) {
          console.warn('Website scrape failed:', e.message);
          toast.info('Website scrape unavailable — using baseline triggers');
        }
      }

      // 3. Merge all trigger sets
      const merged = mergeTriggerSets(baseline, enrichmentTriggers);
      setTriggers(merged);

      // 4. Save triggers + URLs to the DB row
      const updatePayload: Record<string, any> = {
        triggers: merged,
        triggers_updated_at: new Date().toISOString(),
      };

      // Save LinkedIn URL if provided
      const normalizedLi = normalizeUrl(liUrl.trim());
      if (normalizedLi && entityType === 'contact') {
        updatePayload.linkedin_url = normalizedLi;
      }

      if (entityType === 'contact') {
        await supabase.from('contacts_le').update(updatePayload as any).eq('id', entityId);
      } else if (entityType === 'account') {
        // For accounts, also save company_scrape if we got it
        if (scrapeResult) {
          updatePayload.company_scrape = {
            summary: scrapeResult.summary,
            key_facts: scrapeResult.key_facts || [],
            outreach_angles: scrapeResult.outreach_angles || [],
            pain_points: scrapeResult.pain_points || [],
            scrapedAt: new Date().toISOString(),
          };
        }
        if (webUrl.trim()) {
          updatePayload.website = normalizeUrl(webUrl.trim());
        }
        await supabase.from('accounts').update(updatePayload as any).eq('id', entityId);
      }

      onTriggersUpdated?.(merged);

      // 5. Generate AI brief if we have an account
      const briefAccountId = entityType === 'account' ? entityId : accountId;
      if (briefAccountId) {
        try {
          const result = await generateBrief.mutateAsync(briefAccountId);
          setBriefMarkdown(result.brief);
          onBriefGenerated?.(result.brief);
          toast.success('Quick Analyze complete — triggers + analysis updated');
        } catch (e: any) {
          toast.warning('Triggers saved but analysis generation failed: ' + e.message);
        }
      } else {
        toast.success('Quick Analyze complete — triggers updated');
      }
    } catch (err: any) {
      toast.error('Analysis failed: ' + (err.message || 'Unknown error'));
    } finally {
      setScraping(false);
    }
  };

  const copyBrief = () => {
    if (briefMarkdown) {
      navigator.clipboard.writeText(briefMarkdown);
      setCopied(true);
      toast.success('Copied!');
      setTimeout(() => setCopied(false), 2000);
    }
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
        {/* LinkedIn URL input */}
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
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Saved for deep-links (LinkedIn blocks scraping)
          </p>
        </div>

        {/* Website URL input */}
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

        {/* Analyze button */}
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={handleAnalyze}
          disabled={scraping || generateBrief.isPending}
        >
          {scraping || generateBrief.isPending ? (
            <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
          ) : (
            <><Zap size={14} /> Run Quick Analyze</>
          )}
        </Button>

        {/* Trigger chips */}
        {triggers.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Discovered Triggers ({triggers.length})</p>
            <div className="flex flex-wrap gap-1">
              {triggers.map((t, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Scrape summary */}
        {scrapeData && (
          <div className="space-y-2">
            {scrapeData.summary && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Company Summary</p>
                <p className="text-xs text-foreground leading-relaxed">{scrapeData.summary}</p>
              </div>
            )}
            {scrapeData.outreach_angles?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Outreach Angles</p>
                <div className="flex flex-wrap gap-1">
                  {scrapeData.outreach_angles.map((a: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px] border-primary/30 text-primary">{a}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Brief */}
        {briefMarkdown && (
          <Collapsible open={briefExpanded} onOpenChange={setBriefExpanded}>
            <CollapsibleTrigger className="w-full flex items-center justify-between text-xs font-medium text-foreground hover:text-primary transition-colors py-1">
              <span className="flex items-center gap-1"><Sparkles size={11} /> AI Analysis</span>
              <div className="flex items-center gap-1">
                <button onClick={e => { e.stopPropagation(); copyBrief(); }} className="p-0.5 hover:text-primary">
                  {copied ? <Check size={11} className="text-primary" /> : <Copy size={11} />}
                </button>
                <ChevronDown size={12} className={`transition-transform ${briefExpanded ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-secondary/50 rounded-lg p-3 text-xs text-foreground prose prose-sm max-w-none whitespace-pre-wrap mt-1 max-h-64 overflow-y-auto">
                {briefMarkdown}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
