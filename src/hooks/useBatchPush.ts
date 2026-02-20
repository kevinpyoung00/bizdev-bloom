import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { normalizeMatchKey } from '@/lib/matchKey';
import { mergeTags } from '@/lib/upsertContact';

interface BatchPushResult {
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
}

/**
 * Push claimed contacts from a batch into "ready" state.
 * Ensures match_key is populated, updates pushed_to_crm_at.
 */
export function useBatchSendToContacts() {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(async (batchId: string): Promise<BatchPushResult> => {
    setIsPending(true);
    const result: BatchPushResult = { created: 0, updated: 0, skipped: 0, warnings: [] };

    try {
      // Find contacts in this batch
      const { data: contacts } = await supabase
        .from('contacts_le')
        .select('id, email, first_name, last_name, match_key, crm_status, account_id, batch_id')
        .eq('batch_id', batchId);

      if (!contacts || contacts.length === 0) {
        toast.info('No contacts found in this batch.');
        return result;
      }

      // Find which accounts have claimed leads
      const accountIds = [...new Set(contacts.map(c => c.account_id).filter(Boolean))] as string[];
      const { data: claimedLeads } = await supabase.from('lead_queue')
        .select('id, account_id')
        .in('account_id', accountIds)
        .eq('claim_status', 'claimed');

      if (!claimedLeads || claimedLeads.length === 0) {
        toast.info('No claimed leads in this batch to push.');
        return result;
      }

      const claimedAccountIds = new Set(claimedLeads.map(l => l.account_id).filter(Boolean));
      const eligibleContacts = contacts.filter(c => c.account_id && claimedAccountIds.has(c.account_id));

      if (eligibleContacts.length === 0) {
        toast.info('No contacts with claimed leads in this batch.');
        return result;
      }

      for (const contact of eligibleContacts) {
        let mk = (contact as any).match_key;
        if (!mk) {
          let domain = '';
          if (contact.account_id) {
            const { data: acct } = await supabase.from('accounts').select('domain').eq('id', contact.account_id).single();
            domain = acct?.domain || '';
          }
          mk = normalizeMatchKey({ email: contact.email, first_name: contact.first_name, last_name: contact.last_name, domain });
          if (!mk || mk === '@') {
            result.skipped++;
            result.warnings.push(`Missing MatchKey for ${contact.first_name} ${contact.last_name}`);
            continue;
          }
          await supabase.from('contacts_le').update({ match_key: mk } as any).eq('id', contact.id);
        }

        // Mark as pushed to CRM
        await supabase.from('contacts_le').update({
          pushed_to_crm_at: new Date().toISOString(),
        } as any).eq('id', contact.id);

        result.updated++;
      }

      // Update lead_queue for claimed leads in these accounts
      for (const lead of claimedLeads) {
        await supabase.from('lead_queue')
          .update({
            pushed_to_crm_at: new Date().toISOString(),
          } as any)
          .eq('id', lead.id);
      }

      await supabase.from('audit_log').insert({
        actor: 'user', action: 'batch_send_to_contacts',
        entity_type: 'contacts_le',
        details: { batch_id: batchId, updated: result.updated, skipped: result.skipped },
      });

      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      queryClient.invalidateQueries({ queryKey: ['claimed-leads'] });
      toast.success(`Contacts ready: ${result.updated} updated, ${result.skipped} skipped`);
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setIsPending(false);
    }

    return result;
  }, [queryClient]);

  return { execute, isPending };
}

/**
 * Push claimed contacts from a batch to a campaign.
 * Updates campaign_tags on both contacts_le and lead_queue.
 * Does NOT write to message_snapshots.
 */
export function useBatchSendToCampaign() {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(async (batchId: string, campaignName: string): Promise<BatchPushResult> => {
    setIsPending(true);
    const result: BatchPushResult = { created: 0, updated: 0, skipped: 0, warnings: [] };

    try {
      // Find contacts in this batch
      const { data: contacts } = await supabase
        .from('contacts_le')
        .select('id, email, first_name, last_name, match_key, crm_status, account_id, campaign_tags')
        .eq('batch_id', batchId);

      if (!contacts || contacts.length === 0) {
        toast.info('No contacts found in this batch.');
        return result;
      }

      // Find which accounts have claimed leads
      const accountIds = [...new Set(contacts.map(c => c.account_id).filter(Boolean))] as string[];
      const { data: claimedLeads } = await supabase.from('lead_queue')
        .select('id, account_id, campaign_tags')
        .in('account_id', accountIds)
        .eq('claim_status', 'claimed');

      if (!claimedLeads || claimedLeads.length === 0) {
        toast.info('No claimed leads in this batch to push to campaign.');
        return result;
      }

      const claimedAccountIds = new Set(claimedLeads.map(l => l.account_id).filter(Boolean));
      const eligibleContacts = contacts.filter(c => c.account_id && claimedAccountIds.has(c.account_id));

      if (eligibleContacts.length === 0) {
        toast.info('No contacts with claimed leads in this batch.');
        return result;
      }

      for (const contact of eligibleContacts) {
        let mk = (contact as any).match_key;
        if (!mk) {
          let domain = '';
          if (contact.account_id) {
            const { data: acct } = await supabase.from('accounts').select('domain').eq('id', contact.account_id).single();
            domain = acct?.domain || '';
          }
          mk = normalizeMatchKey({ email: contact.email, first_name: contact.first_name, last_name: contact.last_name, domain });
          if (!mk || mk === '@') {
            result.skipped++;
            result.warnings.push(`Missing MatchKey for ${contact.first_name} ${contact.last_name}`);
            continue;
          }
        }

        const existingTags = ((contact as any).campaign_tags || []) as string[];
        const mergedTags = mergeTags(existingTags, [campaignName]);

        await supabase.from('contacts_le').update({
          campaign_batch_id: campaignName,
          campaign_tags: mergedTags as any,
          match_key: mk,
          pushed_to_crm_at: new Date().toISOString(),
        } as any).eq('id', contact.id);

        result.updated++;
      }

      // Update lead_queue campaign_tags and status for claimed leads
      for (const row of claimedLeads) {
        const existing = ((row as any).campaign_tags || []) as string[];
        const merged = mergeTags(existing, [campaignName]);
        await supabase.from('lead_queue').update({
          claim_status: 'in_campaign',
          campaign_tags: merged as any,
          pushed_to_crm_at: new Date().toISOString(),
        } as any).eq('id', row.id);
      }

      await supabase.from('audit_log').insert({
        actor: 'user', action: 'batch_send_to_campaign',
        entity_type: 'contacts_le',
        details: { batch_id: batchId, campaign_name: campaignName, updated: result.updated, skipped: result.skipped },
      });

      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      queryClient.invalidateQueries({ queryKey: ['claimed-leads'] });
      toast.success(`${result.updated} contacts enrolled in "${campaignName}"`);
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setIsPending(false);
    }

    return result;
  }, [queryClient]);

  return { execute, isPending };
}
