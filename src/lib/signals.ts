// Unified signal types and helpers — shared across CRM contacts and Lead Engine

export type LeadSignals = {
  funding?: { stage: 'Seed' | 'Series A' | 'Series B' | 'Series C+' | 'Private Equity' | 'Venture Debt'; days_ago?: number };
  hr_change?: { title?: string; days_ago?: number };
  csuite?: { role?: 'CEO' | 'CFO' | 'COO' | 'CHRO' | 'Other'; days_ago?: number };
  hiring?: { jobs_60d?: number; intensity?: 'Small' | 'Medium' | 'Large' };
  triggers?: string[];
  milestones?: { hit_50?: boolean; hit_75?: boolean; hit_100?: boolean; hit_150?: boolean };
  news?: { keywords?: string[]; last_mention_days_ago?: number };
  carrier_change?: { recent?: boolean; former_carrier?: string; new_carrier?: string; days_ago?: number };
  talent_risk?: { risk?: boolean; review_change_direction?: 'up' | 'down'; days_ago?: number };
};

export function computeHiringIntensity(jobs60?: number | null): 'Small' | 'Medium' | 'Large' | undefined {
  if (jobs60 == null) return undefined;
  if (jobs60 >= 10) return 'Large';
  if (jobs60 >= 6) return 'Medium';
  if (jobs60 >= 3) return 'Small';
  return undefined;
}

/** Funding (<=90d) > HR change (<=60d) > Carrier change > Hiring (Large>Medium>Small) > C-suite (<=90d) > Talent risk > Industry anchor */
export function pickStrongestSignal(s?: LeadSignals | null): { kind: string; label: string; meta: any } {
  if (!s) return { kind: 'industry', label: 'growth trajectory', meta: null };

  if (s.funding?.days_ago != null && s.funding.days_ago <= 90)
    return { kind: 'funding', label: `recent ${s.funding.stage || 'funding'} round`, meta: s.funding };
  if (s.hr_change?.days_ago != null && s.hr_change.days_ago <= 60)
    return { kind: 'hr_change', label: `recent ${s.hr_change.title || 'HR leadership'} change`, meta: s.hr_change };
  if (s.carrier_change?.recent)
    return { kind: 'carrier_change', label: `recent carrier change${s.carrier_change.former_carrier ? ` from ${s.carrier_change.former_carrier}` : ''}`, meta: s.carrier_change };
  if (s.hiring?.intensity === 'Large')
    return { kind: 'hiring', label: `aggressive hiring (${s.hiring.jobs_60d} roles)`, meta: s.hiring };
  if (s.hiring?.intensity === 'Medium')
    return { kind: 'hiring', label: `notable hiring (${s.hiring.jobs_60d} roles)`, meta: s.hiring };
  if (s.hiring?.intensity === 'Small')
    return { kind: 'hiring', label: `active hiring (${s.hiring.jobs_60d} roles)`, meta: s.hiring };
  if (s.csuite?.days_ago != null && s.csuite.days_ago <= 90)
    return { kind: 'csuite', label: `recent ${s.csuite.role || 'C-suite'} transition`, meta: s.csuite };
  if (s.talent_risk?.risk)
    return { kind: 'talent_risk', label: `talent risk detected${s.talent_risk.review_change_direction ? ` (reviews ${s.talent_risk.review_change_direction})` : ''}`, meta: s.talent_risk };

  return { kind: 'industry', label: 'growth trajectory', meta: null };
}

/** Are there recent high-value signals worth referencing in Weeks 2–3? */
export function signalsRecent(s?: LeadSignals | null): boolean {
  if (!s) return false;
  if (s.funding?.days_ago != null && s.funding.days_ago <= 90) return true;
  if (s.hr_change?.days_ago != null && s.hr_change.days_ago <= 60) return true;
  if (s.hiring?.intensity === 'Large') return true;
  if (s.carrier_change?.recent) return true;
  return false;
}

/** Build a human-readable "Reason Selected" line from signals */
export function buildReasonSelectedLine(s?: LeadSignals | null): string {
  if (!s) return 'ICP fit';
  const parts: string[] = [];
  const strongest = pickStrongestSignal(s);
  if (strongest.kind !== 'industry') parts.push(strongest.label);
  if (s.hiring?.jobs_60d && !strongest.kind.startsWith('hiring')) parts.push(`${s.hiring.jobs_60d} open roles`);
  if (s.hr_change?.title && strongest.kind !== 'hr_change') parts.push(`HR change: ${s.hr_change.title}`);
  if (s.csuite?.role && strongest.kind !== 'csuite') parts.push(`new ${s.csuite.role}`);
  if (s.carrier_change?.recent && strongest.kind !== 'carrier_change') parts.push('carrier change');
  if (s.talent_risk?.risk && strongest.kind !== 'talent_risk') parts.push('talent risk');
  return parts.length > 0 ? parts.join(', ') : 'ICP fit';
}

/** Convert CRM ContactSignals flat format to the unified LeadSignals shape */
export function contactSignalsToLeadSignals(s: any): LeadSignals {
  if (!s) return {};
  return {
    funding: s.funding_stage && s.funding_stage !== 'None'
      ? { stage: s.funding_stage, days_ago: s.funding_days_ago ?? undefined }
      : undefined,
    hr_change: s.hr_change_title
      ? { title: s.hr_change_title, days_ago: s.hr_change_days_ago ?? undefined }
      : undefined,
    csuite: s.csuite_role
      ? { role: s.csuite_role, days_ago: s.csuite_days_ago ?? undefined }
      : undefined,
    hiring: s.jobs_60d != null && s.jobs_60d >= 3
      ? { jobs_60d: s.jobs_60d, intensity: computeHiringIntensity(s.jobs_60d) }
      : undefined,
    triggers: s.triggers?.length > 0 ? s.triggers : undefined,
    milestones: s.milestones,
    news: s.news,
    carrier_change: s.carrier_change?.recent ? s.carrier_change : undefined,
    talent_risk: s.talent_risk?.risk ? s.talent_risk : undefined,
  };
}
