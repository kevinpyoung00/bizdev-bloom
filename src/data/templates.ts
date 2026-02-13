import { EmailTemplate, LinkedInTemplate } from '@/types/crm';

export const emailTemplates: EmailTemplate[] = [
  {
    id: 'gen-w1', week: 1, campaignType: 'General',
    subject: 'Quick hello — Kevin at OneDigital',
    body: `Hi {FirstName},\n\nI help leaders reduce renewal noise and improve benefits without hurting employee experience.\n\n[Insert 1-line insight relevant to their role.]\n\nOpen to a quick compare-and-contrast on what's working for peers?\n\n— Kevin`,
    personalizationTip: 'Reference their recent company news, a job change, or a LinkedIn post.',
  },
  {
    id: 'ind-w1', week: 1, campaignType: 'Industry',
    subject: 'Quick intro for {Industry} — Kevin at OneDigital',
    body: `Hi {FirstName},\n\nI spend a lot of time with {Industry} leaders navigating [insert industry pain point]. Seeing [insert trend/metric].\n\nWant a quick benchmark for {Industry}, {EmployeeCount} employees?\n\n— Kevin`,
    personalizationTip: 'Mention a specific trend or stat relevant to their industry vertical.',
  },
  {
    id: 'gen-w2', week: 2, campaignType: 'General',
    subject: 'What employees say they value vs what they use',
    body: `Hi {FirstName},\n\nWe're seeing leaders revisit total rewards after [insert brief stat/observation]. If helpful, I can share a 1-pager on what's moving the needle.\n\nWant it?\n\n— Kevin`,
    personalizationTip: 'Tie to a benefits trend their industry is experiencing.',
  },
  {
    id: 'ind-w2', week: 2, campaignType: 'Industry',
    subject: '{Industry} benefits trends — quick share',
    body: `Hi {FirstName},\n\nI've been tracking how {Industry} companies ({EmployeeCount} range) are reshaping their benefits. [Insert 1 trend.]\n\nWant the data?\n\n— Kevin`,
    personalizationTip: 'Reference a specific metric or trend for their industry.',
  },
  {
    id: 'gen-w3', week: 3, campaignType: 'General',
    subject: 'Quick compliance gut-check',
    body: `Hi {FirstName},\n\nRegulatory shifts are creating hidden risks for mid-market employers. I can share a simple checklist we use with clients.\n\nWant me to send it?\n\n— Kevin`,
    personalizationTip: 'Mention a specific regulatory change affecting their state or industry.',
  },
  {
    id: 'gen-w4', week: 4, campaignType: 'General',
    subject: 'Smarter plan design ideas to lower trend',
    body: `Hi {FirstName},\n\nWe're helping teams tune plan design, network, and Rx to lower trend without killing experience. If useful, I can send a 1-page playbook.\n\nWorth a look?\n\n— Kevin`,
    personalizationTip: 'Mention GLP-1 costs or a specific cost driver relevant to their size.',
  },
  {
    id: 'gen-w5', week: 5, campaignType: 'General',
    subject: 'Financial stress → productivity & retention',
    body: `Hi {FirstName},\n\nLeaders are updating plan design + comms after seeing [insert relevant stat/insight]. Want my quick take + checklist?\n\n— Kevin`,
    personalizationTip: 'Reference a financial wellness stat relevant to their employee demographic.',
  },
  {
    id: 'gen-w6', week: 6, campaignType: 'General',
    subject: 'Do more with the team you have',
    body: `Hi {FirstName},\n\nIf bandwidth is tight, there are two practical paths: augment HR or use PEO for admin relief. I can outline tradeoffs in 5 bullets.\n\nWant the summary?\n\n— Kevin`,
    personalizationTip: 'Reference their company size — smaller teams feel this pain more.',
  },
  {
    id: 'gen-w7', week: 7, campaignType: 'General',
    subject: 'Rates + risk posture — quick note',
    body: `Hi {FirstName},\n\nIf property/casualty spend is pressuring budgets, there are a few fast levers that help. Want a one-pager to sanity-check your approach?\n\n— Kevin`,
    personalizationTip: 'Only use if you know they have P&C exposure. Skip if pure EB focus.',
  },
  {
    id: 'gen-w8', week: 8, campaignType: 'General',
    subject: '1-pager: Founder Benefits OS',
    body: `Hi {FirstName},\n\nSharing a one-pager we use to align benefits with growth/retention. If helpful, I can tailor a version to {Industry}.\n\nWant a custom take?\n\n— Kevin`,
    personalizationTip: 'Founders and CEOs respond best to this one. Adjust for CFO/CHRO lens.',
  },
  {
    id: 'gen-w9', week: 9, campaignType: 'General',
    subject: 'Renewal prep — in-house or with a partner?',
    body: `Hi {FirstName},\n\nCurious how you're approaching renewal this cycle. If you want a quick benchmark before decisions, I can run it this week.\n\n— Kevin`,
    personalizationTip: 'If you know their renewal month, reference it directly.',
  },
  {
    id: 'gen-w10', week: 10, campaignType: 'General',
    subject: '20-min benchmark compare?',
    body: `Hi {FirstName},\n\nI can walk through a side-by-side for {Industry}/{EmployeeCount} in 20 minutes. Want a slot next week?\n\n— Kevin`,
    personalizationTip: 'This is the hard ask — be direct. Best if they\'ve engaged before.',
  },
  {
    id: 'gen-w11', week: 11, campaignType: 'General',
    subject: 'Noticed this at {Company}',
    body: `Hi {FirstName},\n\nSaw [insert specific observation]. Does that change how you're thinking about benefits or renewal timing?\n\nHappy to share a quick POV.\n\n— Kevin`,
    personalizationTip: 'Must be genuinely personalized — a job post, news article, or LinkedIn activity.',
  },
  {
    id: 'gen-w12', week: 12, campaignType: 'General',
    subject: 'Okay to close the loop?',
    body: `Hi {FirstName},\n\nI'll pause outreach here. If EB becomes a priority later, I'm glad to help with a fast benchmark or renewal plan.\n\nAppreciate staying connected.\n\n— Kevin`,
    personalizationTip: 'Keep it gracious. Many "breakup" emails actually get replies.',
  },
];

