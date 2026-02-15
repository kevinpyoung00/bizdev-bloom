// Suggested Persona To Look Up on LinkedIn
// Combines employee count, industry, and signal overrides

export interface PersonaRecommendation {
  primary: string;
  alternates: string[];
  track: 'HR' | 'Finance' | 'Ops' | 'Founder';
  recommendedTitles: string[];
}

const TITLES_BY_TRACK: Record<string, string[]> = {
  HR: ['VP People', 'VP Human Resources', 'Director of HR', 'Head of People', 'Benefits Manager', 'Total Rewards Manager', 'HR Operations'],
  Finance: ['CFO', 'VP Finance', 'Controller', 'Head of Finance'],
  Ops: ['COO', 'Director of Operations', 'Head of Operations'],
  Founder: ['Founder', 'CEO', 'President', 'Owner'],
};

function inferTrack(primary: string): 'HR' | 'Finance' | 'Ops' | 'Founder' {
  const p = primary.toLowerCase();
  if (/cfo|finance|controller/.test(p)) return 'Finance';
  if (/coo|operations|ops|compliance/.test(p)) return 'Ops';
  if (/founder|ceo|president|owner/.test(p)) return 'Founder';
  return 'HR';
}

function byEmployeeCount(count: number | null | undefined): string[] {
  if (!count) return ['CEO / Founder'];
  if (count < 50) return ['Founder / CEO', 'COO'];
  if (count < 75) return ['HR Manager', 'Director of Ops'];
  if (count < 150) return ['HR Director', 'VP People'];
  return ['CHRO / Head of People', 'CFO'];
}

function byIndustry(industryKey: string | null | undefined): string[] {
  switch (industryKey) {
    case 'tech_pst': return ['HR Director', 'VP People', 'CFO'];
    case 'biotech_life_sciences': return ['VP People', 'HR Director', 'CFO'];
    case 'advanced_mfg_med_devices': return ['HR Director', 'COO', 'Compliance'];
    case 'healthcare_social_assistance': return ['HR Director', 'COO', 'Payroll-Benefits'];
    case 'higher_ed_nonprofit': return ['HR Director', 'CFO', 'COO'];
    case 'cannabis': return ['HR Director', 'CFO', 'COO'];
    default: return [];
  }
}

function bySignals(signals: any): string[] | null {
  if (!signals) return null;
  const ls = signals.lead_signals || signals;

  if (ls.funding?.recent || (ls.funding?.days_ago != null && ls.funding.days_ago <= 90)) {
    return ['CFO', 'VP People'];
  }
  if (ls.hr_change?.recent || (ls.hr_change?.days_ago != null && ls.hr_change.days_ago <= 60)) {
    const title = ls.hr_change?.title || ls.hr_change?.new_title;
    if (title) return [title];
    return ['HR Director'];
  }
  if (ls.hiring?.intensity === 'Large' || (ls.hiring?.jobs_60d != null && ls.hiring.jobs_60d >= 10)) {
    return ['HR Director', 'Recruiting Lead'];
  }
  if (ls.carrier_change?.recent) {
    return ['CFO', 'VP People'];
  }
  return null;
}

export function recommendPersona(
  employeeCount: number | null | undefined,
  industryKey: string | null | undefined,
  signals?: any,
): PersonaRecommendation {
  // Signal overrides take priority
  const signalOverride = bySignals(signals);
  if (signalOverride && signalOverride.length > 0) {
    const track = inferTrack(signalOverride[0]);
    return {
      primary: signalOverride[0],
      alternates: signalOverride.slice(1, 3),
      track,
      recommendedTitles: TITLES_BY_TRACK[track] || TITLES_BY_TRACK.HR,
    };
  }

  // Merge employee + industry, deduplicate
  const empList = byEmployeeCount(employeeCount);
  const indList = byIndustry(industryKey);

  const merged = indList.length > 0 ? indList : empList;
  const all = [...merged];
  for (const p of empList) {
    if (!all.includes(p)) all.push(p);
  }

  const track = inferTrack(all[0]);
  return {
    primary: all[0],
    alternates: all.slice(1, 3),
    track,
    recommendedTitles: TITLES_BY_TRACK[track] || TITLES_BY_TRACK.HR,
  };
}

/** Build a LinkedIn-friendly OR query from recommended titles */
export function buildTitleKeywords(rec: PersonaRecommendation): string {
  const titles = [rec.primary, ...rec.alternates].slice(0, 3);
  return titles.map(t => `"${t}"`).join(' OR ');
}
