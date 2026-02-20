import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { isCallWeek } from '@/types/crm';

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

export interface DripWeekProgress {
  week: number;
  liDone: boolean;
  emailDone: boolean;
  phoneDone: boolean;
}

/** Derive current week from drip_progress: first week where not all channels are done */
export function getCurrentWeekFromProgress(progress: DripWeekProgress[]): number {
  for (let w = 1; w <= 12; w++) {
    const entry = progress.find(p => p.week === w);
    if (!entry) return w;
    const hasCall = isCallWeek(w);
    const allDone = entry.liDone && entry.emailDone && (!hasCall || entry.phoneDone);
    if (!allDone) return w;
  }
  return 12; // all done
}

/** Count fully completed weeks */
export function getCompletedWeeks(progress: DripWeekProgress[]): number {
  let count = 0;
  for (let w = 1; w <= 12; w++) {
    const entry = progress.find(p => p.week === w);
    if (!entry) continue;
    const hasCall = isCallWeek(w);
    if (entry.liDone && entry.emailDone && (!hasCall || entry.phoneDone)) count++;
  }
  return count;
}

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

    queryClient.invalidateQueries({ queryKey: ['campaign-contacts'] });
    queryClient.invalidateQueries({ queryKey: ['campaign-counts'] });
    queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
    queryClient.invalidateQueries({ queryKey: ['contacts-le'] });
  }, [queryClient]);

  /** Mark a single channel done for a specific week, only advance pipeline when full week is complete */
  const markChannelDone = useCallback(async (
    contactId: string,
    week: number,
    channel: 'email' | 'linkedin' | 'phone',
  ) => {
    // Fetch current drip_progress and pipeline_stage
    const { data: current } = await supabase
      .from('contacts_le')
      .select('drip_progress, pipeline_stage')
      .eq('id', contactId)
      .single();

    const rawProgress = (current as any)?.drip_progress || [];
    const progress: DripWeekProgress[] = Array.isArray(rawProgress) ? [...rawProgress] : [];

    // Find or create entry for this week
    let entry = progress.find(p => p.week === week);
    if (!entry) {
      entry = { week, liDone: false, emailDone: false, phoneDone: false };
      progress.push(entry);
    }

    // Mark the channel
    const channelKey = channel === 'linkedin' ? 'liDone' : channel === 'email' ? 'emailDone' : 'phoneDone';
    entry[channelKey] = true;

    // Check if all channels for this week are done
    const hasCall = isCallWeek(week);
    const weekComplete = entry.liDone && entry.emailDone && (!hasCall || entry.phoneDone);

    const now = new Date().toISOString();
    const updatePayload: any = {
      drip_progress: progress,
      last_touch: now,
    };

    if (weekComplete) {
      // Advance pipeline_stage to completed week count
      const completedCount = getCompletedWeeks(progress);
      const currentStage = (current as any)?.pipeline_stage ?? 0;
      updatePayload.pipeline_stage = Math.max(currentStage, Math.min(completedCount, 4));

      // Set next_touch to 7 days (next week)
      const nextTouch = new Date();
      nextTouch.setDate(nextTouch.getDate() + 7);
      updatePayload.next_touch = nextTouch.toISOString();
    }

    await supabase
      .from('contacts_le')
      .update(updatePayload)
      .eq('id', contactId);

    queryClient.invalidateQueries({ queryKey: ['campaign-contacts'] });
    queryClient.invalidateQueries({ queryKey: ['campaign-counts'] });
    queryClient.invalidateQueries({ queryKey: ['lead-queue'] });
    queryClient.invalidateQueries({ queryKey: ['contacts-le'] });
  }, [queryClient]);

  return { advancePipeline, markChannelDone };
}
