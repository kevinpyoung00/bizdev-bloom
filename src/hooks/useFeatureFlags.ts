import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useFeatureFlag(key: string): boolean {
  const { data } = useQuery({
    queryKey: ['feature-flag', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', key)
        .single();
      if (error) return false;
      return data?.enabled ?? false;
    },
    staleTime: 60_000,
  });
  return data ?? false;
}

export function useFeatureFlags(keys: string[]): Record<string, boolean> {
  const { data } = useQuery({
    queryKey: ['feature-flags', keys.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('key, enabled')
        .in('key', keys);
      if (error) return {};
      const map: Record<string, boolean> = {};
      for (const row of data || []) {
        map[row.key] = row.enabled;
      }
      return map;
    },
    staleTime: 60_000,
  });
  return data ?? {};
}
