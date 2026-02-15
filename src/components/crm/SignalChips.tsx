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
    chips.push({ label: `${signals.funding_stage}${recent ? ' ≤90d' : ''}`, icon: <DollarSign size={10} />, variant: recent ? 'default' : 'secondary' });
  }

  if (signals.hr_change_title) {
    const recent = isHrChangeRecent(signals.hr_change_days_ago);
    chips.push({ label: `HR Δ${recent ? ' ≤60d' : ''}`, icon: <UserCheck size={10} />, variant: recent ? 'default' : 'secondary' });
  }

  if (signals.csuite_role) {
    const recent = signals.csuite_days_ago != null && signals.csuite_days_ago <= 90;
    chips.push({ label: `${signals.csuite_role} Δ${recent ? ' ≤90d' : ''}`, icon: <Briefcase size={10} />, variant: recent ? 'default' : 'secondary' });
  }

  if (signals.jobs_60d != null && signals.jobs_60d >= 3) {
    const intensity = getHiringIntensity(signals.jobs_60d);
    chips.push({ label: `Hiring ${intensity}`, icon: <TrendingUp size={10} />, variant: intensity === 'Large' ? 'destructive' : 'default' });
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

/** Build signal chips from Lead Engine trigger data (accounts.triggers jsonb) */
export function buildChipsFromTriggers(triggers: any): SignalChip[] {
  if (!triggers) return [];
  const chips: SignalChip[] = [];

  const funding = triggers.funding ?? triggers.expansion ?? triggers.funding_expansion;
  if (funding) {
    const mo = typeof funding === 'object' ? (funding.months_ago ?? 12) : 12;
    chips.push({ label: `Funding${mo <= 3 ? ' ≤90d' : ''}`, icon: <DollarSign size={10} />, variant: mo <= 3 ? 'default' : 'secondary' });
  }

  const rc = triggers.recent_role_changes ?? triggers.non_csuite_role_changes;
  if (rc) {
    const items = Array.isArray(rc) ? rc : [rc];
    const best = Math.min(...items.map((i: any) => i.days_ago ?? 999));
    chips.push({ label: `HR Δ${best <= 60 ? ' ≤60d' : ''}`, icon: <UserCheck size={10} />, variant: best <= 60 ? 'default' : 'secondary' });
  }

  const cs = triggers.c_suite_changes ?? triggers.leadership_changes;
  if (cs) {
    chips.push({ label: 'C-Suite Δ', icon: <Briefcase size={10} />, variant: 'default' });
  }

  const openRoles = triggers.open_roles_60d ?? triggers.hiring_velocity ?? 0;
  if (openRoles >= 3) {
    const intensity = openRoles >= 10 ? 'Large' : openRoles >= 6 ? 'Medium' : 'Small';
    chips.push({ label: `Hiring ${intensity}`, icon: <TrendingUp size={10} />, variant: intensity === 'Large' ? 'destructive' : 'default' });
  }

  return chips;
}

/** Render signal chips as a flex-wrap row */
export default function SignalChips({ chips }: { chips: SignalChip[] }) {
  if (chips.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
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
