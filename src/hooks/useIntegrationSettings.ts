import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface IntegrationSetting {
  id: string;
  provider: string;
  display_name: string;
  enabled: boolean;
  api_key_ref: string | null;
  sort_order: number;
}

export function useIntegrationSettings() {
  return useQuery({
    queryKey: ['integration-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_settings' as any)
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data as any[]).map((d) => ({
        id: d.id,
        provider: d.provider,
        display_name: d.display_name,
        enabled: d.enabled,
        api_key_ref: d.api_key_ref,
        sort_order: d.sort_order,
      })) as IntegrationSetting[];
    },
  });
}

export function useToggleIntegration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ provider, enabled }: { provider: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('integration_settings' as any)
        .update({ enabled } as any)
        .eq('provider', provider);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-settings'] });
    },
    onError: (err: any) => {
      toast({ title: 'Toggle failed', description: err.message, variant: 'destructive' });
    },
  });
}

export function useSetApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ provider, api_key_ref }: { provider: string; api_key_ref: string }) => {
      const { error } = await supabase
        .from('integration_settings' as any)
        .update({ api_key_ref } as any)
        .eq('provider', provider);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-settings'] });
      toast({ title: 'API key saved' });
    },
    onError: (err: any) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });
}
