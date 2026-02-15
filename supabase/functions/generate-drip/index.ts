import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEEK_THEMES: Record<number, string> = {
  1: "Signal Moment Intro — hero touch",
  2: "Primary Persona Pain",
  3: "Resource Share (guide/checklist)",
  4: "Industry Insight or Benchmark",
  5: "Renewal Strategy (120/90/60 days)",
  6: "Employee Experience & Communications",
  7: "Cost Containment Levers",
  8: "HR Tech Alignment & BenAdmin",
  9: "Compliance Focus",
  10: "Case Study / Proof Point",
  11: "Short Nudge — one question",
  12: "Breakup with Value Recap",
};

/* ── Persona framing maps ── */

const PERSONA_FRAMING: Record<string, string> = {
  HR: "Frame around HR administration burden, compliance risk, open enrollment complexity, and employee communications.",
  CFO: "Frame around renewal math, cost-per-employee trends, total cost of risk, and ROI of benefits optimization.",
  CEO: "Frame around talent retention risk, employer brand, leadership visibility into benefits spend, and competitive positioning.",
  Ops: "Frame around process efficiency, vendor consolidation, payroll/benefits integration, and scaling HR operations.",
  Recruiting: "Frame around candidate pipeline competitiveness, offer-stage win rates, and benefits as a recruiting differentiator.",
  ExecGeneral: "Frame with an HR-light executive lens: high-level cost, risk, and talent themes without deep technical detail.",
};

const INDUSTRY_CONTEXT: Record<string, string> = {
  biotech_life_sciences: "Biotech & Life Sciences: mention clinical-stage workforce scaling, ESOP/equity comp complexity, and FDA-timeline HR planning.",
  tech_pst: "Tech / PST: reference competitive talent markets, remote-first benefits design, and equity-heavy comp packages.",
  advanced_mfg_med_devices: "Advanced Manufacturing & Med Devices: address shift-worker benefits parity, OSHA compliance, and multi-site administration.",
  healthcare_social_assistance: "Healthcare & Social Assistance: touch on clinician burnout, 24/7 staffing benefits, and Medicaid/Medicare crossover.",
  higher_ed_nonprofit: "Higher Education & Nonprofit: mention budget constraints, public-sector benchmarking, and mission-driven retention.",
  cannabis: "Cannabis: address 280E tax implications, limited insurance market, multi-state compliance, and rapid growth challenges.",
  general_exec: "General industry: use broad mid-market examples without industry-specific jargon.",
};

/* ── Strongest signal selection ── */

function pickStrongestSignal(signals: any): { label: string; type: string } {
  if (signals?.funding?.days_ago != null && signals.funding.days_ago <= 90)
    return { label: `recent ${signals.funding.stage || "funding"} round (${signals.funding.days_ago}d ago)`, type: "funding" };
  if (signals?.hr_change?.days_ago != null && signals.hr_change.days_ago <= 60)
    return { label: `recent ${signals.hr_change.title || "HR leadership"} change (${signals.hr_change.days_ago}d ago)`, type: "hr_change" };
  if (signals?.carrier_change?.recent)
    return { label: `recent carrier change${signals.carrier_change.former_carrier ? ` from ${signals.carrier_change.former_carrier}` : ""}`, type: "carrier_change" };
  if (signals?.hiring?.jobs_60d != null && signals.hiring.jobs_60d >= 10)
    return { label: `aggressive hiring — ${signals.hiring.jobs_60d} roles in 60 days (Large intensity)`, type: "hiring_large" };
  if (signals?.hiring?.jobs_60d != null && signals.hiring.jobs_60d >= 6)
    return { label: `notable hiring — ${signals.hiring.jobs_60d} roles in 60 days (Medium intensity)`, type: "hiring_medium" };
  if (signals?.hiring?.jobs_60d != null && signals.hiring.jobs_60d >= 3)
    return { label: `active hiring — ${signals.hiring.jobs_60d} roles in 60 days`, type: "hiring_small" };
  if (signals?.csuite?.days_ago != null && signals.csuite.days_ago <= 90)
    return { label: `recent ${signals.csuite.role || "C-suite"} transition (${signals.csuite.days_ago}d ago)`, type: "csuite" };
  if (signals?.talent_risk?.risk)
    return { label: `talent risk detected${signals.talent_risk.review_change_direction ? ` (reviews trending ${signals.talent_risk.review_change_direction})` : ""}`, type: "talent_risk" };
  return { label: "growth trajectory", type: "industry_anchor" };
}