export const linkedInTemplates: LinkedInTemplate[] = [
  {
    id: 'li-connect', type: 'Connection Request',
    message: 'Saw overlap in the benefits/PE space — thought it made sense to connect.',
    personalizationTip: 'Reference a mutual connection, shared group, or industry overlap.',
  },
  {
    id: 'li-value', type: 'Value DM',
    message: `Thanks for connecting, {FirstName} — I help leaders reduce renewal noise and improve plan performance. If a quick benchmark helps, happy to share.`,
    personalizationTip: 'Send within 24 hours of connecting. Reference their role or company.',
  },
  {
    id: 'li-soft', type: 'Soft CTA',
    message: 'Want a 1-page summary on this? Takes 2 minutes to skim.',
    personalizationTip: 'Use after engaging with their content. Reference the specific post.',
  },
  {
    id: 'li-benchmark', type: 'Benchmark Offer',
    message: `{FirstName} — I can run a quick benchmark for {Industry} / {EmployeeCount} employees. Takes 20 minutes. Want a slot?`,
    personalizationTip: 'Best used weeks 9-10 when they\'ve seen multiple touches.',
  },
  {
    id: 'li-invite', type: 'Invite',
    message: 'Can walk you through a quick compare-and-contrast in 20 minutes. Want a slot next week?',
    personalizationTip: 'Direct ask — use after they\'ve engaged with at least one touch.',
  },
  {
    id: 'li-nurture', type: 'Nurture',
    message: `Saw your post on [topic] — resonated with what we're seeing in {Industry}. Thought you'd find this relevant: [insert link or insight].`,
    personalizationTip: 'Only use when you genuinely engage with their content.',
  },
  {
    id: 'li-breakup', type: 'Breakup',
    message: `{FirstName} — pausing outreach here. If benefits strategy becomes a priority, I'm a good resource. Appreciate the connection.`,
    personalizationTip: 'Keep it brief and professional. Leave the door open.',
  },
];
