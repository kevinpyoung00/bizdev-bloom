// ── Rotating Discovery Theme Configuration ──
// Each day-of-week maps to a theme with sub-sectors, trigger keywords, and query templates.

export type DayTheme = {
  key: string;
  label: string;
  industries: string[];
  subSectors: string[];
};

// Monday = 1 ... Sunday = 0 (JS getDay())
export const DAY_THEMES: Record<number, DayTheme> = {
  1: {
    key: 'biotech_life_sciences',
    label: 'Life Sciences / Biotech',
    industries: ['biotech', 'life sciences', 'pharmaceuticals', 'genomics'],
    subSectors: [
      'gene therapy', 'CRO', 'contract research', 'diagnostics', 'clinical trials',
      'drug discovery', 'biologics', 'mRNA', 'cell therapy', 'precision medicine',
      'bioinformatics', 'proteomics', 'immunotherapy', 'biosimilars', 'reagents',
    ],
  },
  2: {
    key: 'tech_pst',
    label: 'Tech / SaaS',
    industries: ['technology', 'SaaS', 'software', 'IT services'],
    subSectors: [
      'cybersecurity', 'fintech', 'edtech', 'healthtech', 'proptech', 'martech',
      'cloud infrastructure', 'AI platform', 'data analytics', 'DevOps',
      'enterprise software', 'B2B SaaS', 'IoT platform', 'robotics software',
    ],
  },
  3: {
    key: 'advanced_mfg_med_devices',
    label: 'Manufacturing / Med Devices',
    industries: ['manufacturing', 'medical devices', 'precision engineering'],
    subSectors: [
      'medtech engineering', 'CNC machining', 'injection molding', 'electronics manufacturing',
      'defense contractor', 'aerospace parts', 'semiconductor equipment', 'clean energy manufacturing',
      'industrial automation', '3D printing', 'additive manufacturing', 'quality systems',
    ],
  },
  4: {
    key: 'healthcare_social_assistance',
    label: 'Healthcare / Clinics / Providers',
    industries: ['healthcare', 'clinics', 'medical providers', 'behavioral health'],
    subSectors: [
      'urgent care', 'dental group', 'physical therapy', 'home health',
      'mental health', 'substance abuse treatment', 'hospice', 'primary care network',
      'community health center', 'surgical center', 'radiology group', 'telehealth',
    ],
  },
  5: {
    key: 'professional_services',
    label: 'Professional Services / Agencies / Financial Services',
    industries: ['professional services', 'consulting', 'financial services', 'insurance brokerage'],
    subSectors: [
      'accounting firm', 'law firm', 'staffing agency', 'marketing agency',
      'wealth management', 'private equity', 'venture capital', 'architecture firm',
      'engineering consulting', 'IT consulting', 'management consulting', 'real estate',
    ],
  },
  6: {
    key: 'hiring_sweep',
    label: 'Hiring Velocity Sweep',
    industries: ['any'],
    subSectors: [
      'rapid growth', 'scaling company', 'talent acquisition', 'mass hiring',
      'workforce expansion', 'new office', 'high growth startup',
    ],
  },
  0: {
    key: 'trigger_sweep',
    label: 'Leadership / Funding / Carrier Triggers',
    industries: ['any'],
    subSectors: [
      'executive transition', 'funding round', 'benefits renewal',
      'carrier change', 'M&A activity', 'IPO preparation',
    ],
  },
};

export const GEO_TERMS = [
  'Boston', 'Cambridge', 'Worcester', 'Waltham', 'Lowell', 'Andover',
  'New Bedford', 'Springfield', 'North Shore MA', 'South Shore MA',
  'Cape Cod', 'Western Massachusetts', 'Central Massachusetts',
  'Framingham', 'Quincy', 'Newton', 'Somerville', 'Brockton',
  'Needham', 'Burlington MA', 'Lexington MA', 'Bedford MA',
  'Route 128 corridor', 'MetroWest',
];

export const NE_GEO_TERMS = [
  'Hartford CT', 'New Haven CT', 'Stamford CT', 'Providence RI',
  'Portland ME', 'Manchester NH', 'Burlington VT', 'Nashua NH',
];