function hasRecentSignals(signals: any): boolean {
  if (signals?.funding?.days_ago != null && signals.funding.days_ago <= 90) return true;
  if (signals?.hr_change?.days_ago != null && signals.hr_change.days_ago <= 60) return true;
  if (signals?.hiring?.jobs_60d != null && signals.hiring.jobs_60d >= 10) return true;
  if (signals?.carrier_change?.recent) return true;
  return false;
}

/* ── Simple hash for micro-variant selection ── */

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ── Week 1 prompt builder ── */

function buildWeek1Prompt(channel: string, data: any): string {
  const { company_name, industry_label, industry_key, hq_city, hq_state, employee_count, persona, signals, contact, manual_notes_for_ai, current_carrier, company_scrape } = data;

  const strongest = pickStrongestSignal(signals);
  const location = [hq_city, hq_state].filter(Boolean).join(", ");
  const sizeRange = employee_count ? `${employee_count}-employee` : "mid-market";
  const firstName = contact?.first_name || "there";
  const personaFrame = PERSONA_FRAMING[persona] || PERSONA_FRAMING.ExecGeneral;
  const industryFrame = INDUSTRY_CONTEXT[industry_key] || INDUSTRY_CONTEXT.general_exec;

  // Micro-variant seed
  const variantSeed = simpleHash(`${company_name || ""}${firstName}${persona}`);
  const variantNote = `Select micro-variant ${(variantSeed % 3) + 1} of 3: vary the opening hook phrasing and CTA wording slightly so similar leads receive distinct messages.`;

  if (channel === "email") {
    const notesLine = manual_notes_for_ai ? `\n- Additional context (weave naturally, one sentence max): "${manual_notes_for_ai}"` : "";
    const carrierLine = current_carrier ? `\n- Current benefits carrier: ${current_carrier}` : "";
    const scrapeLine = company_scrape?.summary ? `\n- Company Intel (from website): ${company_scrape.summary}` : "";
    const anglesLine = company_scrape?.outreach_angles?.length ? `\n- AI-suggested outreach angles: ${company_scrape.outreach_angles.join("; ")}` : "";
    const scrapeFactsLine = company_scrape?.key_facts?.length ? `\n- Key company facts: ${company_scrape.key_facts.join("; ")}` : "";
    return `You are a business development executive at OneDigital, a top employee benefits advisory firm.

Write a personalized cold email (4-6 sentences) for Week 1 of a 12-week outreach cadence.

LEAD CONTEXT:
- Company: ${company_name}
- Industry: ${industry_label || "General"} (key: ${industry_key || "general_exec"})
- Location: ${location || "US"}
- Size: ${sizeRange}
- Persona: ${persona}
- Strongest Signal: ${strongest.label} (type: ${strongest.type})
- All Signals: ${JSON.stringify(signals || {})}${carrierLine}${notesLine}${scrapeLine}${anglesLine}${scrapeFactsLine}

STRUCTURE (follow this order):
1. **Signal-anchored opener**: Lead with "${strongest.label}" — make it the first sentence hook.
2. **Persona paragraph**: ${personaFrame}
3. **Industry sentence**: ${industryFrame}
4. **OneDigital authority**: Brief regional relevance${location ? ` (${location})` : ""}.
5. **Soft CTA**: "10-15 minutes next week" or similar low-pressure ask.

RULES:
- ${variantNote}
- Subject line must reference the signal
- Do NOT use high-pressure sales language
- Tone: **Crisp Consultative** — concise, direct, cost-containment focused. No fluff.
- Address the recipient as ${firstName}
- Sign off with exactly "Best," on its own line. Do NOT include a name after "Best,"
- Keep to 3-6 sentences in the body

OUTPUT FORMAT (JSON):
{"subject": "...", "body": "..."}`;
  }

  if (channel === "linkedin") {
    return `Write a LinkedIn connection request note (under 300 characters) for Week 1:
- Company: ${company_name}, ${industry_label || "General"}
- Signal: ${strongest.label}
- Persona: ${persona}
- ${personaFrame}
- Tone: consultative, friendly, not salesy. Mention the signal briefly, suggest mutual value.
- ${variantNote}

OUTPUT FORMAT (JSON):
{"body": "..."}`;
  }

  // phone
  return `Create a Phone Touch for a first outreach call:
- Company: ${company_name}, ${industry_label || "General"}, ${sizeRange}
- Signal: ${strongest.label}
- Persona: ${persona}
- ${personaFrame}
- ${industryFrame}
- Location: ${location || "US"}

Provide:
1. 3-5 talking points (bullet format) — lead with the signal, incorporate persona framing
2. A voicemail micro-script (under 20 seconds when spoken)

Tone: consultative, not pushy. Focus on benefits strategy and the signal.

OUTPUT FORMAT (JSON):
{"body": "Talking Points:\\n- ...\\n\\nVoicemail Script:\\n..."}`;
}

