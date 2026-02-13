import { Campaign, WeekPreset } from '@/types/crm';

const generalPresets: WeekPreset[] = [
  { week: 1, emailTheme: 'Intro & Value Prop', linkedInTouch: 'Connection request', cta: 'Open to a quick compare-and-contrast?', asset: '' },
  { week: 2, emailTheme: 'EVP / Value Perception', linkedInTouch: 'Value DM after connect', cta: 'Want the 1-pager?', asset: 'EVP Value Perception 1-Pager' },
  { week: 3, emailTheme: 'Compliance Gut-Check', linkedInTouch: 'Engage with their post', cta: 'Want the checklist?', asset: 'Compliance Checklist' },
  { week: 4, emailTheme: 'Benefits Modernization / Cost', linkedInTouch: 'Soft CTA DM', cta: 'Worth a look?', asset: 'Plan Design Playbook' },
  { week: 5, emailTheme: 'Retirement / Financial Wellness', linkedInTouch: 'Comment on post or share article', cta: 'Want my quick take + checklist?', asset: 'Financial Wellness Guide' },
  { week: 6, emailTheme: 'HR Capacity / Augmentation', linkedInTouch: 'Value DM', cta: 'Want the summary?', asset: 'HR Augmentation vs PEO Brief' },
  { week: 7, emailTheme: 'P&C Cross-sell / Risk', linkedInTouch: 'Engage with content', cta: 'Want a one-pager?', asset: 'Risk Posture One-Pager' },
  { week: 8, emailTheme: 'Value Drop — Founder Benefits OS', linkedInTouch: 'Share Founder OS asset', cta: 'Want a custom take?', asset: 'Founder Benefits OS PDF' },
  { week: 9, emailTheme: 'Renewal Prep', linkedInTouch: 'Soft CTA DM', cta: 'Want a quick benchmark?', asset: 'Renewal Prep Checklist' },
  { week: 10, emailTheme: 'Invite — Benchmark Session', linkedInTouch: 'Direct invite DM', cta: 'Want a slot next week?', asset: '' },
  { week: 11, emailTheme: 'Personalized Observation', linkedInTouch: 'Personalized comment/DM', cta: 'Happy to share a quick POV', asset: '' },
  { week: 12, emailTheme: 'Close the Loop', linkedInTouch: 'Breakup message', cta: 'Pause and stay connected', asset: '' },
];

const industryPresets: WeekPreset[] = [
  { week: 1, emailTheme: 'Industry-Specific Intro', linkedInTouch: 'Connection request with industry hook', cta: 'Want a quick benchmark for {Industry}?', asset: '' },
  { week: 2, emailTheme: 'Industry Trends & Pain Points', linkedInTouch: 'Share industry article', cta: 'Want the data?', asset: 'Industry Trend Report' },
  { week: 3, emailTheme: 'Compliance for {Industry}', linkedInTouch: 'Engage with their content', cta: 'Want the industry checklist?', asset: 'Industry Compliance Brief' },
  { week: 4, emailTheme: 'Cost Strategies for {Industry}', linkedInTouch: 'Value DM with case study', cta: 'See how peers are saving?', asset: 'Industry Cost Containment Guide' },
  { week: 5, emailTheme: 'Retention in {Industry}', linkedInTouch: 'Comment/share relevant post', cta: 'Want the retention playbook?', asset: 'Industry Retention Playbook' },
  { week: 6, emailTheme: 'HR Solutions for {Industry}', linkedInTouch: 'Soft CTA DM', cta: 'Worth a 5-min read?', asset: 'Industry HR Solutions Brief' },
  { week: 7, emailTheme: 'Risk & P&C for {Industry}', linkedInTouch: 'Engage with content', cta: 'Want the risk brief?', asset: 'Industry Risk Assessment' },
  { week: 8, emailTheme: 'Value Drop — {Industry} Benefits OS', linkedInTouch: 'Share asset via DM', cta: 'Want a tailored version?', asset: 'Industry Benefits OS PDF' },
  { week: 9, emailTheme: 'Renewal Prep for {Industry}', linkedInTouch: 'Benchmark offer DM', cta: 'Ready for a quick benchmark?', asset: 'Renewal Prep Checklist' },
  { week: 10, emailTheme: 'Invite — {Industry} Benchmark', linkedInTouch: 'Direct meeting invite', cta: '20 min next week?', asset: '' },
  { week: 11, emailTheme: 'Personalized {Industry} Insight', linkedInTouch: 'Personalized DM', cta: 'Noticed something — want my POV?', asset: '' },
  { week: 12, emailTheme: 'Close the Loop', linkedInTouch: 'Breakup message', cta: 'Pausing here — let\'s stay connected', asset: '' },
];

export const defaultCampaigns: Campaign[] = [
  {
    id: 'general-default',
    name: 'General Campaign — New Roles',
    type: 'General',
    criteria: 'Large list, multi-industry, universal messaging for new roles found via Sales Nav / ZoomInfo',
    industryTags: [],
    sizeTags: ['50-250', '250-1000', '1000+'],
    roleTags: ['CEO', 'CFO', 'CHRO', 'HR'],
    cadenceRules: 'LI touch then email 3 days later; advance weekly',
    weeklyPresets: generalPresets,
    active: true,
  },
  {
    id: 'industry-default',
    name: 'Industry Campaign — Targeted',
    type: 'Industry',
    criteria: 'Industry-specific messaging for 6 target verticals with tailored content themes',
    industryTags: ['Technology', 'Manufacturing', 'Healthcare', 'Financial Services', 'Professional Services', 'Construction'],
    sizeTags: ['50-250', '250-500'],
    roleTags: ['CEO', 'Founder', 'CFO', 'CHRO'],
    cadenceRules: 'LI touch then email 3 days later; advance weekly; industry-specific assets',
    weeklyPresets: industryPresets,
    active: true,
  },
];
