import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';

export interface LeadWithAccount {
  id: string;
  priority_rank: number;
  score: number;
  reason: any;
  status: string | null;
  run_date: string;
  claim_status: string;
  claimed_at: string | null;
  persona: string | null;
  industry_key: string | null;
  rejected_reason: string | null;
  rejected_at: string | null;
  account: {
    id: string;
    name: string;
    domain: string | null;
    industry: string | null;
    employee_count: number | null;
    hq_city: string | null;
    hq_state: string | null;
    geography_bucket: string | null;
    triggers: any;
    notes: string | null;
    website: string | null;
    disposition: string;
    zywave_id: string | null;
    d365_owner_name: string | null;
    d365_status: string | null;
    d365_last_activity: string | null;
    d365_account_id: string | null;
    needs_review: boolean;
    canonical_company_name: string | null;
  };
}

export type QueueScope = 'today' | '7d' | 'all';

export function useLeadQueue(scope: QueueScope = 'today') {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['lead-queue', scope],
    queryFn: async () => {
      let query = supabase
        .from('lead_queue')
        .select('*, accounts(*)')
        .neq('status', 'rejected')
        .order('priority_rank', { ascending: true });

      if (scope === 'today') {
        query = query.eq('run_date', today);
      } else if (scope === '7d') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte('run_date', sevenDaysAgo.toISOString().split('T')[0]);
      }
      // 'all' — no date filter

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        priority_rank: row.priority_rank,
        score: row.score,
        reason: row.reason,
        status: row.status,
        run_date: row.run_date,
        claim_status: row.claim_status || 'new',
        claimed_at: row.claimed_at,
        persona: row.persona,
        industry_key: row.industry_key,
        rejected_reason: row.rejected_reason,
        rejected_at: row.rejected_at,
        account: row.accounts,
      })) as LeadWithAccount[];
    },
  });
}

export function useLeadStats(runDate?: string) {
  const date = runDate || new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['lead-stats', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_queue')
        .select('score, accounts(geography_bucket)')
        .eq('run_date', date);

      if (error) throw error;
      if (!data || data.length === 0) return { total: 0, ma: 0, ne: 0, us: 0 };

      const geos = data.map((d: any) => (d.accounts as any)?.geography_bucket || 'US');

      return {
        total: data.length,
        ma: geos.filter((g: string) => g === 'MA').length,
        ne: geos.filter((g: string) => g === 'NE').length,
        us: geos.filter((g: string) => g === 'US').length,
      };
    },
  });
}

export function useAccountContacts(accountId: string | null) {
  return useQuery({
    queryKey: ['account-contacts', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from('contacts_le')
        .select('*')
        .eq('account_id', accountId)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });
}

export function useUpdateDisposition() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ accountId, disposition }: { accountId: string; disposition: string }) => {
      const { error } = await supabase
        .from('accounts')
        .update({ disposition } as any)
        .eq('id', accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      toast({ title: 'Disposition updated' });
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    },
  });
}

export function useUpdateAccountField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, field, value }: { accountId: string; field: string; value: string | null }) => {
      const { error } = await supabase
        .from('accounts')
        .update({ [field]: value } as any)
        .eq('id', accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
    },
  });
}

export function useRunScoring() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dryRun: boolean) => {
      const runDate = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.functions.invoke('score-leads', {
        body: { dry_run: dryRun, run_date: runDate },
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.message || 'Scoring returned an error');
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      toast({
        title: 'Scoring complete',
        description: `${data.stats?.total || 0} leads scored.`,
      });
    },
    onError: (err: any) => {
      const msg = err.message || 'Unknown error';
      const isAlreadyScored = msg.includes('already generated');
      toast({
        title: isAlreadyScored ? 'Already scored today' : 'Scoring failed',
        description: isAlreadyScored ? "Today's lead queue is already built. Data is up to date." : msg,
        variant: isAlreadyScored ? 'default' : 'destructive',
      });
    },
  });
}

export interface DiscoveryRunParams {
  mode?: 'auto' | 'manual';
  params?: {
    industries?: string[];
    triggers?: string[];
    geography?: string[];
    company_size?: string;
    discovery_type?: string;
    result_count?: number;
    sub_sectors?: string[];
  };
  override_ma_ne?: boolean;
  candidate_cap?: number;
}

export function useRunDiscovery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runParams?: DiscoveryRunParams) => {
      const { data, error } = await supabase.functions.invoke('run-discovery', {
        body: runParams || { mode: 'auto' },
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Discovery returned an error');
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      queryClient.invalidateQueries({ queryKey: ['needs-review-accounts'] });
      sonnerToast.success('Discovery complete', {
        description: `Found: ${data.domains_found ?? 0} · Kept: MA ${data.hq_MA ?? 0}, NE ${data.hq_NE ?? 0} · Created: ${data.candidates_created ?? 0} · Updated: ${data.candidates_updated ?? 0}`,
        duration: 8000,
      });
    },
    onError: (err: any) => {
      sonnerToast.error('Discovery failed', { description: err.message });
    },
  });
}