/* ── Weeks 2-12 prompt builder ── */

function buildDripPrompt(week: number, channel: string, data: any): string {
  const { company_name, industry_label, industry_key, persona, signals, hq_city, hq_state, employee_count, contact, manual_notes_for_ai, company_scrape } = data;
  const theme = WEEK_THEMES[week] || "Follow-up";
  const location = [hq_city, hq_state].filter(Boolean).join(", ");
  const sizeRange = employee_count ? `${employee_count}-employee` : "mid-market";
  const firstName = contact?.first_name || "there";
  const personaFrame = PERSONA_FRAMING[persona] || PERSONA_FRAMING.ExecGeneral;
  const industryFrame = INDUSTRY_CONTEXT[industry_key] || INDUSTRY_CONTEXT.general_exec;
  const recentSignals = hasRecentSignals(signals);
  const referenceSignals = recentSignals && week <= 3;

  if (channel === "email") {
    const notesLine = manual_notes_for_ai ? `\nADDITIONAL CONTEXT (weave naturally, one sentence max): "${manual_notes_for_ai}"` : "";
    const companyIntel = company_scrape?.summary ? `\nCOMPANY INTEL (from website — use to personalize): ${company_scrape.summary}` : "";
    const angles = company_scrape?.outreach_angles?.length ? `\nOUTREACH ANGLES: ${company_scrape.outreach_angles.join("; ")}` : "";
    return `You are a business development executive at OneDigital (employee benefits advisory).

Write a follow-up email (3-6 sentences) for Week ${week} of a 12-week cadence.

THEME: ${theme}
LEAD: ${company_name}, ${industry_label || "General"} (${industry_key || "general_exec"}), ${sizeRange}, ${location || "US"}
PERSONA: ${persona}${notesLine}${companyIntel}${angles}
${referenceSignals ? `SIGNALS (reference naturally): ${JSON.stringify(signals)}` : ""}

STRUCTURE:
1. **Short persona line**: ${personaFrame}
2. **One industry sentence**: ${industryFrame}
3. **Theme content**: Stay on theme "${theme}"
${referenceSignals ? "4. **Signal reference**: Briefly callback to the signal from Week 1" : ""}
5. **Soft CTA** appropriate for week ${week}

RULES:
- Address as ${firstName}
- Tone: **Crisp Consultative** — concise, direct, no fluff
- No high-pressure language
- Sign off with exactly "Best," on its own line. Do NOT include a name after "Best,"

OUTPUT FORMAT (JSON):
{"subject": "...", "body": "..."}`;
  }

  if (channel === "linkedin") {
    return `Write a LinkedIn message (under 300 characters) for Week ${week}:
Theme: ${theme}
Company: ${company_name}, ${industry_label || "General"}
Persona: ${persona} — ${personaFrame}
${referenceSignals ? `Signals: ${JSON.stringify(signals)}` : ""}
Tone: consultative, brief

OUTPUT FORMAT (JSON):
{"body": "..."}`;
  }

  // phone
  return `Create a Phone Touch for Week ${week}:
Theme: ${theme}
Company: ${company_name}, ${industry_label || "General"}, ${sizeRange}
Persona: ${persona} — ${personaFrame}
Industry context: ${industryFrame}
${referenceSignals ? `Signals: ${JSON.stringify(signals)}` : ""}

Provide 3-5 talking points and a voicemail micro-script (under 20 seconds).
Tone: consultative, theme-focused.

OUTPUT FORMAT (JSON):
{"body": "Talking Points:\\n- ...\\n\\nVoicemail Script:\\n..."}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { week, channel, lead_data, account_id, contact_id } = await req.json();

    if (!week || !channel || !lead_data) {
      return new Response(JSON.stringify({ error: "Missing week, channel, or lead_data" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = week === 1
      ? buildWeek1Prompt(channel, lead_data)
      : buildDripPrompt(week, channel, lead_data);

    // Use Lovable AI — no API key needed
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify(generateFallback(week, channel, lead_data)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.lovable.dev/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a business development copywriter. Always respond with valid JSON only. No markdown, no backticks." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", await aiResponse.text());
      return new Response(JSON.stringify(generateFallback(week, channel, lead_data)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      parsed = generateFallback(week, channel, lead_data);
    }

    // Save snapshot
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("message_snapshots").insert({
      lead_queue_id: lead_data.lead_queue_id || null,
      account_id: account_id || null,
      contact_id: contact_id || null,
      week_number: week,
      channel,
      persona: lead_data.persona || null,
      industry_key: lead_data.industry_key || null,
      subject: parsed.subject || null,
      body: parsed.body || "",
      tokens_used: { company_name: lead_data.company_name, persona: lead_data.persona, signals: lead_data.signals },
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-drip error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateFallback(week: number, channel: string, data: any): { subject?: string; body: string } {
  const name = data.company_name || "your company";
  const firstName = data.contact?.first_name || "there";
  const theme = WEEK_THEMES[week] || "Follow-up";
  const persona = data.persona || "ExecGeneral";
  const industryLabel = data.industry_label || "mid-market";

  // Pick strongest signal for fallback too
  const strongest = pickStrongestSignal(data.signals);

  if (channel === "email") {
    if (week === 1) {
      return {
        subject: `${strongest.label} — quick thought for ${name}`,
        body: `Hi ${firstName},\n\nI noticed ${name}'s ${strongest.label}. Companies at this stage often find that a fresh look at their employee benefits strategy can unlock meaningful savings while improving the employee experience.\n\nAt OneDigital, we work with ${industryLabel} organizations like yours to align benefits with business goals — especially during periods of growth or transition.\n\nWould you have 10-15 minutes next week for a brief conversation?\n\nBest,`,
      };
    }
    return {
      subject: `${theme} — ${name}`,
      body: `Hi ${firstName},\n\nFollowing up on my earlier note. This week I wanted to share a perspective on ${theme.toLowerCase()}.\n\nMany ${industryLabel} companies we work with are finding new ways to optimize here. Happy to share what's working.\n\nLet me know if you'd like to connect briefly.\n\nBest,`,
    };
  }

  if (channel === "linkedin") {
    if (week === 1) {
      return { body: `Hi ${firstName} — noticed ${name}'s ${strongest.label}. I work with similar ${industryLabel} firms on benefits strategy. Would love to connect!` };
    }
    return { body: `Hi ${firstName} — wanted to share a quick thought on ${theme.toLowerCase()} that might be relevant for ${name}. Happy to chat if helpful!` };
  }

  // phone
  return {
    body: `Talking Points:\n- Introduce yourself and OneDigital\n- Reference ${name}'s ${strongest.label}\n- Ask about their current benefits approach\n- Mention relevant ${theme.toLowerCase()} angle\n- Suggest a 10-minute follow-up\n\nVoicemail Script:\nHi ${firstName}, this is [Your Name] from OneDigital. I'm reaching out because I work with ${industryLabel} companies like ${name} on employee benefits strategy. I'd love to share a quick insight — would you have 10 minutes this week? My number is [your number]. Thanks!`,
  };
}
