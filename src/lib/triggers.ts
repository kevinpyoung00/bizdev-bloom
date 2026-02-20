/**
 * Triggers pipeline — infer, normalize, merge trigger labels for contacts/leads.
 * Never returns empty: at minimum ['plan optimization'].
 */

export function normalizeTriggers(tags: string[]): string[] {
  const set = new Set<string>();
  for (const t of tags) {
    const v = (t || '').trim().toLowerCase();
    if (v && v.length <= 60) set.add(v);
  }
  const arr = [...set];
  return arr.slice(0, 12);
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
  const region = (opts.region || '').toLowerCase();
  const domain = (opts.domain || '').toLowerCase();

  // Role-based
  if (/cfo|finance|controller|treasurer/.test(title)) {
    tags.push('cost containment', 'plan audit', 'governance');
  } else if (/chro|hr|people|talent|benefits/.test(title)) {
    tags.push('talent retention', 'employee experience', 'admin simplicity');
  } else if (/ceo|president|founder|owner/.test(title)) {
    tags.push('strategic outcomes', 'risk mitigation', 'board-ready reporting');
  } else if (/coo|operations/.test(title)) {
    tags.push('operational efficiency', 'compliance risk');
  }

  // Industry-based
  if (/bank|financial|credit union|wealth/.test(industry)) {
    tags.push('regulatory compliance', 'benchmark vs peers', 'turnover pressure');
  } else if (/tech|saas|software/.test(industry)) {
    tags.push('competitive hiring', 'equity education', 'fast growth scalability');
  } else if (/manufactur|industrial/.test(industry)) {
    tags.push('shift workforce', 'safety programs', 'claims reduction');
  } else if (/health|medical|hospital/.test(industry)) {
    tags.push('clinical staffing', 'burnout mitigation');
  } else if (/construct|building/.test(industry)) {
    tags.push('field workforce coverage', 'workers comp optimization');
  } else if (/nonprofit|education/.test(industry)) {
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
  if (/ma|massachusetts|boston/.test(region)) {
    tags.push('MA PFML & compliance', 'Boston talent pressure');
  } else if (/ct|ri|nh|vt|me/.test(region)) {
    tags.push('New England regulatory landscape');
  }

  // Domain-based
  if (/\.bank$/.test(domain)) {
    tags.push('community bank governance');
  }

  // Fallback guarantee
  if (tags.length === 0) {
    tags.push('plan optimization');
  }

  return normalizeTriggers(tags);
}

export function mergeTriggerSets(existing: string[], ...newSets: string[][]): string[] {
  const all = new Set<string>();
  // New tags first (higher priority)
  for (const s of newSets) {
    for (const t of s || []) {
      const v = (t || '').trim().toLowerCase();
      if (v) all.add(v);
    }
  }
  // Then existing
  for (const t of existing || []) {
    const v = (t || '').trim().toLowerCase();
    if (v) all.add(v);
  }
  return [...all].slice(0, 12);
}

/** Derive trigger candidates from enrichment text snippets */
export function inferFromEnrichmentText(text: string): string[] {
  const t = (text || '').toLowerCase();
  const tags: string[] = [];
  if (/hiring|open roles|recruiting|careers|jobs/.test(t)) tags.push('aggressive hiring');
  if (/merger|acquisition|m&a/.test(t)) tags.push('M&A integration', 'benefits harmonization');
  if (/funding|raised|series [a-d]/.test(t)) tags.push('recent funding');
  if (/layoff|reduction|restructur/.test(t)) tags.push('restructuring');
  if (/expansion|new office|new location/.test(t)) tags.push('geographic expansion');
  if (/compliance|regulation|mandate/.test(t)) tags.push('regulatory pressure');
  if (/carrier|switch|renew/.test(t)) tags.push('carrier evaluation');
  if (/self.?funded|self.?insured|stop.?loss/.test(t)) tags.push('self-funded governance', 'stop-loss optimization');
  if (/growth|scaling|rapid/.test(t)) tags.push('fast growth scalability');
  return tags;
}

/** Extract hints from scraped website text (headings, short paragraphs) */
export function extractWebHints(opts: { linkedinHtml?: string; websiteHtml?: string }): string[] {
  const tags: string[] = [];
  const li = (opts.linkedinHtml || '').toLowerCase();
  const web = (opts.websiteHtml || '').toLowerCase();

  // LinkedIn about/headline hints
  if (/finance|cfo|controller/.test(li)) tags.push('financial leadership');
  if (/growth|scaling/.test(li)) tags.push('growth stage');
  if (/people ops|hr|talent/.test(li)) tags.push('people-first culture');

  // Website hints
  if (/careers|jobs|open positions|we.re hiring/.test(web)) tags.push('aggressive hiring');
  if (/acquisition|merger|m&a/.test(web)) tags.push('M&A integration', 'benefits harmonization');
  if (/self.?funded|stop.?loss/.test(web)) tags.push('self-funded governance', 'stop-loss optimization');
  if (/compliance|regulatory/.test(web)) tags.push('regulatory pressure');
  if (/news|press/.test(web) && /acquisition|merger/.test(web)) tags.push('M&A integration');

  // Dedupe and cap
  return [...new Set(tags)].slice(0, 6);
}
