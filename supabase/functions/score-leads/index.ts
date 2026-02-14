import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── ICP Configuration ───

const INDUSTRY_SCORES: Record<string, number> = {
  "healthcare and social assistance": 20,
  "biotech and life sciences": 18,
  "professional, scientific, and technical services": 16,
  "advanced manufacturing and medical devices": 14,
  "higher education and nonprofits": 12,
};

const INDUSTRY_KEYWORDS: [string, number][] = [
  ["health", 18],
  ["biotech", 17],
  ["life sci", 17],
  ["pharma", 16],
  ["professional", 14],
  ["technical", 14],
  ["engineering", 14],
  ["manufactur", 12],
  ["medical device", 14],
  ["education", 10],
  ["nonprofit", 10],
  ["university", 10],
];

const INDUSTRY_DEPRIORITIZE = [
  "restaurants", "small retail", "seasonal staffing", "staffing agencies",
];

// ─── Geography helpers (gate, not scored) ───

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

// ─── Fit scoring (0–40) ───

function scoreIndustry(industry: string | null): number {
  if (!industry) return 0;
  const lower = industry.toLowerCase();
  for (const dep of INDUSTRY_DEPRIORITIZE) {
    if (lower.includes(dep)) return 2;
  }
  for (const [key, score] of Object.entries(INDUSTRY_SCORES)) {
    if (lower.includes(key) || key.includes(lower)) return score;
  }
  for (const [kw, score] of INDUSTRY_KEYWORDS) {
    if (lower.includes(kw)) return score;
  }
  return 5;
}

function scoreSize(empCount: number | null): number {
  if (!empCount || empCount <= 0) return 0;
  if (empCount >= 50 && empCount <= 250) return 20;
  if (empCount >= 25 && empCount < 50) return 12; // may get growth bonus via hiring
  if (empCount > 250 && empCount <= 500) return 14;
  if (empCount > 500 && empCount <= 1000) return 6;
  if (empCount > 1000) return 2;
  return 2; // <25
}

// ─── Timing scoring (0–60) ───

function scoreHiring(triggers: any): number {
  if (!triggers) return 0;
  const openRoles = triggers.open_roles_60d ?? triggers.hiring_velocity ?? 0;
  if (openRoles >= 10) return 25;
  if (openRoles > 0) return Math.min(20, Math.round((openRoles / 10) * 20));
  return 0;
}

function scoreCsuite(triggers: any): number {
  if (!triggers) return 0;
  const changes = triggers.c_suite_changes ?? triggers.leadership_changes;
  if (!changes) return 0;
  const monthsAgo = changes.months_ago ?? changes.recency_months ?? null;
  if (monthsAgo !== null && monthsAgo !== undefined) {
    if (monthsAgo <= 3) return 20;
    if (monthsAgo <= 6) return 12;
    if (monthsAgo <= 12) return 6;
    return 0;
  }
  if (changes === true || (typeof changes === "object" && Object.keys(changes).length > 0)) return 20;
  return 0;
}

function scoreRecentRoleChange(triggers: any): number {
  if (!triggers) return 0;
  const rc = triggers.recent_role_changes ?? triggers.non_csuite_role_changes;
  if (!rc) return 0;
  // Expect { title, department, days_ago } or array
  const items = Array.isArray(rc) ? rc : [rc];
  const HR_KEYWORDS = ["hr", "human resources", "benefits", "people ops", "people operations", "finance", "controller", "payroll"];
  let best = 0;
  for (const item of items) {
    const title = (item.title || "").toLowerCase();
    const dept = (item.department || "").toLowerCase();
    const combined = `${title} ${dept}`;
    const isRelevant = HR_KEYWORDS.some((kw) => combined.includes(kw));
    if (!isRelevant) continue;
    const daysAgo = item.days_ago ?? 999;
    if (daysAgo <= 14) best = Math.max(best, 10);
    else if (daysAgo <= 30) best = Math.max(best, 7);
    else if (daysAgo <= 60) best = Math.max(best, 4);
  }
  return best;
}

function scoreFunding(triggers: any): number {
  if (!triggers) return 0;
  const funding = triggers.funding ?? triggers.expansion ?? triggers.funding_expansion;
  if (!funding) return 0;
  if (typeof funding === "boolean" && funding) return 5;
  if (typeof funding === "object") {
    const recency = funding.months_ago ?? 12;
    if (recency <= 3) return 5;
    if (recency <= 6) return 4;
    if (recency <= 12) return 3;
    return 1;
  }
  return 3;
}

// ─── Reachability scoring (0–10) ───

function scoreReachability(contacts: any[]): number {
  if (!contacts || contacts.length === 0) return 0;
  let pts = 0;
  const hasEmail = contacts.some((c) => c.email);
  const hasPhone = contacts.some((c) => c.phone);
  const linkedinCount = contacts.filter((c) => c.linkedin_url).length;
  const hasCfoChro = contacts.some((c) => {
    const t = (c.title || "").toLowerCase();
    return t.includes("cfo") || t.includes("chief financial") || t.includes("chro") || t.includes("chief human") || t.includes("vp hr") || t.includes("vp human") || t.includes("head of hr") || t.includes("head of people");
  });
  if (hasEmail) pts += 4;
  if (hasPhone) pts += 2;
  if (linkedinCount >= 2) pts += 2;
  if (hasCfoChro) pts += 2;
  return Math.min(10, pts);
}

// ─── Main scoring ───

interface PriorityReason {
  industry: number;
  size: number;
  hiring: number;
  c_suite: number;
  recent_role_change: number;
  funding: number;
  reachability: number;
  raw: number;
  normalized: number;
  guardrail: string | null;
}

