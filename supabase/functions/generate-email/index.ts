import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account_id, contact_id, persona } = await req.json();
    if (!account_id || !persona) throw new Error("account_id and persona are required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: account, error: accErr } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", account_id)
      .single();
    if (accErr) throw accErr;

    // If contact_id provided, use that contact; otherwise pick best fit for persona
    let contact: any = null;
    if (contact_id) {
      const { data } = await supabase.from("contacts_le").select("*").eq("id", contact_id).single();
      contact = data;
    } else {
      const deptFilter = persona === "CFO" ? ["Finance", "Accounting", "Executive"] : ["HR", "Human Resources", "People", "Benefits"];
      const { data: contacts } = await supabase
        .from("contacts_le")
        .select("*")
        .eq("account_id", account_id);
      contact = (contacts || []).find((c: any) =>
        deptFilter.some(d => (c.department || "").toLowerCase().includes(d.toLowerCase()) || (c.title || "").toLowerCase().includes(d.toLowerCase()))
      ) || (contacts || [])[0];
    }

    const triggers = account.triggers || {};
    const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "{FirstName} {LastName}";
    const contactTitle = contact?.title || "{Title}";
    const firstName = contact?.first_name || "{FirstName}";

    const personaInstructions = persona === "CFO"
      ? `Write to a CFO/Finance leader. Focus on cost optimization, renewal savings, plan design ROI, and financial impact of benefits decisions. Tone: data-driven, concise, executive-level.`
      : `Write to an HR/People leader. Focus on employee experience, retention, compliance burden, and benefits administration efficiency. Tone: empathetic, practical, partnership-oriented.`;

    const prompt = `You are Kevin, a senior benefits advisor at OneDigital. Write a personalized cold outreach email.

## Account
- **Company**: ${account.name}
- **Industry**: ${account.industry || "Unknown"}
- **Employees**: ${account.employee_count || "Unknown"}
- **Location**: ${account.hq_city || "?"}, ${account.hq_state || "?"}

## Recipient
- **Name**: ${contactName}
- **Title**: ${contactTitle}

## Triggers
${JSON.stringify(triggers, null, 2)}

## Persona Instructions
${personaInstructions}

## Format
Return JSON with two keys:
- "subject": email subject line (under 60 chars, no quotes)
- "body": the email body in plain text with line breaks

Keep the email under 150 words. Be specific — reference real triggers. Do NOT use generic filler. Sign off as "— Kevin".`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a B2B sales email writer. Always return valid JSON with 'subject' and 'body' keys. No markdown fences." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "draft_email",
              description: "Return a drafted email with subject and body.",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Email subject line" },
                  body: { type: "string", description: "Email body text" },
                },
                required: ["subject", "body"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "draft_email" } },
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
    let subject = "";
    let body = "";

    // Extract from tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      subject = args.subject || "";
      body = args.body || "";
    } else {
      // Fallback: parse from content
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const parsed = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
        subject = parsed.subject || "";
        body = parsed.body || "";
      } catch {
        body = content;
        subject = `Quick note for ${firstName} — Kevin at OneDigital`;
      }
    }

    // Save draft
    const { data: saved, error: saveErr } = await supabase
      .from("email_drafts")
      .insert({
        account_id,
        contact_id: contact?.id || null,
        persona,
        subject,
        body_markdown: body,
        model: "google/gemini-3-flash-preview",
      })
      .select()
      .single();
    if (saveErr) console.error("Save error:", saveErr);

    return new Response(JSON.stringify({ subject, body, id: saved?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
