// Content Library — curated "Further reading" resources auto-inserted into weeks 2–12 emails

export interface ContentItem {
  title: string;
  url: string;
  description: string;
  /** Which week themes this resource best fits */
  weeks: number[];
  /** Optional industry filter; empty = all industries */
  industries?: string[];
}

export const CONTENT_LIBRARY: ContentItem[] = [
  {
    title: "The Mid-Market Benefits Benchmark Report",
    url: "https://www.onedigital.com/resources/benchmark-report",
    description: "See how 50–500 employee companies are managing benefits costs in 2025.",
    weeks: [2, 4, 7],
  },
  {
    title: "Employee Benefits Compliance Checklist",
    url: "https://www.onedigital.com/resources/compliance-checklist",
    description: "A quick-reference checklist for ACA, ERISA, and state-level requirements.",
    weeks: [3, 9],
  },
  {
    title: "Renewal Playbook: 120-Day Strategy Guide",
    url: "https://www.onedigital.com/resources/renewal-playbook",
    description: "How top HR teams prepare for renewal season and negotiate better outcomes.",
    weeks: [3, 5],
  },
  {
    title: "Employee Experience & Communications Toolkit",
    url: "https://www.onedigital.com/resources/ee-toolkit",
    description: "Templates and strategies for improving benefits communication and engagement.",
    weeks: [6],
  },
  {
    title: "Cost Containment Strategies for Growing Companies",
    url: "https://www.onedigital.com/resources/cost-containment",
    description: "Seven levers mid-market employers are using to bend the cost curve.",
    weeks: [4, 7],
  },
  {
    title: "HR Tech & BenAdmin Alignment Guide",
    url: "https://www.onedigital.com/resources/hr-tech-guide",
    description: "How to evaluate and align your benefits administration technology stack.",
    weeks: [8],
  },
  {
    title: "Healthcare Compliance Update",
    url: "https://www.onedigital.com/resources/compliance-update",
    description: "Latest regulatory changes and what they mean for your benefits program.",
    weeks: [9],
  },
  {
    title: "Client Success Stories",
    url: "https://www.onedigital.com/case-studies",
    description: "See how companies like yours achieved measurable benefits outcomes.",
    weeks: [10],
  },
  // Industry-specific resources
  {
    title: "Biotech Benefits Benchmarks",
    url: "https://www.onedigital.com/resources/biotech-benchmarks",
    description: "Compensation and benefits trends specific to life sciences companies.",
    weeks: [2, 4],
    industries: ["biotech_life_sciences"],
  },
  {
    title: "Manufacturing Workforce Benefits Guide",
    url: "https://www.onedigital.com/resources/manufacturing-guide",
    description: "Benefits strategies for shift-based and manufacturing workforces.",
    weeks: [2, 4],
    industries: ["advanced_mfg_med_devices"],
  },
  {
    title: "Higher Ed Benefits Landscape Report",
    url: "https://www.onedigital.com/resources/higher-ed-report",
    description: "How colleges and nonprofits are rethinking employee benefits.",
    weeks: [2, 4],
    industries: ["higher_ed_nonprofit"],
  },
  {
    title: "Healthcare Employer Benefits Trends",
    url: "https://www.onedigital.com/resources/healthcare-employer-trends",
    description: "Unique challenges and solutions for healthcare industry employers.",
    weeks: [2, 4],
    industries: ["healthcare_social_assistance"],
  },
  {
    title: "Tech Industry Talent & Benefits Report",
    url: "https://www.onedigital.com/resources/tech-talent-report",
    description: "How tech companies are using benefits to attract and retain talent.",
    weeks: [2, 4],
    industries: ["tech_pst"],
  },
];

/**
 * Get the best matching content item for a given week and optional industry.
 * Returns undefined if no match is found.
 */
export function getContentForWeek(week: number, industryKey?: string): ContentItem | undefined {
  if (week <= 1 || week > 12) return undefined;

  // Try industry-specific first
  if (industryKey) {
    const industryMatch = CONTENT_LIBRARY.find(
      (item) => item.weeks.includes(week) && item.industries?.includes(industryKey)
    );
    if (industryMatch) return industryMatch;
  }

  // Fall back to general (no industry filter)
  return CONTENT_LIBRARY.find(
    (item) => item.weeks.includes(week) && (!item.industries || item.industries.length === 0)
  );
}

/**
 * Format a content item as a "Further reading" line for email insertion.
 */
export function formatFurtherReading(item: ContentItem): string {
  return `Further reading: ${item.title} — ${item.url}`;
}
