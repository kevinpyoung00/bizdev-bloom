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

function buildWeek1Prompt(channel: string, data: any): string {
  const { company_name, industry_label, hq_city, hq_state, employee_count, persona, signals, contact, reach } = data;

  // Determine strongest signal
  let signalOpener = "";
  if (signals?.funding?.days_ago && signals.funding.days_ago <= 90)
    signalOpener = `recent funding round (${signals.funding.stage || "growth capital"})`;
  else if (signals?.hr_change?.days_ago && signals.hr_change.days_ago <= 60)
    signalOpener = `recent ${signals.hr_change.title || "HR leadership"} change`;
  else if (signals?.hiring?.jobs_60d && signals.hiring.jobs_60d >= 3)
    signalOpener = `aggressive hiring (${signals.hiring.jobs_60d} roles in 60 days)`;
  else if (signals?.csuite?.days_ago && signals.csuite.days_ago <= 90)
    signalOpener = `recent ${signals.csuite.role || "leadership"} transition`;
  else
    signalOpener = `growth trajectory in ${industry_label || "your industry"}`;

  const location = [hq_city, hq_state].filter(Boolean).join(", ");
  const sizeRange = employee_count ? `${employee_count}-employee` : "mid-market";
  const firstName = contact?.first_name || "there";

  if (channel === "email") {
    return `You are a business development executive at OneDigital, a top employee benefits advisory firm.

Write a personalized cold email (4-6 sentences) for Week 1 of a 12-week outreach cadence.

LEAD CONTEXT:
- Company: ${company_name}
- Industry: ${industry_label || "General"}
- Location: ${location || "US"}
- Size: ${sizeRange}
- Persona Target: ${persona}
- Key Signal: ${signalOpener}

RULES:
- Open with the signal: "${signalOpener}"
- Add a persona-appropriate framing sentence for ${persona}
- Add industry context if available
- Include a benefits strategy insight appropriate for ${sizeRange} companies
- Add OneDigital authority line with regional relevance${location ? ` (${location})` : ""}
- End with soft CTA: "10-15 minutes next week"
- Subject line must reference the signal
- Do NOT use high-pressure sales language
- Tone: **Crisp Consultative** — concise, direct, cost-containment focused. No fluff.
- Address the recipient as ${firstName}
- Sign off with exactly "Best," on its own line. Do NOT include a name after "Best,"

OUTPUT FORMAT (JSON):
{"subject": "...", "body": "..."}`;
  }

  if (channel === "linkedin") {
    return `Write a LinkedIn connection request note (under 300 characters) for:
- Company: ${company_name}, ${industry_label || "General"}
- Signal: ${signalOpener}
- Persona: ${persona}
- Tone: consultative, friendly, not salesy
- Mention the signal briefly, suggest mutual value

OUTPUT FORMAT (JSON):
{"body": "..."}`;
  }

  // phone
  return `Create a Phone Touch for a first outreach call:
- Company: ${company_name}, ${industry_label || "General"}, ${sizeRange}
- Signal: ${signalOpener}
- Persona: ${persona}
- Location: ${location || "US"}

Provide:
1. 3-5 talking points (bullet format)
2. A voicemail micro-script (under 20 seconds when spoken)

Tone: consultative, not pushy. Focus on benefits strategy and the signal.

OUTPUT FORMAT (JSON):
{"body": "Talking Points:\\n- ...\\n\\nVoicemail Script:\\n..."}`;
}

