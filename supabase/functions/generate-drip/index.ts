import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEEK_THEMES: Record<number, string> = {
  1: "Signal Moment Intro - lead with strongest timing signal",
  2: "Primary Persona Pain - role-aligned pain with outcome we drive",
  3: "Resource Share - 1 line of context + 1 relevant resource",
  4: "Industry Insight - trend or benchmark that matters to them",
  5: "Renewal Strategy - planning for 12/24/36 months, risk mitigation",
  6: "Employee Experience - retention, recruiting quality, culture impact",
  7: "Cost Containment - cost optimization without eroding experience",
  8: "HR Tech Alignment - benefits + HRIS/ATS/ben-admin fit for their stage",
  9: "Compliance Focus - upcoming or recent compliance changes in their industry/state",
  10: "Case Study - short proof tailored by industry/size with 1 outcome metric",
  11: "Short Nudge - very brief check-in referencing prior touch or value",
  12: "Breakup - polite permission-based close, offer resource, ask timing/preference",
};

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
    return { label: `aggressive hiring: ${signals.hiring.jobs_60d} roles in 60 days (Large intensity)`, type: "hiring_large" };
  if (signals?.hiring?.jobs_60d != null && signals.hiring.jobs_60d >= 6)
    return { label: `notable hiring: ${signals.hiring.jobs_60d} roles in 60 days (Medium intensity)`, type: "hiring_medium" };
  if (signals?.hiring?.jobs_60d != null && signals.hiring.jobs_60d >= 3)
    return { label: `active hiring: ${signals.hiring.jobs_60d} roles in 60 days`, type: "hiring_small" };
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

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ── Enrichment step ── */

async function enrichBeforeGenerate(
  supabase: any,
  accountId: string | null,
  contactId: string | null,
  leadData: any
): Promise<any> {
  const enriched = { ...leadData };

  // 1) Load fresh account data from DB if we have an account_id
  if (accountId) {
    const { data: account } = await supabase.from("accounts").select("*").eq("id", accountId).single();
    if (account) {
      enriched.company_name = enriched.company_name || account.name;
      enriched.domain = account.domain || account.website || enriched.domain;
      enriched.hq_city = account.hq_city || enriched.hq_city;
      enriched.hq_state = account.hq_state || enriched.hq_state;
      enriched.employee_count = account.employee_count || enriched.employee_count;
      enriched.industry_key = enriched.industry_key || account.industry || "general_exec";
      enriched.revenue_range = account.revenue_range || enriched.revenue_range;

      // Merge account-level triggers
      const dbTriggers = account.triggers || {};
      enriched.signals = enriched.signals || {};
      if (dbTriggers.funding && !enriched.signals.funding) {
        enriched.signals.funding = { stage: dbTriggers.funding.stage, days_ago: (dbTriggers.funding.months_ago || 12) * 30 };
      }
      if (dbTriggers.recent_role_changes && !enriched.signals.hr_change) {
        const rc = Array.isArray(dbTriggers.recent_role_changes) ? dbTriggers.recent_role_changes[0] : dbTriggers.recent_role_changes;
        enriched.signals.hr_change = { title: rc?.title, days_ago: rc?.days_ago };
      }
      if ((dbTriggers.open_roles_60d || dbTriggers.hiring_velocity) && !enriched.signals.hiring) {
        enriched.signals.hiring = { jobs_60d: dbTriggers.open_roles_60d || dbTriggers.hiring_velocity };
      }

      // Company scrape / website intel
      if (!enriched.company_scrape) {
        // Try to run company-scrape if we have a domain but no intel
        const domain = account.domain || account.website;
        if (domain) {
          try {
            console.log(`[generate-drip] Running company-scrape for ${domain}`);
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const scrapeResp = await fetch(`${supabaseUrl}/functions/v1/company-scrape`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ website: domain }),
            });
            if (scrapeResp.ok) {
              const scrapeData = await scrapeResp.json();
              if (scrapeData?.success) {
                enriched.company_scrape = {
                  summary: scrapeData.summary,
                  key_facts: scrapeData.key_facts || [],
                  outreach_angles: scrapeData.outreach_angles || [],
                  pain_points: scrapeData.pain_points || [],
                };
                console.log("[generate-drip] Company scrape enrichment successful");
              }
            }
          } catch (err) {
            console.warn("[generate-drip] Company scrape failed (non-blocking):", err);
          }
        }
      }
    }
  }

  // 2) Load fresh contact data from DB
  if (contactId) {
    const { data: contact } = await supabase.from("contacts_le").select("*").eq("id", contactId).single();
    if (contact) {
      enriched.contact = {
        first_name: contact.first_name,
        last_name: contact.last_name,
        title: contact.title,
        email: contact.email,
        phone: contact.phone,
        linkedin_url: contact.linkedin_url,
        department: contact.department,
        seniority: contact.seniority,
        location: contact.location,
      };
    }
  }

  return enriched;
}

