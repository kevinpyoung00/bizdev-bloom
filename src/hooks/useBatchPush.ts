import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { normalizeMatchKey } from '@/lib/matchKey';

interface BatchPushResult {
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
}

/**
 * Push claimed contacts from a batch into "ready" state.
 * Ensures match_key is populated, crm_status = 'claimed'.
 */
export function useBatchSendToContacts() {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(async (batchId: string): Promise<BatchPushResult> => {
    setIsPending(true);
    const result: BatchPushResult = { created: 0, updated: 0, skipped: 0, warnings: [] };

    try {
      // Get claimed contacts in this batch
      const { data: contacts } = await supabase
        .from('contacts_le')
        .select('id, email, first_name, last_name, match_key, crm_status, account_id, batch_id')
        .eq('batch_id', batchId)
        .eq('crm_status', 'claimed');

      if (!contacts || contacts.length === 0) {
        toast.info('No claimed contacts in this batch to push.');
        return result;
      }

      for (const contact of contacts) {
        // Ensure match_key is populated
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

        // Mark as ready for CRM (keep crm_status = 'claimed', just ensure data is clean)
        result.updated++;
      }

      // Update lead_queue for these accounts
      const accountIds = [...new Set(contacts.map(c => c.account_id).filter(Boolean))];
      if (accountIds.length > 0) {
        await supabase.from('lead_queue')
          .update({ claim_status: 'claimed' } as any)
          .in('account_id', accountIds)
          .eq('claim_status', 'new');
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
 * Push claimed contacts from a batch directly to a campaign.
 * Creates/verifies contacts first, then assigns campaign_batch_id.
 */
export function useBatchSendToCampaign() {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(async (batchId: string, campaignBatchId: string): Promise<BatchPushResult> => {
    setIsPending(true);
    const result: BatchPushResult = { created: 0, updated: 0, skipped: 0, warnings: [] };

    try {
      // Get claimed contacts in this batch
      const { data: contacts } = await supabase
        .from('contacts_le')
        .select('id, email, first_name, last_name, match_key, crm_status, account_id')
        .eq('batch_id', batchId)
        .eq('crm_status', 'claimed');

      if (!contacts || contacts.length === 0) {
        toast.info('No claimed contacts in this batch to push to campaign.');
        return result;
      }

      for (const contact of contacts) {
        // Ensure match_key
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

        // Update campaign_batch_id
        await supabase.from('contacts_le').update({
          campaign_batch_id: campaignBatchId,
          match_key: mk,
        } as any).eq('id', contact.id);

        result.updated++;
      }

      // Update lead_queue status
      const accountIds = [...new Set(contacts.map(c => c.account_id).filter(Boolean))];
      if (accountIds.length > 0) {
        await supabase.from('lead_queue')
          .update({ claim_status: 'in_campaign' } as any)
          .in('account_id', accountIds);
      }

      await supabase.from('audit_log').insert({
        actor: 'user', action: 'batch_send_to_campaign',
        entity_type: 'contacts_le',
        details: { batch_id: batchId, campaign_batch_id: campaignBatchId, updated: result.updated, skipped: result.skipped },
      });

      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      queryClient.invalidateQueries({ queryKey: ['claimed-leads'] });
      toast.success(`${result.updated} contacts assigned to campaign`);
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setIsPending(false);
    }

    return result;
  }, [queryClient]);

  return { execute, isPending };
}