function buildDripPrompt(week: number, channel: string, data: any): string {
  const { company_name, industry_label, persona, signals, hq_city, hq_state, employee_count, contact } = data;
  const theme = WEEK_THEMES[week] || "Follow-up";
  const location = [hq_city, hq_state].filter(Boolean).join(", ");
  const sizeRange = employee_count ? `${employee_count}-employee` : "mid-market";
  const firstName = contact?.first_name || "there";
  const hasSignals = signals && (signals.funding || signals.hiring || signals.hr_change || signals.csuite);

  if (channel === "email") {
    return `You are a business development executive at OneDigital (employee benefits advisory).

Write a follow-up email (3-6 sentences) for Week ${week} of a 12-week cadence.

THEME: ${theme}
LEAD: ${company_name}, ${industry_label || "General"}, ${sizeRange}, ${location || "US"}
PERSONA: ${persona}
${hasSignals && week <= 3 ? `SIGNALS: ${JSON.stringify(signals)}` : ""}

RULES:
- Stay on theme: "${theme}"
- Persona (${persona}) influences vocabulary and framing
- Industry influences examples${hasSignals && week <= 3 ? "\n- Reference signals if relevant" : ""}
- Soft CTA appropriate for week ${week}
- Address as ${firstName}
- Tone: **Crisp Consultative** — concise, direct, no fluff
- No high-pressure language
- Sign off with exactly "Best," on its own line. Do NOT include a name after "Best,"
- After the body, add a line break and then "Further reading: [relevant resource title] — [url]" if the theme suggests a resource${week >= 2 ? `\n- Theme "${theme}" may pair with a guide, checklist, benchmark, or case study` : ""}

OUTPUT FORMAT (JSON):
{"subject": "...", "body": "..."}`;
  }

  if (channel === "linkedin") {
    return `Write a LinkedIn message (under 300 characters) for Week ${week}:
Theme: ${theme}
Company: ${company_name}, Persona: ${persona}
Tone: consultative, brief

OUTPUT FORMAT (JSON):
{"body": "..."}`;
  }

  // phone
  return `Create a Phone Touch for Week ${week}:
Theme: ${theme}
Company: ${company_name}, ${industry_label || "General"}, ${sizeRange}
Persona: ${persona}

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

    // Use Lovable AI (Gemini) - no API key needed
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      // Fallback: return template-based content
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
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a business development copywriter. Always respond with valid JSON only. No markdown, no backticks." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
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
      // Try to extract JSON from the response
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
      tokens_used: { company_name: lead_data.company_name, persona: lead_data.persona },
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

  if (channel === "email") {
    if (week === 1) {
      return {
        subject: `Quick question about ${name}'s benefits strategy`,
        body: `Hi ${firstName},\n\nI noticed ${name} has been making some exciting moves recently. Companies at your stage often find that a fresh look at their employee benefits strategy can unlock meaningful savings while improving the employee experience.\n\nAt OneDigital, we work with organizations like yours to align benefits with business goals — especially during periods of growth or transition.\n\nWould you have 10-15 minutes next week for a brief conversation?\n\nBest,`,
      };
    }
    return {
      subject: `${theme} — ${name}`,
      body: `Hi ${firstName},\n\nFollowing up on my earlier note. This week I wanted to share a perspective on ${theme.toLowerCase()}.\n\nMany ${data.industry_label || "mid-market"} companies we work with are finding new ways to optimize here. Happy to share what's working.\n\nLet me know if you'd like to connect briefly.\n\nBest,`,
    };
  }

  if (channel === "linkedin") {
    if (week === 1) {
      return { body: `Hi ${firstName} — noticed ${name}'s recent growth. I work with similar ${data.industry_label || "companies"} on benefits strategy. Would love to connect!` };
    }
    return { body: `Hi ${firstName} — wanted to share a quick thought on ${theme.toLowerCase()} that might be relevant for ${name}. Happy to chat if helpful!` };
  }

  // phone
  return {
    body: `Talking Points:\n- Introduce yourself and OneDigital\n- Reference ${name}'s recent activity\n- Ask about their current benefits approach\n- Mention relevant ${theme.toLowerCase()} angle\n- Suggest a 10-minute follow-up\n\nVoicemail Script:\nHi ${firstName}, this is [Your Name] from OneDigital. I'm reaching out because I work with ${data.industry_label || "companies"} like ${name} on employee benefits strategy. I'd love to share a quick insight — would you have 10 minutes this week? My number is [your number]. Thanks!`,
  };
}
