import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LeadWithAccount {
  id: string;
  priority_rank: number;
  score: number;
  reason: any;
  status: string | null;
  run_date: string;
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
  };
}

export function useLeadQueue(runDate?: string) {
  const date = runDate || new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['lead-queue', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_queue')
        .select('*, accounts(*)')
        .eq('run_date', date)
        .order('priority_rank', { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        priority_rank: row.priority_rank,
        score: row.score,
        reason: row.reason,
        status: row.status,
        run_date: row.run_date,
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
      if (!data || data.length === 0) return { total: 0, avg: 0, ma: 0, ne: 0, us: 0 };

      const scores = data.map((d: any) => d.score);
      const geos = data.map((d: any) => (d.accounts as any)?.geography_bucket || 'US');

      return {
        total: data.length,
        avg: Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length),
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

export function useRunScoring() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.functions.invoke('score-leads', {
        body: { dry_run: dryRun },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      toast({
        title: 'Scoring complete',
        description: `${data.stats?.total || 0} leads scored. Avg: ${data.stats?.avg_score || 0}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Scoring failed',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}
