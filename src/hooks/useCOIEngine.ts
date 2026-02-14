import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface COIWithData {
  id: string;
  priority_rank: number;
  score: number;
  reason: any;
  status: string | null;
  run_date: string;
  coi: {
    id: string;
    name: string;
    firm_type: string | null;
    website: string | null;
    region: string | null;
    notes: string | null;
  };
  best_contact?: {
    first_name: string;
    last_name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
  } | null;
}

export function useCOIQueue(runDate?: string) {
  const date = runDate || new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['coi-queue', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coi_queue')
        .select('*, cois(*)')
        .eq('run_date', date)
        .order('priority_rank', { ascending: true });

      if (error) throw error;

      const coiIds = (data || []).map((r: any) => r.coi_id).filter(Boolean);

      // Fetch best contact for each COI
      let contactMap: Record<string, any> = {};
      if (coiIds.length > 0) {
        const { data: contacts } = await supabase
          .from('coi_contacts')
          .select('*')
          .in('coi_id', coiIds);
        for (const c of contacts || []) {
          if (!contactMap[c.coi_id]) contactMap[c.coi_id] = c;
        }
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        priority_rank: row.priority_rank,
        score: row.score,
        reason: row.reason,
        status: row.status,
        run_date: row.run_date,
        coi: row.cois,
        best_contact: contactMap[row.coi_id] || null,
      })) as COIWithData[];
    },
  });
}

export function useRunCOIScoring() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.functions.invoke('score-cois', {
        body: { dry_run: dryRun },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['coi-queue'] });
      toast({
        title: 'COI scoring complete',
        description: `${data.stats?.total || 0} COIs selected from ${data.stats?.total_candidates || 0} candidates.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'COI scoring failed',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}
