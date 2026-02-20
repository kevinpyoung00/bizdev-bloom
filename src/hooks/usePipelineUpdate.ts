import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Pipeline stages:
 * 0 = New, 1 = Emailed, 2 = LinkedIn, 3 = Called, 4 = Meeting
 */

export const PIPELINE_STAGES: Record<number, string> = {
  0: 'New',
  1: 'Emailed',
  2: 'LinkedIn',
  3: 'Called',
  4: 'Meeting',
};

export const PIPELINE_COLORS: Record<number, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-primary/10 text-primary',
  2: 'bg-info/10 text-info',
  3: 'bg-warning/10 text-warning',
  4: 'bg-success/10 text-success',
};

export function usePipelineUpdate() {
  const queryClient = useQueryClient();

  const advancePipeline = useCallback(async (
    contactId: string,
    action: 'email' | 'linkedin' | 'call' | 'meeting',
  ) => {
    const stageMap = { email: 1, linkedin: 2, call: 3, meeting: 4 };
    const targetStage = stageMap[action];

    const now = new Date().toISOString();
    const nextTouch = new Date();
    nextTouch.setDate(nextTouch.getDate() + 3);

    // Use raw SQL via rpc to do greatest(pipeline_stage, targetStage)
    // Since we can't do greatest() in update, fetch first
    const { data: current } = await supabase
      .from('contacts_le')
      .select('pipeline_stage')
      .eq('id', contactId)
      .single();

    const currentStage = (current as any)?.pipeline_stage ?? 0;
    const newStage = Math.max(currentStage, targetStage);

    await supabase
      .from('contacts_le')
      .update({
        pipeline_stage: newStage,
        last_touch: now,
        next_touch: nextTouch.toISOString(),
      } as any)
      .eq('id', contactId);

    // Invalidate all relevant queries
    queryClient.invalidateQueries({ queryKey: ['campaign-contacts'] });
    queryClient.invalidateQueries({ queryKey: ['campaign-counts'] });
    queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
    queryClient.invalidateQueries({ queryKey: ['contacts-le'] });
  }, [queryClient]);

  return { advancePipeline };
}
