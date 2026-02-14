import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGenerateDrip() {
  return useMutation({
    mutationFn: async ({
      week,
      channel,
      leadData,
      accountId,
      contactId,
    }: {
      week: number;
      channel: string;
      leadData: any;
      accountId?: string;
      contactId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-drip', {
        body: {
          week,
          channel,
          lead_data: leadData,
          account_id: accountId,
          contact_id: contactId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { subject?: string; body: string };
    },
  });
}