/* ── Voice & style preamble ── */

const VOICE_RULES = `VOICE & STYLE GUARDRAILS (MANDATORY):
- Direct, professional, friendly
- NEVER use em dashes (use commas, periods, or semicolons instead)
- No hype or fluff
- 1 clear CTA per message
- Do NOT disclose enrichment or data sourcing
- The sender is Kevin Young at OneDigital
- Tone: Crisp Consultative - concise, direct, cost-containment focused`;

/* ── Week 1 prompt builder ── */

function buildWeek1Prompt(channel: string, data: any): string {
  const { company_name, industry_label, industry_key, hq_city, hq_state, employee_count, persona, signals, contact, manual_notes_for_ai, current_carrier, company_scrape, domain, revenue_range } = data;

  const strongest = pickStrongestSignal(signals);
  const location = [hq_city, hq_state].filter(Boolean).join(", ");
  const sizeRange = employee_count ? `${employee_count}-employee` : "mid-market";
  const firstName = contact?.first_name || "there";
  const lastName = contact?.last_name || "";
  const contactTitle = contact?.title || "";
  const personaFrame = PERSONA_FRAMING[persona] || PERSONA_FRAMING.ExecGeneral;
  const industryFrame = INDUSTRY_CONTEXT[industry_key] || INDUSTRY_CONTEXT.general_exec;

  const variantSeed = simpleHash(`${company_name || ""}${firstName}${persona}`);
  const variantNote = `Select micro-variant ${(variantSeed % 3) + 1} of 3: vary the opening hook phrasing and CTA wording slightly so similar leads receive distinct messages.`;

  // Build enrichment context block
  const enrichmentBlock = buildEnrichmentBlock(data);

  if (channel === "email") {
    return `You are Kevin Young, a business development executive at OneDigital, a top employee benefits advisory firm.

Write a personalized cold email for Week 1 of a 12-week outreach cadence. Under 120 words.

CONTACT:
- Name: ${firstName} ${lastName}
- Title: ${contactTitle}
- Company: ${company_name}
${enrichmentBlock}

LEAD CONTEXT:
- Industry: ${industry_label || "General"} (key: ${industry_key || "general_exec"})
- Location: ${location || "US"}
- Size: ${sizeRange}${revenue_range ? `\n- Revenue: ${revenue_range}` : ""}
- Persona: ${persona}
- Strongest Signal: ${strongest.label} (type: ${strongest.type})
- All Signals: ${JSON.stringify(signals || {})}

STRUCTURE:
1. Signal-anchored opener: Lead with "${strongest.label}" as the first sentence hook
2. Persona paragraph: ${personaFrame}
3. Industry sentence: ${industryFrame}
4. OneDigital authority: Brief regional relevance${location ? ` (${location})` : ""}
5. Soft CTA: "10-15 minutes next week" or similar low-pressure ask
6. Respectful opt-out line

${VOICE_RULES}

ADDITIONAL RULES:
- ${variantNote}
- Subject line must reference the signal, be personalized and succinct
- Address the recipient as ${firstName}
- Sign off with exactly "Best," on its own line. Do NOT include a name after "Best,"
- Keep to 3-6 sentences in the body (under 120 words)

OUTPUT FORMAT (JSON only, no markdown):
{"subject": "...", "body": "..."}`;
  }

  if (channel === "linkedin") {
    return `You are Kevin Young at OneDigital. Write a LinkedIn connection request note (2-3 sentences, under 300 characters).

CONTACT: ${firstName} ${lastName}, ${contactTitle} at ${company_name}
${enrichmentBlock}
Signal: ${strongest.label}
Persona: ${persona} - ${personaFrame}
Industry: ${industry_label || "General"}

RULES:
- Personalize with role + company + 1 insight or signal
- CTA: connect, quick take, or 10-15 min
- ${variantNote}
${VOICE_RULES}

OUTPUT FORMAT (JSON only, no markdown):
{"body": "..."}`;
  }

  // phone
  return `You are Kevin Young at OneDigital. Create a Phone Touch script for a first outreach call.

CONTACT: ${firstName} ${lastName}, ${contactTitle} at ${company_name}
${enrichmentBlock}
Signal: ${strongest.label}
Persona: ${persona} - ${personaFrame}
Industry: ${industry_label || "General"}, ${sizeRange}, ${location || "US"}
${industryFrame}

Provide:
1. 3-5 talking points (bullet format) leading with the signal
2. A voicemail micro-script (under 20 seconds, 2 short lines)

${VOICE_RULES}

OUTPUT FORMAT (JSON only, no markdown):
{"body": "Talking Points:\\n- ...\\n\\nVoicemail Script:\\n..."}`;
}

