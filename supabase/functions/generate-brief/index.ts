import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account_id } = await req.json();
    if (!account_id) throw new Error("account_id is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch account + contacts
    const { data: account, error: accErr } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", account_id)
      .single();
    if (accErr) throw accErr;

    const { data: contacts } = await supabase
      .from("contacts_le")
      .select("*")
      .eq("account_id", account_id);

    const { data: leadEntry } = await supabase
      .from("lead_queue")
      .select("score, reason, priority_rank")
      .eq("account_id", account_id)
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const triggers = account.triggers || {};
    const contactList = (contacts || [])
      .map((c: any) => `- ${c.first_name} ${c.last_name}, ${c.title || "N/A"} (${c.department || "N/A"})${c.is_primary ? " [Best Fit]" : ""}`)
      .join("\n");

    const prompt = `You are an expert B2B sales strategist for OneDigital, an employee benefits advisory firm. Generate a concise 1-page account brief in Markdown for the following prospect.

## Account Data
- **Company**: ${account.name}
- **Industry**: ${account.industry || "Unknown"} / ${account.sub_industry || "N/A"}
- **Employees**: ${account.employee_count || "Unknown"}
- **HQ**: ${account.hq_city || "?"}, ${account.hq_state || "?"}
- **Geography Bucket**: ${account.geography_bucket || "Unknown"}
- **Domain**: ${account.domain || "N/A"}
- **Revenue Range**: ${account.revenue_range || "Unknown"}
- **Lead Score**: ${leadEntry?.score ?? "N/A"} / 100 (Rank #${leadEntry?.priority_rank ?? "N/A"})

## Triggers
${JSON.stringify(triggers, null, 2)}

## Contacts
${contactList || "None imported yet."}

## Instructions
Write a brief with these sections:
1. **Executive Summary** — 2-3 sentences on why this account is worth pursuing now.
2. **Company Snapshot** — Key firmographics, what they likely care about.
3. **Trigger Analysis** — What signals make them timely. Reference hiring velocity, C-suite changes, funding if present.
4. **Recommended Approach** — Which contact to lead with, what angle (benefits review, compliance, cost optimization), and suggested first touch (email vs LinkedIn).
5. **Talking Points** — 3-4 bullet points Kevin can use in outreach.
6. **Risk / Notes** — Any caveats (e.g., might have incumbent broker, small team).

Keep it actionable and under 400 words.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a B2B sales intelligence assistant. Output clean Markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const txt = await aiResponse.text();
      console.error("AI error:", status, txt);
      throw new Error(`AI gateway error ${status}`);
    }

    const aiData = await aiResponse.json();
    const brief = aiData.choices?.[0]?.message?.content || "";

    // Save to account_briefs
    const { data: saved, error: saveErr } = await supabase
      .from("account_briefs")
      .insert({
        account_id,
        brief_markdown: brief,
        model: "google/gemini-3-flash-preview",
        inputs: { triggers, contacts: contacts?.length ?? 0, score: leadEntry?.score },
      })
      .select()
      .single();
    if (saveErr) console.error("Save error:", saveErr);

    return new Response(JSON.stringify({ brief, id: saved?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
