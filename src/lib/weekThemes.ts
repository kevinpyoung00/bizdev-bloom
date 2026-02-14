// 12-week drip cadence themes

export const WEEK_THEMES: { week: number; theme: string; description: string }[] = [
  { week: 1, theme: 'Signal Moment Intro', description: 'The hero touch — lead with the strongest timing signal' },
  { week: 2, theme: 'Primary Persona Pain', description: 'Address the core pain point for the detected persona' },
  { week: 3, theme: 'Resource Share', description: 'Guide, checklist, or actionable resource' },
  { week: 4, theme: 'Industry Insight', description: 'Industry-specific benchmark or trend' },
  { week: 5, theme: 'Renewal Strategy', description: 'Renewal timing at 120, 90, or 60 days' },
  { week: 6, theme: 'Employee Experience', description: 'Employee experience and communications angle' },
  { week: 7, theme: 'Cost Containment', description: 'Cost containment levers and strategies' },
  { week: 8, theme: 'HR Tech Alignment', description: 'HR tech alignment and BenAdmin optimization' },
  { week: 9, theme: 'Compliance Focus', description: 'Compliance updates and regulatory awareness' },
  { week: 10, theme: 'Case Study', description: 'Proof point — case study or success story' },
  { week: 11, theme: 'Short Nudge', description: 'One-question micro-touch' },
  { week: 12, theme: 'Breakup', description: 'Value recap and graceful close' },
];

export function getWeekTheme(week: number) {
  return WEEK_THEMES.find(w => w.week === week) || WEEK_THEMES[0];
}
