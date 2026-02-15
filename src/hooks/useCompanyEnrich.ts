import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCrm } from '@/store/CrmContext';
import { CompanyScrapeData } from '@/types/crm';
import { toast } from 'sonner';

export function useCompanyEnrich() {
  const { updateContact } = useCrm();

  const enrichContact = useCallback(async (contactId: string, opts: { website?: string; company?: string }) => {
    const body: Record<string, string> = {};
    if (opts.website) body.website = opts.website;
    if (opts.company) body.company = opts.company;

    const { data, error } = await supabase.functions.invoke('company-scrape', { body });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Enrichment failed');

    const scrape: CompanyScrapeData = {
      summary: data.summary,
      key_facts: data.key_facts || [],
      outreach_angles: data.outreach_angles || [],
      pain_points: data.pain_points || [],
      scrapedAt: new Date().toISOString(),
    };

    updateContact(contactId, {
      companyScrape: scrape,
      ...(data.website ? { website: data.website } : {}),
    } as any);

    return scrape;
  }, [updateContact]);

  const enrichContactSilent = useCallback(async (contactId: string, opts: { website?: string; company?: string }) => {
    try {
      await enrichContact(contactId, opts);
    } catch (err: any) {
      console.warn('Silent enrichment failed for', contactId, err.message);
    }
  }, [enrichContact]);

  return { enrichContact, enrichContactSilent };
}
