export type ContactStatus = 'Unworked' | 'In Sequence' | 'Warm' | 'Hot' | 'Disqualified';
export type RolePersona = 'CEO' | 'Founder' | 'CFO' | 'COO' | 'CHRO' | 'HR' | 'Benefits Leader' | 'Finance' | 'Ops' | 'Other';
export type ContactSource = 'Sales Navigator' | 'ZoomInfo' | 'Zywave' | 'List Upload';
export type TouchOutcome = 'No Response' | 'Positive Reply' | 'Negative Reply' | 'Meeting Booked' | 'Bad Fit' | 'Bounced';
export type CampaignType = 'General' | 'Industry' | 'Custom';

export interface WeekPreset {
  week: number;
  emailTheme: string;
  linkedInTouch: string;
  cta: string;
  asset: string;
  callObjective?: string;
  callTalkTrack?: string;
  voicemailScript?: string;
}

export interface WeekProgress {
  week: number;
  liDone: boolean;
  emailDone: boolean;
  phoneDone: boolean;
  outcome: TouchOutcome | '';
  notes: string;
  ctaUsed: string;
  assetSent: string;
  completedDate?: string;
}

export interface TouchLog {
  id: string;
  date: string;
  channel: 'LinkedIn' | 'Email' | 'Phone' | 'Other';
  weekNum: number;
  touchNum: number;
  ctaUsed: string;
  assetSent: string;
  outcome: TouchOutcome | '';
  notes: string;
}

export type FundingStage = 'None' | 'Seed' | 'Series A' | 'Series B' | 'Series C+' | 'Private Equity' | 'Venture Debt';
export type CSuiteRole = 'CEO' | 'CFO' | 'COO' | 'CHRO' | 'Other';
export type TriggerTag = 'New location' | 'M&A' | 'Restructure' | 'Layoffs' | 'New product launch' | 'Approaching headcount milestone';

export interface MilestoneFlags {
  hit_50?: boolean;
  hit_75?: boolean;
  hit_100?: boolean;
  hit_150?: boolean;
}

export interface NewsSignal {
  keywords?: string[];
  last_mention_days_ago?: number | null;
}

export interface CarrierChangeSignal {
  recent?: boolean;
  former_carrier?: string;
  new_carrier?: string;
  days_ago?: number | null;
  source?: 'zywave' | 'news' | 'career_page' | 'manual' | 'other';
}

export interface TalentRiskSignal {
  risk?: boolean;
  review_change_direction?: 'up' | 'down';
  days_ago?: number | null;
}

export interface ContactSignals {
  funding_stage: FundingStage;
  funding_days_ago: number | null;
  hr_change_title: string;
  hr_change_days_ago: number | null;
  csuite_role: CSuiteRole | '';
  csuite_days_ago: number | null;
  jobs_60d: number | null;
  triggers: TriggerTag[];
  milestones?: MilestoneFlags;
  news?: NewsSignal;
  carrier_change?: CarrierChangeSignal;
  talent_risk?: TalentRiskSignal;
}

export function getHiringIntensity(jobs60d: number | null): string {
  if (!jobs60d || jobs60d < 3) return '';
  if (jobs60d >= 10) return 'Large';
  if (jobs60d >= 6) return 'Medium';
  return 'Small';
}

export function isHrChangeRecent(daysAgo: number | null): boolean {
  return daysAgo != null && daysAgo <= 60;
}

export function createEmptySignals(): ContactSignals {
  return {
    funding_stage: 'None',
    funding_days_ago: null,
    hr_change_title: '',
    hr_change_days_ago: null,
    csuite_role: '',
    csuite_days_ago: null,
    jobs_60d: null,
    triggers: [],
    milestones: {},
    news: {},
    carrier_change: {},
    talent_risk: {},
  };
}

export interface CompanyScrapeData {
  summary?: string;
  key_facts?: string[];
  outreach_angles?: string[];
  pain_points?: string[];
  scrapedAt?: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  rolePersona: RolePersona;
  industry: string;
  employeeCount: string;
  email: string;
  linkedInUrl: string;
  phone: string;
  source: ContactSource;
  renewalMonth: string;
  currentCarrier: string;
  campaignId: string;
  status: ContactStatus;
  startDate: string;
  currentWeek: number;
  lastTouchDate: string;
  nextTouchDate: string;
  notes: string;
  manualNotesForAI: string;
  signals: ContactSignals;
  companyScrape?: CompanyScrapeData;
  website?: string;
  weekProgress: WeekProgress[];
  touchLogs: TouchLog[];
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  criteria: string;
  industryTags: string[];
  sizeTags: string[];
  roleTags: string[];
  cadenceRules: string;
  weeklyPresets: WeekPreset[];
  active: boolean;
}

export interface EmailTemplate {
  id: string;
  week: number;
  campaignType: 'General' | 'Industry';
  subject: string;
  body: string;
  personalizationTip: string;
  starred?: boolean;
}

export interface LinkedInTemplate {
  id: string;
  type: 'Connection Request' | 'Value DM' | 'Soft CTA' | 'Benchmark Offer' | 'Invite' | 'Nurture' | 'Breakup';
  message: string;
  personalizationTip: string;
  starred?: boolean;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export const CALL_WEEKS = [1, 3, 5, 7, 9, 11];

export function isCallWeek(week: number): boolean {
  return CALL_WEEKS.includes(week);
}

export function createEmptyWeekProgress(): WeekProgress[] {
  return Array.from({ length: 12 }, (_, i) => ({
    week: i + 1,
    liDone: false,
    emailDone: false,
    phoneDone: false,
    outcome: '' as const,
    notes: '',
    ctaUsed: '',
    assetSent: '',
  }));
}

export function getStatusColor(status: ContactStatus): string {
  switch (status) {
    case 'Unworked': return 'bg-muted text-muted-foreground';
    case 'In Sequence': return 'bg-info/10 text-info';
    case 'Warm': return 'bg-warning/10 text-warning';
    case 'Hot': return 'bg-hot/10 text-hot';
    case 'Disqualified': return 'bg-destructive/10 text-destructive';
  }
}

export function getContactProgress(contact: Contact): number {
  const completed = contact.weekProgress.filter(w => {
    const hasCall = isCallWeek(w.week);
    return w.liDone && w.emailDone && (!hasCall || w.phoneDone);
  }).length;
  return Math.round((completed / 12) * 100);
}
