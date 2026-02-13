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
  campaignId: string;
  status: ContactStatus;
  startDate: string;
  currentWeek: number;
  lastTouchDate: string;
  nextTouchDate: string;
  notes: string;
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
