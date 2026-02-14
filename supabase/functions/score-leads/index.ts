import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── ICP Configuration (defaults) ───
const INDUSTRY_PRIORITY: Record<string, number> = {
  "Healthcare and Social Assistance": 18,
  "Biotech and Life Sciences": 16,
  "Professional, Scientific, and Technical Services": 14,
  "Advanced Manufacturing and Medical Devices": 12,
  "Higher Education and Nonprofits": 10,
};
const INDUSTRY_DEPRIORITIZE = [
  "restaurants",
  "small retail",
  "seasonal staffing",
  "staffing agencies",
];

// Geography
const MA_STATES = ["MA", "Massachusetts"];
const NE_STATES = ["NH", "ME", "RI", "CT", "VT", "New Hampshire", "Maine", "Rhode Island", "Connecticut", "Vermont"];

function normalizeState(s: string | null): string {
  if (!s) return "";
  return s.trim().toUpperCase();
}

function getGeoBucket(state: string): "MA" | "NE" | "US" {
  const s = normalizeState(state);
  if (["MA", "MASSACHUSETTS"].includes(s)) return "MA";
  if (["NH", "ME", "RI", "CT", "VT", "NEW HAMPSHIRE", "MAINE", "RHODE ISLAND", "CONNECTICUT", "VERMONT"].includes(s))
    return "NE";
  return "US";
}

// ─── Scoring Functions ───

function scoreIndustryFit(industry: string | null): number {
  if (!industry) return 0;
  const lower = industry.toLowerCase();
  for (const dep of INDUSTRY_DEPRIORITIZE) {
    if (lower.includes(dep)) return 2;
  }
  for (const [key, score] of Object.entries(INDUSTRY_PRIORITY)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return score;
  }
  // Partial matches
  if (lower.includes("health")) return 14;
  if (lower.includes("biotech") || lower.includes("life sci")) return 14;
  if (lower.includes("professional") || lower.includes("technical") || lower.includes("engineering")) return 12;
  if (lower.includes("manufactur") || lower.includes("medical device")) return 10;
  if (lower.includes("education") || lower.includes("nonprofit")) return 8;
  return 5; // generic industry
}

function scoreSizeFit(empCount: number | null): number {
  if (!empCount || empCount <= 0) return 0;
  // Sweet spot: 50-250
  if (empCount >= 50 && empCount <= 250) return 18;
  if (empCount >= 25 && empCount < 50) return 10; // might get high-growth bonus
  if (empCount > 250 && empCount <= 500) return 14;
  if (empCount > 500 && empCount <= 1000) return 8;
  if (empCount > 1000) return 3;
  return 2; // <25
}

function scoreGeoFit(geoBucket: "MA" | "NE" | "US"): number {
  if (geoBucket === "MA") return 24;
  if (geoBucket === "NE") return 18; // 75% of 24
  return 12; // 50% of 24
}

function scoreHiring(triggers: any): number {
  if (!triggers) return 0;
  const openRoles = triggers.open_roles_60d ?? triggers.hiring_velocity ?? 0;
  if (openRoles >= 10) return 20;
  if (openRoles > 0) return Math.min(15, Math.round((openRoles / 10) * 15));
  return 0;
}

function scoreCsuite(triggers: any): number {
  if (!triggers) return 0;
  const changes = triggers.c_suite_changes ?? triggers.leadership_changes;
  if (!changes) return 0;
  // Check recency
  const monthsAgo = changes.months_ago ?? changes.recency_months ?? null;
  if (monthsAgo !== null && monthsAgo !== undefined) {
    if (monthsAgo <= 3) return 12;
    if (monthsAgo <= 6) return 6;
    return 0;
  }
  // If boolean flag
  if (changes === true || (typeof changes === "object" && Object.keys(changes).length > 0)) return 12;
  return 0;
}

function scoreFunding(triggers: any): number {
  if (!triggers) return 0;
  const funding = triggers.funding ?? triggers.expansion ?? triggers.funding_expansion;
  if (!funding) return 0;
  if (typeof funding === "boolean" && funding) return 8;
  if (typeof funding === "object") {
    const recency = funding.months_ago ?? 12;
    if (recency <= 3) return 8;
    if (recency <= 6) return 6;
    if (recency <= 12) return 4;
    return 2;
  }
  return 4;
}

function computeHighGrowthBonus(empCount: number | null, triggers: any): number {
  if (!empCount || empCount < 25 || empCount > 49) return 0;
  const openRoles = triggers?.open_roles_60d ?? triggers?.hiring_velocity ?? 0;
  return openRoles >= 10 ? 5 : 0;
}

interface ScoredAccount {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employee_count: number | null;
  hq_state: string | null;
  geography_bucket: string;
  triggers: any;
  score: number;
  reasons: {
    industry_fit: number;
    size_fit: number;
    geo_fit: number;
    hiring: number;
    c_suite: number;
    funding: number;
    bonus: number;
    gates: { ne_pass: boolean; us_pass: boolean };
  };
}