/* ── Weeks 2-12 prompt builder ── */

function buildDripPrompt(week: number, channel: string, data: any): string {
  const { company_name, industry_label, industry_key, persona, signals, hq_city, hq_state, employee_count, contact, manual_notes_for_ai, company_scrape } = data;
  const theme = WEEK_THEMES[week] || "Follow-up";
  const location = [hq_city, hq_state].filter(Boolean).join(", ");
  const sizeRange = employee_count ? `${employee_count}-employee` : "mid-market";
  const firstName = contact?.first_name || "there";
  const lastName = contact?.last_name || "";
  const contactTitle = contact?.title || "";
  const personaFrame = PERSONA_FRAMING[persona] || PERSONA_FRAMING.ExecGeneral;
  const industryFrame = INDUSTRY_CONTEXT[industry_key] || INDUSTRY_CONTEXT.general_exec;
  const recentSignals = hasRecentSignals(signals);
  const referenceSignals = recentSignals && week <= 3;

  const enrichmentBlock = buildEnrichmentBlock(data);

  if (channel === "email") {
    return `You are Kevin Young, a business development executive at OneDigital (employee benefits advisory).

Write a follow-up email (3-6 sentences, under 120 words) for Week ${week} of a 12-week cadence.

WEEK THEME: ${theme}
CONTACT: ${firstName} ${lastName}, ${contactTitle} at ${company_name}
${enrichmentBlock}
LEAD: ${industry_label || "General"} (${industry_key || "general_exec"}), ${sizeRange}, ${location || "US"}
PERSONA: ${persona}
${referenceSignals ? `SIGNALS (reference naturally): ${JSON.stringify(signals)}` : ""}

STRUCTURE:
1. Short persona line: ${personaFrame}
2. One industry sentence: ${industryFrame}
3. Theme content: Stay on theme "${theme}"
${referenceSignals ? "4. Signal reference: Briefly callback to the signal from Week 1" : ""}
5. Soft CTA appropriate for week ${week}
${week >= 2 ? "6. Respectful opt-out line for email if appropriate" : ""}

${VOICE_RULES}

ADDITIONAL RULES:
- Address as ${firstName}
- Sign off with exactly "Best," on its own line. Do NOT include a name after "Best,"

OUTPUT FORMAT (JSON only, no markdown):
{"subject": "...", "body": "..."}`;
  }

  if (channel === "linkedin") {
    return `You are Kevin Young at OneDigital. Write a LinkedIn message (2-3 sentences, under 300 characters) for Week ${week}.

Theme: ${theme}
Contact: ${firstName} ${lastName}, ${contactTitle} at ${company_name}
${enrichmentBlock}
Persona: ${persona} - ${personaFrame}
${referenceSignals ? `Signals: ${JSON.stringify(signals)}` : ""}

${VOICE_RULES}

OUTPUT FORMAT (JSON only, no markdown):
{"body": "..."}`;
  }

  // phone
  return `You are Kevin Young at OneDigital. Create a Phone Touch for Week ${week}.

Theme: ${theme}
Contact: ${firstName} ${lastName}, ${contactTitle} at ${company_name}
${enrichmentBlock}
Persona: ${persona} - ${personaFrame}
Industry: ${industryFrame}
${referenceSignals ? `Signals: ${JSON.stringify(signals)}` : ""}

Provide 3-5 talking points and a voicemail micro-script (under 20 seconds, 2 short lines).

${VOICE_RULES}

OUTPUT FORMAT (JSON only, no markdown):
{"body": "Talking Points:\\n- ...\\n\\nVoicemail Script:\\n..."}`;
}

/* ── Build enrichment context block for prompts ── */

