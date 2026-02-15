import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type KeywordCategory = 'carrier_names' | 'carrier_change_phrases' | 'benefits_hr_keywords';

const CATEGORY_LABELS: Record<KeywordCategory, string> = {
  carrier_names: 'Carrier Names',
  carrier_change_phrases: 'Carrier Change Phrases',
  benefits_hr_keywords: 'Benefits / HR / MA Keywords',
};

export { CATEGORY_LABELS };

export function useSignalKeywords(category: KeywordCategory) {
  return useQuery({
    queryKey: ['signal-keywords', category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signal_keywords' as any)
        .select('*')
        .eq('category', category)
        .single();
      if (error) throw error;
      return {
        id: (data as any).id as string,
        category: (data as any).category as string,
        keywords: (data as any).keywords as string[],
      };
    },
  });
}

export function useUpdateKeywords() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ category, keywords }: { category: KeywordCategory; keywords: string[] }) => {
      const { error } = await supabase
        .from('signal_keywords' as any)
        .update({ keywords } as any)
        .eq('category', category);
      if (error) throw error;
    },
    onSuccess: (_, { category }) => {
      queryClient.invalidateQueries({ queryKey: ['signal-keywords', category] });
      toast({ title: 'Keywords saved', description: CATEGORY_LABELS[category] });
    },
    onError: (err: any) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });
}