function scoreAccount(account: any): ScoredAccount {
  const geoBucket = getGeoBucket(account.hq_state);
  const triggers = account.triggers || {};

  const industry_fit = scoreIndustryFit(account.industry);
  const size_fit = scoreSizeFit(account.employee_count);
  const geo_fit = scoreGeoFit(geoBucket);
  const hiring = scoreHiring(triggers);
  const c_suite = scoreCsuite(triggers);
  const funding = scoreFunding(triggers);
  const bonus = computeHighGrowthBonus(account.employee_count, triggers);

  const rawScore = industry_fit + size_fit + geo_fit + hiring + c_suite + funding + bonus;
  const score = Math.min(100, rawScore);

  return {
    id: account.id,
    name: account.name,
    domain: account.domain,
    industry: account.industry,
    employee_count: account.employee_count,
    hq_state: account.hq_state,
    geography_bucket: geoBucket,
    triggers,
    score,
    reasons: {
      industry_fit,
      size_fit,
      geo_fit,
      hiring,
      c_suite,
      funding,
      bonus,
      gates: {
        ne_pass: geoBucket === "NE" && score >= 85,
        us_pass: geoBucket === "US" && score >= 90,
      },
    },
  };
}

// ─── Selection with geography allocation ───

function selectTop50(scored: ScoredAccount[]): ScoredAccount[] {
  // Sort all by score desc, then employee_count desc, then MA preference, then domain alpha
  const sorted = [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((b.employee_count ?? 0) !== (a.employee_count ?? 0))
      return (b.employee_count ?? 0) - (a.employee_count ?? 0);
    // MA advantage
    const aMA = a.geography_bucket === "MA" ? 1 : 0;
    const bMA = b.geography_bucket === "MA" ? 1 : 0;
    if (bMA !== aMA) return bMA - aMA;
    return (a.domain ?? "").localeCompare(b.domain ?? "");
  });

  const maPool = sorted.filter((a) => a.geography_bucket === "MA");
  const nePool = sorted.filter((a) => a.geography_bucket === "NE" && a.reasons.gates.ne_pass);
  const usPool = sorted.filter((a) => a.geography_bucket === "US" && a.reasons.gates.us_pass);

  const selected: ScoredAccount[] = [];
  const usedIds = new Set<string>();

  // A) Top 45 MA
  for (const a of maPool) {
    if (selected.length >= 45) break;
    selected.push(a);
    usedIds.add(a.id);
  }

  // B) Up to 4 NE with score >= 85
  let neCount = 0;
  for (const a of nePool) {
    if (neCount >= 4) break;
    if (usedIds.has(a.id)) continue;
    selected.push(a);
    usedIds.add(a.id);
    neCount++;
  }

  // C) Up to 1 National with score >= 90
  let usCount = 0;
  for (const a of usPool) {
    if (usCount >= 1) break;
    if (usedIds.has(a.id)) continue;
    selected.push(a);
    usedIds.add(a.id);
    usCount++;
  }

  // D) Backfill with MA if < 50
  if (selected.length < 50) {
    for (const a of maPool) {
      if (selected.length >= 50) break;
      if (usedIds.has(a.id)) continue;
      selected.push(a);
      usedIds.add(a.id);
    }
  }

  // If still < 50, fill with any remaining by score
  if (selected.length < 50) {
    for (const a of sorted) {
      if (selected.length >= 50) break;
      if (usedIds.has(a.id)) continue;
      selected.push(a);
      usedIds.add(a.id);
    }
  }

  // Re-rank
  return selected.slice(0, 50).map((a, i) => ({ ...a, rank: i + 1 }));
}

// ─── Main handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional params
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "true";
    const runDate = url.searchParams.get("run_date") || new Date().toISOString().split("T")[0];

    // Check if already run today
    if (!dryRun) {
      const { data: existing } = await supabase
        .from("lead_queue")
        .select("id")
        .eq("run_date", runDate)
        .limit(1);
      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Lead queue already generated for ${runDate}. Use dry_run=true to preview or delete existing rows first.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }
    }

    // Load all active accounts
    const { data: accounts, error: accountsErr } = await supabase
      .from("accounts")
      .select("*")
      .neq("status", "suppressed");

    if (accountsErr) throw accountsErr;
    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No accounts to score.", leads: [], stats: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Score all accounts
    const scored = accounts.map(scoreAccount);

    // Update icp_score on each account
    if (!dryRun) {
      for (const s of scored) {
        await supabase.from("accounts").update({ icp_score: s.score, geography_bucket: s.geography_bucket }).eq("id", s.id);
      }
    }

    // Select top 50 with geo allocation
    const top50 = selectTop50(scored);

    // Stats
    const maCount = top50.filter((a) => a.geography_bucket === "MA").length;
    const neCount = top50.filter((a) => a.geography_bucket === "NE").length;
    const usCount = top50.filter((a) => a.geography_bucket === "US").length;
    const avgScore = top50.length > 0 ? Math.round(top50.reduce((s, a) => s + a.score, 0) / top50.length) : 0;

    // Write to lead_queue
    if (!dryRun && top50.length > 0) {
      const rows = top50.map((a, i) => ({
        account_id: a.id,
        run_date: runDate,
        priority_rank: i + 1,
        score: a.score,
        reason: a.reasons,
        status: "pending",
      }));

      const { error: insertErr } = await supabase.from("lead_queue").insert(rows);
      if (insertErr) throw insertErr;

      // Audit log
      await supabase.from("audit_log").insert({
        actor: "system",
        action: "daily_lead_run",
        entity_type: "lead_queue",
        details: { run_date: runDate, total: top50.length, ma: maCount, ne: neCount, us: usCount, avg_score: avgScore },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        run_date: runDate,
        stats: { total: top50.length, ma: maCount, ne: neCount, us: usCount, avg_score: avgScore, total_candidates: scored.length },
        leads: top50.map((a, i) => ({
          rank: i + 1,
          score: a.score,
          name: a.name,
          domain: a.domain,
          industry: a.industry,
          employee_count: a.employee_count,
          geography: a.geography_bucket,
          state: a.hq_state,
          reasons: a.reasons,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Score leads error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
