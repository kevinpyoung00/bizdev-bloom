/**
 * Triggers pipeline — infer, normalize, merge trigger labels for contacts/leads.
 * Never returns empty: at minimum ['plan optimization'].
 */

export function normalizeTriggers(tags: string[]): string[] {
  const set = new Set<string>();
  for (const t of tags) {
    const v = (t || '').trim().toLowerCase();
    if (v) set.add(v);
  }
  return [...set];
}

export function inferBaselineTriggers(opts: {
  role_title?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  region?: string | null;
  domain?: string | null;
}): string[] {
  const tags: string[] = [];
  const title = (opts.role_title || '').toLowerCase();
  const industry = (opts.industry || '').toLowerCase();
  const emp = opts.employee_count ?? 0;
  const region = (opts.region || '').toUpperCase();

  // Role-based
  if (/cfo|finance|controller|treasurer/i.test(title)) {
    tags.push('cost containment', 'plan audit', 'governance');
  } else if (/chro|hr|people|talent|benefits/i.test(title)) {
    tags.push('talent retention', 'employee experience', 'admin simplicity');
  } else if (/ceo|president|founder|owner/i.test(title)) {
    tags.push('strategic outcomes', 'risk mitigation', 'board-ready reporting');
  } else if (/coo|operations/i.test(title)) {
    tags.push('operational efficiency', 'compliance risk');
  }

  // Industry-based
  if (/bank|financial|credit union|wealth/i.test(industry)) {
    tags.push('regulatory compliance', 'benchmark vs peers', 'turnover pressure');
  } else if (/tech|saas|software/i.test(industry)) {
    tags.push('competitive hiring', 'equity education');
  } else if (/manufactur|industrial/i.test(industry)) {
    tags.push('shift workforce', 'claims reduction');
  } else if (/health|medical|hospital/i.test(industry)) {
    tags.push('clinical staffing', 'burnout mitigation');
  } else if (/construct|building/i.test(industry)) {
    tags.push('field workforce coverage', 'workers comp optimization');
  } else if (/nonprofit|education/i.test(industry)) {
    tags.push('budget constraints', 'mission-aligned benefits');
  }

  // Size-based
  if (emp >= 50 && emp < 250) {
    tags.push('mid-market optimization', 'self-funding readiness check');
  } else if (emp >= 250 && emp <= 1000) {
    tags.push('stop-loss strategy', 'data-driven plan design');
  } else if (emp > 1000) {
    tags.push('enterprise benefits consolidation');
  }

  // Region-based
  if (region === 'MA' || region === 'MASSACHUSETTS') {
    tags.push('MA PFML & compliance', 'Boston talent pressure');
  } else if (['CT', 'RI', 'NH', 'VT', 'ME'].includes(region)) {
    tags.push('New England regulatory landscape');
  }

  // Fallback guarantee
  if (tags.length === 0) {
    tags.push('plan optimization');
  }

  return normalizeTriggers(tags);
}

export function mergeTriggerSets(existing: string[], ...newSets: string[][]): string[] {
  const all = new Set<string>();
  for (const s of [existing, ...newSets]) {
    for (const t of s || []) {
      const v = (t || '').trim().toLowerCase();
      if (v) all.add(v);
    }
  }
  // Cap at 12, most specific first (new tags first)
  const merged = [...all];
  return merged.slice(0, 12);
}

/** Derive trigger candidates from enrichment text snippets */
export function inferFromEnrichmentText(text: string): string[] {
  const t = (text || '').toLowerCase();
  const tags: string[] = [];
  if (/hiring|open roles|recruiting/i.test(t)) tags.push('aggressive hiring');
  if (/merger|acquisition|m&a/i.test(t)) tags.push('M&A integration');
  if (/funding|raised|series [a-d]/i.test(t)) tags.push('recent funding');
  if (/layoff|reduction|restructur/i.test(t)) tags.push('restructuring');
  if (/expansion|new office|new location/i.test(t)) tags.push('geographic expansion');
  if (/compliance|regulation|mandate/i.test(t)) tags.push('regulatory pressure');
  if (/carrier|switch|renew/i.test(t)) tags.push('carrier evaluation');
  return tags;
}
