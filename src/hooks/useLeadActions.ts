import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { detectPersona } from '@/lib/persona';
import { matchIndustryKey } from '@/lib/industry';

export type ClaimStatus = 'new' | 'claimed' | 'uploaded' | 'in_campaign' | 'rejected';

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  new: 'New',
  claimed: 'Claimed - Needs D365 Upload',
  uploaded: 'Uploaded to D365',
  in_campaign: 'In Campaign',
  rejected: 'Rejected',
};

export const REJECT_REASONS = [
  'Taken or owned',
  'Duplicate',
  'Outside territory or industry',
  'Bad fit',
  'Missing info',
] as const;

export function useClaimLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ leadId, contactTitle, accountIndustry }: { leadId: string; contactTitle?: string; accountIndustry?: string }) => {
      const persona = detectPersona(contactTitle);
      const industry_key = matchIndustryKey(accountIndustry);
      const { error } = await supabase
        .from('lead_queue')
        .update({
          claim_status: 'claimed',
          claimed_at: new Date().toISOString(),
          persona,
          industry_key,
          status: 'claimed',
        } as any)
        .eq('id', leadId);
      if (error) throw error;

      // Audit log
      await supabase.from('audit_log').insert({
        actor: 'user',
        action: 'claim_lead',
        entity_type: 'lead_queue',
        entity_id: leadId,
        details: { persona, industry_key },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      toast({ title: 'Lead claimed', description: 'Added to D365 Export List' });
    },
    onError: (err: any) => {
      toast({ title: 'Claim failed', description: err.message, variant: 'destructive' });
    },
  });
}

export function useRejectLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ leadId, reason }: { leadId: string; reason: string }) => {
      const { error } = await supabase
        .from('lead_queue')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_reason: reason,
        } as any)
        .eq('id', leadId);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        actor: 'user',
        action: 'reject_lead',
        entity_type: 'lead_queue',
        entity_id: leadId,
        details: { reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      queryClient.invalidateQueries({ queryKey: ['lead-queue-rejected'] });
      queryClient.invalidateQueries({ queryKey: ['needs-review-accounts'] });
      toast({ title: 'Lead rejected' });
    },
    onError: (err: any) => {
      toast({ title: 'Reject failed', description: err.message, variant: 'destructive' });
    },
  });
}

export function useMarkUploaded() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { error } = await supabase
        .from('lead_queue')
        .update({ claim_status: 'uploaded', status: 'uploaded' } as any)
        .in('id', leadIds);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        actor: 'user',
        action: 'mark_uploaded',
        entity_type: 'lead_queue',
        details: { lead_ids: leadIds, count: leadIds.length },
      });
    },
    onSuccess: (_, leadIds) => {
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      toast({ title: 'Marked as uploaded', description: `${leadIds.length} leads updated` });
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    },
  });
}

export function useStartCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { error } = await supabase
        .from('lead_queue')
        .update({ claim_status: 'in_campaign', status: 'in_campaign' } as any)
        .in('id', leadIds);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        actor: 'user',
        action: 'start_campaign',
        entity_type: 'lead_queue',
        details: { lead_ids: leadIds },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      toast({ title: 'Campaign started' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });
}

export function useRejectedLeads() {
  return useQuery({
    queryKey: ['lead-queue-rejected'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_queue')
        .select('*, accounts(*)')
        .eq('status', 'rejected')
        .order('rejected_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        priority_rank: row.priority_rank,
        score: row.score,
        reason: row.reason,
        status: row.status,
        run_date: row.run_date,
        claim_status: row.claim_status,
        claimed_at: row.claimed_at,
        persona: row.persona,
        industry_key: row.industry_key,
        rejected_reason: row.rejected_reason,
        rejected_at: row.rejected_at,
        updated_at: row.updated_at,
        account: row.accounts,
      }));
    },
  });
}

export function useRestoreLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from('lead_queue')
        .update({ claim_status: 'new', status: 'pending', rejected_reason: null, rejected_at: null } as any)
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      queryClient.invalidateQueries({ queryKey: ['lead-queue-rejected'] });
      toast({ title: 'Lead restored to queue' });
    },
    onError: (err: any) => {
      toast({ title: 'Restore failed', description: err.message, variant: 'destructive' });
    },
  });
}

export function useIndustrySettings() {
  return useQuery({
    queryKey: ['industry-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('industry_settings')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}
