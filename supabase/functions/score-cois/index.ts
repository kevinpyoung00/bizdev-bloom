import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── COI Category Weights ───
const PRIMARY_CATEGORIES: Record<string, number> = {
  "accountant": 40,
  "advisory": 40,
  "accounting": 40,
  "m&a attorney": 38,
  "legal advisor": 38,
  "attorney": 35,
  "investment banker": 36,
  "m&a advisor": 36,
};

const SECONDARY_CATEGORIES: Record<string, number> = {
  "executive search": 28,
  "hr tech": 26,
  "actuarial": 24,
  "benefits attorney": 24,
  "regional bank": 22,
  "peer group": 20,
  "recruiter": 20,
};

function scoreCategoryRelevance(firmType: string | null): number {
  if (!firmType) return 10;
  const lower = firmType.toLowerCase();
  for (const [key, score] of Object.entries(PRIMARY_CATEGORIES)) {
    if (lower.includes(key)) return score;
  }
  for (const [key, score] of Object.entries(SECONDARY_CATEGORIES)) {
    if (lower.includes(key)) return score;
  }
  return 15;
}

function scoreRegion(region: string | null): number {
  if (!region) return 0;
  const r = region.toUpperCase();
  if (r.includes("MA") || r.includes("MASSACHUSETTS") || r.includes("BOSTON")) return 35 + 10; // activity + geo bonus
  if (["NH", "ME", "RI", "CT", "VT", "NEW ENGLAND"].some(s => r.includes(s))) return 30 + 5; // activity + geo bonus
  return 15;
}

function scoreContactability(coi: any, contacts: any[]): number {
  if (!contacts || contacts.length === 0) return 2;
  const best = contacts[0];
  let score = 2;
  if (best.email) score += 3;
  if (best.phone) score += 2;
  if (best.linkedin_url) score += 2;
  if (best.title) score += 1;
  return Math.min(10, score);
}

function scoreWarmth(): number {
  // Placeholder — future: mutual connections, referrals
  return 8;
}

interface ScoredCOI {
  id: string;
  name: string;
  firm_type: string | null;
  website: string | null;
  region: string | null;
  notes: string | null;
  score: number;
  reason: {
    category_relevance: number;
    regional_activity: number;
    warmth: number;
    contactability: number;
  };
  best_contact: {
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let dryRun = false;
    let runDate = new Date().toISOString().split("T")[0];

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.dry_run) dryRun = true;
        if (body.run_date) runDate = body.run_date;
      } catch { /* no body */ }
    }

    // Check existing
    if (!dryRun) {
      const { data: existing } = await supabase
        .from("coi_queue")
        .select("id")
        .eq("run_date", runDate)
        .limit(1);
      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ success: false, message: `COI queue already generated for ${runDate}.` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }
    }

    // Load all COIs with contacts
    const { data: cois, error: coisErr } = await supabase
      .from("cois")
      .select("*");
    if (coisErr) throw coisErr;

    if (!cois || cois.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No COIs to score.", cois: [], stats: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load all COI contacts grouped by coi_id
    const { data: allContacts } = await supabase.from("coi_contacts").select("*");
    const contactsByCoi: Record<string, any[]> = {};
    for (const c of allContacts || []) {
      if (!contactsByCoi[c.coi_id]) contactsByCoi[c.coi_id] = [];
      contactsByCoi[c.coi_id].push(c);
    }

    // Score all COIs
    const scored: ScoredCOI[] = cois.map((coi) => {
      const contacts = contactsByCoi[coi.id] || [];
      const category_relevance = scoreCategoryRelevance(coi.firm_type);
      const regional_activity = scoreRegion(coi.region);
      const warmth = scoreWarmth();
      const contactability = scoreContactability(coi, contacts);

      const score = Math.min(100, category_relevance + regional_activity + warmth + contactability);

      const bestContact = contacts.length > 0
        ? {
            name: `${contacts[0].first_name} ${contacts[0].last_name}`,
            title: contacts[0].title,
            email: contacts[0].email,
            phone: contacts[0].phone,
            linkedin_url: contacts[0].linkedin_url,
          }
        : null;

      return {
        id: coi.id,
        name: coi.name,
        firm_type: coi.firm_type,
        website: coi.website,
        region: coi.region,
        notes: coi.notes,
        score,
        reason: { category_relevance, regional_activity, warmth, contactability },
        best_contact: bestContact,
      };
    });

    // Sort by score desc, then MA preference
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aMA = (a.region || "").toUpperCase().includes("MA") ? 1 : 0;
      const bMA = (b.region || "").toUpperCase().includes("MA") ? 1 : 0;
      return bMA - aMA;
    });

    const top5 = scored.slice(0, 5);

    // Write to coi_queue
    if (!dryRun && top5.length > 0) {
      const rows = top5.map((c, i) => ({
        coi_id: c.id,
        run_date: runDate,
        priority_rank: i + 1,
        score: c.score,
        reason: c.reason,
        status: "pending",
      }));

      const { error: insertErr } = await supabase.from("coi_queue").insert(rows);
      if (insertErr) throw insertErr;

      await supabase.from("audit_log").insert({
        actor: "system",
        action: "daily_coi_run",
        entity_type: "coi_queue",
        details: { run_date: runDate, total: top5.length },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        run_date: runDate,
        stats: { total: top5.length, total_candidates: scored.length },
        cois: top5.map((c, i) => ({
          rank: i + 1,
          score: c.score,
          name: c.name,
          firm_type: c.firm_type,
          region: c.region,
          best_contact: c.best_contact,
          reasons: c.reason,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Score COIs error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
