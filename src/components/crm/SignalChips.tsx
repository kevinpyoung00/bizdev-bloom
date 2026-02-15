import { Badge } from '@/components/ui/badge';
import { DollarSign, UserCheck, Briefcase, TrendingUp, Tag, Building2, Newspaper } from 'lucide-react';
import type { ContactSignals } from '@/types/crm';
import { getHiringIntensity, isHrChangeRecent } from '@/types/crm';

interface SignalChip {
  label: string;
  icon: React.ReactNode;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}

/** Build signal chips from CRM-style ContactSignals (manual contacts) */
export function buildChipsFromSignals(signals?: ContactSignals | null): SignalChip[] {
  if (!signals) return [];
  const chips: SignalChip[] = [];

  if (signals.funding_stage && signals.funding_stage !== 'None') {
    const recent = signals.funding_days_ago != null && signals.funding_days_ago <= 90;
    const label = signals.funding_days_ago != null ? `${signals.funding_stage} (${signals.funding_days_ago}d)` : signals.funding_stage;
    chips.push({ label, icon: <DollarSign size={10} />, variant: recent ? 'default' : 'secondary' });
  }

  if (signals.hr_change_title) {
    const recent = isHrChangeRecent(signals.hr_change_days_ago);
    const label = signals.hr_change_days_ago != null ? `${signals.hr_change_title} (${signals.hr_change_days_ago}d)` : signals.hr_change_title;
    chips.push({ label, icon: <UserCheck size={10} />, variant: recent ? 'default' : 'secondary' });
  }

  if (signals.csuite_role) {
    const recent = signals.csuite_days_ago != null && signals.csuite_days_ago <= 90;
    const label = signals.csuite_days_ago != null ? `New ${signals.csuite_role} (${signals.csuite_days_ago}d)` : `New ${signals.csuite_role}`;
    chips.push({ label, icon: <Briefcase size={10} />, variant: recent ? 'default' : 'secondary' });
  }

  if (signals.jobs_60d != null && signals.jobs_60d >= 3) {
    const intensity = getHiringIntensity(signals.jobs_60d);
    chips.push({ label: `Hiring: ${signals.jobs_60d} roles`, icon: <TrendingUp size={10} />, variant: intensity === 'Large' ? 'destructive' : 'default' });
  }

  if (signals.milestones) {
    const m = signals.milestones;
    const milestoneLabels: string[] = [];
    if (m.hit_150) milestoneLabels.push('150+');
    else if (m.hit_100) milestoneLabels.push('100+');
    else if (m.hit_75) milestoneLabels.push('75+');
    else if (m.hit_50) milestoneLabels.push('50+');
    if (milestoneLabels.length > 0) {
      chips.push({ label: `${milestoneLabels[0]} EE`, icon: <Building2 size={10} />, variant: 'secondary' });
    }
  }

  if (signals.news?.keywords && signals.news.keywords.length > 0) {
    chips.push({ label: 'News', icon: <Newspaper size={10} />, variant: 'secondary' });
  }

  if (signals.triggers && signals.triggers.length > 0) {
    for (const t of signals.triggers) {
      chips.push({ label: t, icon: <Tag size={10} />, variant: 'outline' });
    }
  }

  return chips;
}

