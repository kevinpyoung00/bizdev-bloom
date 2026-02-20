import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

/**
 * Compute campaign enrollment counts from contacts_le.campaign_tags.
 * No new tables needed — derives counts from existing JSONB arrays.
 */
export function useCampaignCounts() {
  const queryClient = useQueryClient();

  const { data: counts = new Map<string, number>(), isLoading } = useQuery({
    queryKey: ['campaign-counts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts_le')
        .select('campaign_tags');

      const map = new Map<string, number>();
      for (const row of data || []) {
        const tags = (row.campaign_tags || []) as string[];
        for (const tag of tags) {
          if (typeof tag === 'string' && tag.length > 0) {
            map.set(tag, (map.get(tag) || 0) + 1);
          }
        }
      }
      return map;
    },
  });

  const getCountFor = useCallback(
    (name: string) => counts.get(name) || 0,
    [counts],
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['campaign-counts'] });
  }, [queryClient]);

  return { counts, getCountFor, isLoading, refetch };
}
