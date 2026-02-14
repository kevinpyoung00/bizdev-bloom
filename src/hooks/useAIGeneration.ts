import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGenerateBrief() {
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-brief', {
        body: { account_id: accountId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { brief: string; id: string };
    },
  });
}

export function useGenerateEmail() {
  return useMutation({
    mutationFn: async ({ accountId, persona, contactId }: { accountId: string; persona: 'CFO' | 'HR'; contactId?: string }) => {
      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: { account_id: accountId, persona, contact_id: contactId || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { subject: string; body: string; id: string };
    },
  });
}
