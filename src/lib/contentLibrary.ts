// Content Library — curated OD assets auto-inserted into weeks 2–12 emails

export interface ContentItem {
  id: string;
  title: string;
  url: string;
  description: string;
  tags: string[];
  /** Persona tracks this resource is relevant to; empty = all */
  audience_personas: string[];
  /** Industry keys this resource fits; empty = all */
  industries: string[];
  /** Weeks this resource is a good fit for */
  weeks: number[];
}

export const CONTENT_LIBRARY: ContentItem[] = [
  {
    id: "workforce-insights",
    title: "Workforce Insights Guide",
    url: "https://launch.onedigital.com/evps#Form",
    description: "Employee value proposition strategies and workforce planning insights.",
    tags: ["insights", "benchmarking", "employee_experience"],
    audience_personas: ["HR", "CEO", "Ops"],
    industries: [],
    weeks: [2, 4, 11, 12],
  },
  {
    id: "hr-compliance",
    title: "Guide to HR Compliance",
    url: "https://launch.onedigital.com/guide-to-hr-compliance",
    description: "Quick-reference guide for ACA, ERISA, and state-level requirements.",
    tags: ["compliance"],
    audience_personas: ["HR", "CFO", "Ops"],
    industries: [],
    weeks: [3, 9],
  },
  {
    id: "cost-containment",
    title: "Cost Containment Playbook",
    url: "https://launch.onedigital.com/cost-containment-playbook/",
    description: "Seven levers mid-market employers use to bend the cost curve.",
    tags: ["cost_levers"],
    audience_personas: ["CFO", "CEO", "HR"],
    industries: [],
    weeks: [4, 7],
  },
  {
    id: "retirement-secure",
    title: "Retirement & SECURE 2.0 Solutions",
    url: "https://www.onedigital.com/en-US/solutions/financial-services/retirement-plan-services/",
    description: "Retirement plan strategies under SECURE 2.0 for mid-market employers.",
    tags: ["retirement"],
    audience_personas: ["CFO", "HR", "CEO"],
    industries: [],
    weeks: [5],
  },
  {
    id: "compensation-toolkit",
    title: "Compensation Planning Toolkit",
    url: "https://launch.onedigital.com/compensation-planning-toolkit",
    description: "Templates and strategies for competitive compensation planning.",
    tags: ["compensation", "employee_experience"],
    audience_personas: ["HR", "CFO", "CEO"],
    industries: [],
    weeks: [6, 11],
  },
  {
    id: "pc-market-insights",
    title: "P&C Market Insights",
    url: "https://launch.onedigital.com/property-and-casualty-market-insights",
    description: "Property & casualty market trends and risk management strategies.",
    tags: ["property_casualty"],
    audience_personas: ["CFO", "CEO", "Ops"],
    industries: [],
    weeks: [7, 10],
  },
  {
    id: "peo-resourcing",
    title: "PEO Solutions (Resourcing Edge)",
    url: "https://www.onedigital.com/en-US/solutions/peo/",
    description: "How a PEO model can simplify HR, benefits, and payroll for growing companies.",
    tags: ["peo", "hr_tech"],
    audience_personas: ["HR", "CEO", "Ops"],
    industries: [],
    weeks: [8],
  },
  {
    id: "hr-pulse-survey",
    title: "HR Pulse Survey",
    url: "https://onedigital.surveymonkey.com/r/OD_Example",
    description: "Quick pulse check on your HR and benefits priorities — takes 2 minutes.",
    tags: ["survey", "employee_experience", "insights"],
    audience_personas: [],
    industries: [],
    weeks: [11, 12],
  },
];

/** Tag priority per week — used to rank matching assets */
const WEEK_TAG_PRIORITY: Record<number, string[]> = {
  2: ["insights", "benchmarking"],
  3: ["compliance"],
  4: ["cost_levers"],
  5: ["retirement"],
  6: ["compensation"],
  7: ["property_casualty"],
  8: ["peo", "hr_tech"],
  9: ["compliance"],
  10: ["case_study", "property_casualty"],
  11: ["survey", "employee_experience"],
  12: ["survey", "insights"],
};

/**
 * Get up to `limit` matching content items for a given week, persona, and industry.
 * Matching: week must be in item.weeks, then score by tag priority + persona + industry overlap.
 */
export function getContentForWeek(
  week: number,
  industryKey?: string,
  persona?: string,
  limit: number = 2
): ContentItem[] {
  if (week <= 1 || week > 12) return [];

  const priorityTags = WEEK_TAG_PRIORITY[week] || [];

  // Filter to items that list this week
  const candidates = CONTENT_LIBRARY.filter((item) => item.weeks.includes(week));

  // Score each candidate
  const scored = candidates.map((item) => {
    let score = 0;

    // Tag overlap with week priority
    for (const tag of priorityTags) {
      if (item.tags.includes(tag)) score += 10;
    }

    // Persona match
    if (persona && item.audience_personas.length > 0) {
      if (item.audience_personas.includes(persona)) score += 5;
      else score -= 2; // slight penalty for mismatch
    }

    // Industry match
    if (industryKey && item.industries.length > 0) {
      if (item.industries.includes(industryKey)) score += 5;
      else score -= 2;
    }

    return { item, score };
  });

  // Sort by score desc, take top `limit`
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

/**
 * Format content items as a "Further reading" footer line for email insertion.
 */
export function formatFurtherReading(items: ContentItem[]): string {
  if (items.length === 0) return "";
  const parts = items.map((item) => `${item.title} (${item.url})`);
  return `Further reading: ${parts.join(" · ")}`;
}
