// Strongest signal selection — mirrors edge function logic for local template branching

export interface SignalData {
  funding?: { stage?: string; days_ago?: number };
  hiring?: { jobs_60d?: number; intensity?: string };
  hr_change?: { title?: string; days_ago?: number };
  csuite?: { role?: string; days_ago?: number };
}

export interface PickedSignal {
  label: string;
  type: string;
}

export function pickStrongestSignal(signals?: SignalData): PickedSignal {
  if (!signals) return { label: 'growth trajectory', type: 'industry_anchor' };

  if (signals.funding?.days_ago != null && signals.funding.days_ago <= 90)
    return { label: `recent ${signals.funding.stage || 'funding'} round`, type: 'funding' };
  if (signals.hr_change?.days_ago != null && signals.hr_change.days_ago <= 60)
    return { label: `recent ${signals.hr_change.title || 'HR leadership'} change`, type: 'hr_change' };
  if (signals.hiring?.jobs_60d != null && signals.hiring.jobs_60d >= 10)
    return { label: `aggressive hiring (${signals.hiring.jobs_60d} roles)`, type: 'hiring_large' };
  if (signals.hiring?.jobs_60d != null && signals.hiring.jobs_60d >= 6)
    return { label: `notable hiring (${signals.hiring.jobs_60d} roles)`, type: 'hiring_medium' };
  if (signals.hiring?.jobs_60d != null && signals.hiring.jobs_60d >= 3)
    return { label: `active hiring (${signals.hiring.jobs_60d} roles)`, type: 'hiring_small' };
  if (signals.csuite?.days_ago != null && signals.csuite.days_ago <= 90)
    return { label: `recent ${signals.csuite.role || 'C-suite'} transition`, type: 'csuite' };

  return { label: 'growth trajectory', type: 'industry_anchor' };
}

export function hasRecentSignals(signals?: SignalData): boolean {
  if (!signals) return false;
  if (signals.funding?.days_ago != null && signals.funding.days_ago <= 90) return true;
  if (signals.hr_change?.days_ago != null && signals.hr_change.days_ago <= 60) return true;
  if (signals.hiring?.jobs_60d != null && signals.hiring.jobs_60d >= 10) return true;
  return false;
}