export const TRIGGER_KEYWORDS = {
  funding: [
    'raises $', 'Series A', 'Series B', 'Series C', 'funding round',
    'venture funding', 'growth equity', 'capital raise', 'seed round',
  ],
  hr_leader: [
    'Chief People Officer', 'VP People', 'CHRO', 'VP Human Resources',
    'Head of People', 'appointed', 'names new', 'hires',
  ],
  csuite: [
    'new CEO', 'new CFO', 'new COO', 'new CTO', 'new CIO',
    'executive appointment', 'promoted to', 'names new CEO',
  ],
  carrier_change: [
    'switches benefits carrier', 'Point32Health', 'Harvard Pilgrim',
    'Tufts Health Plan', 'BCBS', 'UHC', 'Aetna', 'Cigna',
    'Anthem', 'Humana', 'UMR', 'Surest', 'benefits renewal',
  ],
  hiring: [
    "we're hiring", 'open roles', 'careers', 'join our team',
    'now hiring', 'job openings', 'career opportunities',
  ],
  pr_news: [
    'announces', 'press release', 'opens', 'expands',
    'new location', 'partnership', 'acquisition',
  ],
};

export const QUERY_TEMPLATES = [
  '{geo} {industry} company',
  '{geo} {subsector}',
  'Massachusetts {industry} {trigger}',
  'Boston MA {subsector} {trigger}',
  'HQ Massachusetts {industry}',
  '{industry} company careers MA',
  '{geo} {industry} about us',
  '{subsector} company {geo} contact',
  '{industry} {trigger} Massachusetts',
  'New England {subsector} company',
];

// ── Discovery Control Panel options ──

export const PANEL_INDUSTRIES = [
  { key: 'biotech_life_sciences', label: 'Biotech / Life Sciences' },
  { key: 'healthcare', label: 'Healthcare / Clinics / Providers' },
  { key: 'tech_saas', label: 'Tech / SaaS' },
  { key: 'advanced_mfg', label: 'Advanced Manufacturing' },
  { key: 'med_devices', label: 'Medical Devices' },
  { key: 'professional_services', label: 'Professional Services / Agencies' },
  { key: 'financial_services', label: 'Financial Services' },
  { key: 'construction', label: 'Construction / Trades' },
  { key: 'hospitality', label: 'Hospitality' },
  { key: 'education', label: 'Education' },
  { key: 'govt_nonprofit', label: 'Government / Nonprofit' },
];

export const PANEL_TRIGGERS = [
  { key: 'funding', label: 'Funding (Series A/B/C, raises $)' },
  { key: 'hr_leader', label: 'New HR Leader' },
  { key: 'csuite', label: 'New C‑suite (CFO/COO/CHRO)' },
  { key: 'carrier_change', label: 'Carrier Change' },
  { key: 'hiring', label: 'Hiring Velocity (≥ 8 roles / 60d)' },
  { key: 'pr_news', label: 'Strong PR/News (≤ 60 days)' },
  { key: 'mild', label: 'Mild signals (website overhaul, new location)' },
];

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL',
  'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA',
  'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE',
  'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
];

export const GEO_SHORTCUTS = [
  { key: 'ma_only', label: 'Massachusetts only', states: ['MA'] },
  { key: 'ma_ne', label: 'Massachusetts + New England', states: ['MA', 'CT', 'RI', 'NH', 'ME', 'VT'] },
  { key: 'ne_only', label: 'New England only', states: ['CT', 'RI', 'NH', 'ME', 'VT'] },
];

export const COMPANY_SIZES = [
  { key: '20-49', label: '20–49', min: 20, max: 49 },
  { key: '50-149', label: '50–149', min: 50, max: 149 },
  { key: '150-500', label: '150–500', min: 150, max: 500 },
  { key: '500+', label: '500+', min: 500, max: 99999 },
];

export const DISCOVERY_TYPES = [
  { key: 'full', label: 'Full Firecrawl Search + Scrape (net-new)' },
  { key: 'news_trigger', label: 'News-trigger-only sweep' },
  { key: 'hiring_trigger', label: 'Hiring-trigger-only sweep' },
  { key: 'leadership_trigger', label: 'Leadership-trigger-only sweep' },
  { key: 'carrier_trigger', label: 'Carrier-change-only sweep' },
  { key: 'deep', label: 'Deep sweep (slower)' },
  { key: 'fast', label: 'Fast sweep (lighter)' },
];

export const RESULT_COUNTS = [10, 20, 50, 100];

// Helper to pick N random items from an array
export function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}