interface ScoredAccount {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employee_count: number | null;
  hq_state: string | null;
  geography_bucket: string;
  disposition: string;
  triggers: any;
  score: number;
  reasons: PriorityReason;
}

function scoreAccount(account: any, contacts: any[]): ScoredAccount {
  const geoBucket = getGeoBucket(account.hq_state);
  const triggers = account.triggers || {};
  const disposition = account.disposition || "active";

  // Guardrails
  let guardrail: string | null = null;
  if (!account.domain) guardrail = "missing_domain";
  if (disposition === "suppressed") guardrail = "suppressed";
  if (disposition?.startsWith("rejected_")) guardrail = `disposition_${disposition}`;

  const industry = guardrail ? 0 : scoreIndustry(account.industry);
  const size = guardrail ? 0 : scoreSize(account.employee_count);
  const hiring = guardrail ? 0 : scoreHiring(triggers);
  const c_suite = guardrail ? 0 : scoreCsuite(triggers);
  const recent_role_change = guardrail ? 0 : scoreRecentRoleChange(triggers);
  const funding = guardrail ? 0 : scoreFunding(triggers);
  const reachability = guardrail ? 0 : scoreReachability(contacts);

  const raw = industry + size + hiring + c_suite + recent_role_change + funding + reachability;
  const normalized = guardrail ? 0 : Math.min(100, Math.round((raw / 110) * 1000) / 10);

  return {
    id: account.id,
    name: account.name,
    domain: account.domain,
    industry: account.industry,
    employee_count: account.employee_count,
    hq_state: account.hq_state,
    geography_bucket: geoBucket,
    disposition,
    triggers,
    score: normalized,
    reasons: { industry, size, hiring, c_suite, recent_role_change, funding, reachability, raw, normalized, guardrail },
  };
}

// ─── Selection with geography gates ───

function selectTop50(scored: ScoredAccount[]): ScoredAccount[] {
  // Only include active and needs_review
  const eligible = scored.filter((a) => a.disposition === "active" || a.disposition === "needs_review");

  // Sort by score desc, tie-breakers: hiring → c_suite recency → reachability → size proximity to 150 → domain A-Z
  const sorted = [...eligible].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.reasons.hiring !== a.reasons.hiring) return b.reasons.hiring - a.reasons.hiring;
    if (b.reasons.c_suite !== a.reasons.c_suite) return b.reasons.c_suite - a.reasons.c_suite;
    if (b.reasons.reachability !== a.reasons.reachability) return b.reasons.reachability - a.reasons.reachability;
    const aDist = Math.abs((a.employee_count ?? 0) - 150);
    const bDist = Math.abs((b.employee_count ?? 0) - 150);
    if (aDist !== bDist) return aDist - bDist;
    return (a.domain ?? "").localeCompare(b.domain ?? "");
  });

  const maPool = sorted.filter((a) => a.geography_bucket === "MA");
  const nePool = sorted.filter((a) => a.geography_bucket === "NE" && a.score >= 85);
  const usPool = sorted.filter((a) => a.geography_bucket === "US" && a.score >= 90);

  const selected: ScoredAccount[] = [];
  const usedIds = new Set<string>();

  // A) Top 45 MA
  for (const a of maPool) {
    if (selected.length >= 45) break;
    selected.push(a);
    usedIds.add(a.id);
  }

  // B) Up to 4 NE with score ≥ 85
  let neCount = 0;
  for (const a of nePool) {
    if (neCount >= 4) break;
    if (usedIds.has(a.id)) continue;
    selected.push(a);
    usedIds.add(a.id);
    neCount++;
  }

  // C) Up to 1 National with score ≥ 90
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

  // E) Fill with any remaining eligible by score
  if (selected.length < 50) {
    for (const a of sorted) {
      if (selected.length >= 50) break;
      if (usedIds.has(a.id)) continue;
      selected.push(a);
      usedIds.add(a.id);
    }
  }

  return selected.slice(0, 50);
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

    const url = new URL(req.url);
    let dryRun = url.searchParams.get("dry_run") === "true";
    let runDate = url.searchParams.get("run_date") || new Date().toISOString().split("T")[0];

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.dry_run) dryRun = true;
        if (body.run_date) runDate = body.run_date;
      } catch { /* no body */ }
    }

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

    // Load all accounts (excluding suppressed via disposition)
    const { data: accounts, error: accountsErr } = await supabase
      .from("accounts")
      .select("*");

    if (accountsErr) throw accountsErr;
    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No accounts to score.", leads: [], stats: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load all contacts for reachability scoring
    const { data: allContacts } = await supabase.from("contacts_le").select("*");
    const contactsByAccount = new Map<string, any[]>();
    for (const c of allContacts || []) {
      if (!c.account_id) continue;
      if (!contactsByAccount.has(c.account_id)) contactsByAccount.set(c.account_id, []);
      contactsByAccount.get(c.account_id)!.push(c);
    }

    // Score all accounts
    const scored = accounts.map((a) => scoreAccount(a, contactsByAccount.get(a.id) || []));

    // Update icp_score on each account
    if (!dryRun) {
      for (const s of scored) {
        await supabase.from("accounts").update({
          icp_score: Math.round(s.score),
          geography_bucket: s.geography_bucket,
        }).eq("id", s.id);
      }
    }

    // Select top 50 with geo gates
    const top50 = selectTop50(scored);

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
        score: Math.round(a.score),
        reason: a.reasons,
        status: "pending",
      }));

      const { error: insertErr } = await supabase.from("lead_queue").insert(rows);
      if (insertErr) throw insertErr;

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
          disposition: a.disposition,
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
