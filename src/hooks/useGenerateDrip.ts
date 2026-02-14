import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getContentForWeek, formatFurtherReading } from '@/lib/contentLibrary';

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
      const result = data as { subject?: string; body: string };

      // Auto-insert "Further reading" for weeks 2–12 email if not already present
      if (channel === 'email' && week >= 2 && result.body && !result.body.includes('Further reading:')) {
        const content = getContentForWeek(week, leadData.industry_key);
        if (content) {
          result.body = result.body.trimEnd() + '\n\n' + formatFurtherReading(content);
        }
      }

      return result;
    },
  });
}