function buildEnrichmentBlock(data: any): string {
  const lines: string[] = [];
  const { company_scrape, manual_notes_for_ai, current_carrier, domain, contact } = data;

  if (domain) lines.push(`- Domain: ${domain}`);
  if (current_carrier) lines.push(`- Current benefits carrier: ${current_carrier}`);
  if (contact?.title) lines.push(`- Contact role: ${contact.title}`);
  if (contact?.department) lines.push(`- Department: ${contact.department}`);
  if (contact?.seniority) lines.push(`- Seniority: ${contact.seniority}`);
  if (contact?.location) lines.push(`- Contact location: ${contact.location}`);

  if (company_scrape?.summary) lines.push(`- Company Intel: ${company_scrape.summary}`);
  if (company_scrape?.outreach_angles?.length) lines.push(`- Outreach Angles: ${company_scrape.outreach_angles.join("; ")}`);
  if (company_scrape?.pain_points?.length) lines.push(`- Pain Points: ${company_scrape.pain_points.join("; ")}`);
  if (company_scrape?.key_facts?.length) lines.push(`- Key Facts: ${company_scrape.key_facts.join("; ")}`);

  if (manual_notes_for_ai) lines.push(`- Custom Context (weave naturally, one sentence max): "${manual_notes_for_ai}"`);

  if (lines.length === 0) return "";
  return "\nENRICHMENT DATA:\n" + lines.join("\n");
}

/* ── Main handler ── */

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── ENRICHMENT STEP (mandatory) ──
    console.log(`[generate-drip] Enriching before generation: account=${account_id}, contact=${contact_id}, week=${week}, channel=${channel}`);
    const enrichedData = await enrichBeforeGenerate(supabase, account_id || null, contact_id || null, lead_data);
    console.log(`[generate-drip] Enrichment complete. Company: ${enrichedData.company_name}, Persona: ${enrichedData.persona}, Has scrape: ${!!enrichedData.company_scrape}`);

    const prompt = week === 1
      ? buildWeek1Prompt(channel, enrichedData)
      : buildDripPrompt(week, channel, enrichedData);

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify(generateFallback(week, channel, enrichedData)), {
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
          { role: "system", content: "You are a business development copywriter for Kevin Young at OneDigital. Always respond with valid JSON only. No markdown, no backticks. Never use em dashes." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", await aiResponse.text());
      return new Response(JSON.stringify(generateFallback(week, channel, enrichedData)), {
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
      parsed = generateFallback(week, channel, enrichedData);
    }

    // Save snapshot
    await supabase.from("message_snapshots").insert({
      lead_queue_id: enrichedData.lead_queue_id || null,
      account_id: account_id || null,
      contact_id: contact_id || null,
      week_number: week,
      channel,
      persona: enrichedData.persona || null,
      industry_key: enrichedData.industry_key || null,
      subject: parsed.subject || null,
      body: parsed.body || "",
      tokens_used: {
        company_name: enrichedData.company_name,
        persona: enrichedData.persona,
        signals: enrichedData.signals,
        enriched: true,
        has_company_scrape: !!enrichedData.company_scrape,
      },
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
  const industryLabel = data.industry_label || "mid-market";
  const strongest = pickStrongestSignal(data.signals);

  if (channel === "email") {
    if (week === 1) {
      return {
        subject: `${strongest.label}: quick thought for ${name}`,
        body: `Hi ${firstName},\n\nI noticed ${name}'s ${strongest.label}. Companies at this stage often find that a fresh look at their employee benefits strategy can unlock meaningful savings while improving the employee experience.\n\nAt OneDigital, we work with ${industryLabel} organizations like yours to align benefits with business goals, especially during periods of growth or transition.\n\nWould you have 10-15 minutes next week for a brief conversation?\n\nBest,`,
      };
    }
    return {
      subject: `${theme} for ${name}`,
      body: `Hi ${firstName},\n\nFollowing up on my earlier note. This week I wanted to share a perspective on ${theme.toLowerCase()}.\n\nMany ${industryLabel} companies we work with are finding new ways to optimize here. Happy to share what's working.\n\nLet me know if you'd like to connect briefly.\n\nBest,`,
    };
  }

  if (channel === "linkedin") {
    if (week === 1) {
      return { body: `Hi ${firstName}, noticed ${name}'s ${strongest.label}. I work with similar ${industryLabel} firms on benefits strategy. Would love to connect!` };
    }
    return { body: `Hi ${firstName}, wanted to share a quick thought on ${theme.toLowerCase()} that might be relevant for ${name}. Happy to chat if helpful!` };
  }

  return {
    body: `Talking Points:\n- Introduce yourself: Kevin Young, OneDigital\n- Reference ${name}'s ${strongest.label}\n- Ask about their current benefits approach\n- Mention relevant ${theme.toLowerCase()} angle\n- Suggest a 10-minute follow-up\n\nVoicemail Script:\nHi ${firstName}, this is Kevin Young from OneDigital. I'm reaching out because I work with ${industryLabel} companies like ${name} on employee benefits strategy. I'd love to share a quick insight. Would you have 10 minutes this week? My number is [your number]. Thanks!`,
  };
}
