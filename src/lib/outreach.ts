/**
 * Generate personalized outreach artifacts (email, linkedin, call)
 * from contact/company data + triggers. Pure functions, no API calls.
 */

interface OutreachInput {
  contact: {
    first_name: string;
    last_name: string;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  company: {
    name: string;
    industry?: string | null;
    employee_count?: number | null;
  };
  triggers: string[];
  campaignName?: string | null;
}

interface OutreachResult {
  email: { subject: string; body: string };
  linkedin: { opener: string };
  call: { talkTrack: string; questions: string[] };
}

function pickTopTriggers(triggers: string[], max = 5): string[] {
  return (triggers || []).slice(0, max);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateOutreach(input: OutreachInput): OutreachResult {
  const { contact, company, triggers } = input;
  const top = pickTopTriggers(triggers);
  const firstName = contact.first_name || 'there';
  const companyName = company.name || 'your organization';
  const topTrigger = top[0] ? capitalize(top[0]) : 'Benefits optimization';
  const roleContext = contact.title ? ` in your role as ${contact.title}` : '';

  // Build value bullets from triggers
  const bullets = top.slice(0, 3).map(t => `  - ${capitalize(t)}: how leading employers are addressing this right now`);
  const bulletText = bullets.length > 0 ? bullets.join('\n') : '  - Benefits strategy alignment with growth goals';

  const subject = `${topTrigger} at ${companyName}`;

  const body = `Hi ${firstName},

I work with organizations like ${companyName} that are navigating ${top.slice(0, 2).join(' and ') || 'benefits complexity'}${roleContext}. A few areas where we've helped similar teams:

${bulletText}

Would either Tuesday or Thursday next week work for a 15-minute call? Happy to share what we're seeing in your space.

Best,`;

  const linkedin = `Hi ${firstName}, I noticed ${companyName} is navigating ${topTrigger.toLowerCase()}. We've helped similar organizations tackle this and I'd love to share a quick perspective. Open to connecting?`;

  const talkTrack = `Hi ${firstName}, this is Kevin Young with OneDigital. I'm reaching out because we work with organizations like ${companyName} that are focused on ${topTrigger.toLowerCase()}. I wanted to see if that resonates with what you're prioritizing right now.`;

  const questions = [
    `What's your biggest challenge around ${top[0] || 'benefits strategy'} heading into next year?`,
    `How are you currently approaching ${top[1] || 'plan design and cost management'}?`,
    `When is your next renewal, and are you seeing the data you need to make decisions?`,
    `Would it be helpful to see how peer organizations in ${company.industry || 'your space'} are handling this?`,
  ];

  return {
    email: { subject, body },
    linkedin: { opener: linkedin },
    call: { talkTrack, questions },
  };
}