/** Build signal chips from Lead Engine trigger data (accounts.triggers jsonb or normalized lead_signals) */
export function buildChipsFromTriggers(triggers: any): SignalChip[] {
  if (!triggers) return [];
  const chips: SignalChip[] = [];

  // Handle normalized LeadSignals format (from reason.lead_signals)
  if (triggers.funding?.stage) {
    const d = triggers.funding.days_ago;
    const label = d != null ? `${triggers.funding.stage} (${d}d)` : triggers.funding.stage;
    chips.push({ label, icon: <DollarSign size={10} />, variant: d != null && d <= 90 ? 'default' : 'secondary' });
  } else {
    const funding = triggers.expansion ?? triggers.funding_expansion;
    if (funding) {
      const mo = typeof funding === 'object' ? (funding.months_ago ?? 12) : 12;
      chips.push({ label: `Funding${mo <= 3 ? ' ≤90d' : ''}`, icon: <DollarSign size={10} />, variant: mo <= 3 ? 'default' : 'secondary' });
    }
  }

  if (triggers.hr_change?.title) {
    const d = triggers.hr_change.days_ago;
    const label = d != null ? `${triggers.hr_change.title} (${d}d)` : triggers.hr_change.title;
    chips.push({ label, icon: <UserCheck size={10} />, variant: d != null && d <= 60 ? 'default' : 'secondary' });
  } else {
    const rc = triggers.recent_role_changes ?? triggers.non_csuite_role_changes;
    if (rc) {
      const items = Array.isArray(rc) ? rc : [rc];
      const best = Math.min(...items.map((i: any) => i.days_ago ?? 999));
      chips.push({ label: `HR Δ${best <= 60 ? ' ≤60d' : ''}`, icon: <UserCheck size={10} />, variant: best <= 60 ? 'default' : 'secondary' });
    }
  }

  if (triggers.csuite?.role) {
    const d = triggers.csuite.days_ago;
    const label = d != null ? `New ${triggers.csuite.role} (${d}d)` : `New ${triggers.csuite.role}`;
    chips.push({ label, icon: <Briefcase size={10} />, variant: 'default' });
  } else {
    const cs = triggers.c_suite_changes ?? triggers.leadership_changes;
    if (cs) {
      chips.push({ label: 'C-Suite Δ', icon: <Briefcase size={10} />, variant: 'default' });
    }
  }

  if (triggers.hiring?.jobs_60d != null && triggers.hiring.jobs_60d >= 3) {
    const intensity = triggers.hiring.intensity || (triggers.hiring.jobs_60d >= 10 ? 'Large' : triggers.hiring.jobs_60d >= 6 ? 'Medium' : 'Small');
    chips.push({ label: `Hiring: ${triggers.hiring.jobs_60d} roles`, icon: <TrendingUp size={10} />, variant: intensity === 'Large' ? 'destructive' : 'default' });
  } else {
    const openRoles = triggers.open_roles_60d ?? triggers.hiring_velocity ?? 0;
    if (openRoles >= 3) {
      const intensity = openRoles >= 10 ? 'Large' : openRoles >= 6 ? 'Medium' : 'Small';
      chips.push({ label: `Hiring: ${openRoles} roles`, icon: <TrendingUp size={10} />, variant: intensity === 'Large' ? 'destructive' : 'default' });
    }
  }

  // Milestones
  if (triggers.milestones) {
    const m = triggers.milestones;
    if (m.hit_150) chips.push({ label: 'Hit 150', icon: <Building2 size={10} />, variant: 'secondary' });
    else if (m.hit_100) chips.push({ label: 'Hit 100', icon: <Building2 size={10} />, variant: 'secondary' });
    else if (m.hit_75) chips.push({ label: 'Hit 75', icon: <Building2 size={10} />, variant: 'secondary' });
    else if (m.hit_50) chips.push({ label: 'Hit 50', icon: <Building2 size={10} />, variant: 'secondary' });
  }

  // News
  if (triggers.news?.keywords?.length > 0) {
    chips.push({ label: 'News', icon: <Newspaper size={10} />, variant: 'secondary' });
  }

  // Trigger labels array (M&A, New location, etc.)
  if (triggers.triggers && Array.isArray(triggers.triggers)) {
    for (const t of triggers.triggers) {
      chips.push({ label: t, icon: <Tag size={10} />, variant: 'outline' });
    }
  }

  return chips;
}

/** Render signal chips as a flex-wrap row */
export default function SignalChips({ chips }: { chips: SignalChip[] }) {
  if (chips.length === 0) return <span className="text-xs text-muted-foreground italic">No active signals</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip, i) => (
        <Badge key={i} variant={chip.variant} className="text-[10px] px-1.5 py-0 gap-0.5 font-medium">
          {chip.icon} {chip.label}
        </Badge>
      ))}
    </div>
  );
}
