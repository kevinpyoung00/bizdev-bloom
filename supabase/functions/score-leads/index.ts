import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Geography helpers ───

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

// ─── Domain derivation ───

function deriveDomain(domain: string | null, website: string | null): string | null {
  if (domain) return domain;
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch { return null; }
}

// ─── HR keyword list ───

const HR_KEYWORDS = ["hr", "human resources", "benefits", "people ops", "people operations", "finance", "controller", "payroll", "total rewards"];

// ─── Signal classification ───

interface SignalSizes {
  role_change_size: "large" | "medium" | "small" | null;
  hiring_size: "large" | "medium" | "small" | null;
  funding_size: "large" | "medium" | "small" | null;
  csuite_size: "large" | "medium" | "small" | null;
}

function classifySignals(triggers: any): SignalSizes {
  const result: SignalSizes = { role_change_size: null, hiring_size: null, funding_size: null, csuite_size: null };
  if (!triggers) return result;

  const rc = triggers.recent_role_changes ?? triggers.non_csuite_role_changes;
  if (rc) {
    const items = Array.isArray(rc) ? rc : [rc];
    let bestDays = 999;
    for (const item of items) {
      const combined = `${(item.title || "").toLowerCase()} ${(item.department || "").toLowerCase()}`;
      if (HR_KEYWORDS.some((kw) => combined.includes(kw))) bestDays = Math.min(bestDays, item.days_ago ?? 999);
    }
    if (bestDays <= 14) result.role_change_size = "large";
    else if (bestDays <= 60) result.role_change_size = "medium";
    else if (bestDays <= 180) result.role_change_size = "small";
  }

  const openRoles = triggers.open_roles_60d ?? triggers.hiring_velocity ?? 0;
  if (openRoles >= 10) result.hiring_size = "large";
  else if (openRoles >= 6) result.hiring_size = "medium";
  else if (openRoles >= 3) result.hiring_size = "small";

  const funding = triggers.funding ?? triggers.expansion ?? triggers.funding_expansion;
  if (funding) {
    if (typeof funding === "boolean") result.funding_size = "medium";
    else if (typeof funding === "object") {
      const mo = funding.months_ago ?? 12;
      if (mo <= 3) result.funding_size = "large";
      else if (mo <= 6) result.funding_size = "medium";
      else if (mo <= 12) result.funding_size = "small";
    } else result.funding_size = "small";
  }

  const cs = triggers.c_suite_changes ?? triggers.leadership_changes;
  if (cs) {
    const mo = cs.months_ago ?? cs.recency_months ?? null;
    if (mo !== null) {
      if (mo <= 3) result.csuite_size = "medium";
      else if (mo <= 6) result.csuite_size = "small";
    } else if (cs === true || (typeof cs === "object" && Object.keys(cs).length > 0)) result.csuite_size = "medium";
  }

  return result;
}

// ─── Signal Stars (1-3) ───

function computeSignalStars(signals: SignalSizes, reachReady: boolean): 1 | 2 | 3 {
  const sizes = [signals.role_change_size, signals.hiring_size, signals.funding_size, signals.csuite_size].filter(Boolean) as string[];
  const largeCount = sizes.filter((s) => s === "large").length;
  const mediumCount = sizes.filter((s) => s === "medium").length;
  const smallCount = sizes.filter((s) => s === "small").length;

  if (largeCount >= 1) return 3;
  if (mediumCount >= 2) return 3;
  if (mediumCount >= 1 && reachReady) return 3;
  if (mediumCount >= 1) return 2;
  if (smallCount >= 2) return 2;
  return 1;
}

// ─── Reachability Stars (0-3) ───

function computeReachStars(contacts: any[]): 0 | 1 | 2 | 3 {
  if (!contacts || contacts.length === 0) return 0;
  const hasEmail = contacts.some((c) => c.email);
  const hasPhone = contacts.some((c) => c.phone);
  const hasLinkedIn = contacts.some((c) => c.linkedin_url);
  const count = [hasEmail, hasPhone, hasLinkedIn].filter(Boolean).length;
  if (count >= 3) return 3;
  if (count === 2) return 2;
  if (count === 1) return 1;
  return 0;
}

// ─── Trigger detection (boolean per trigger) ───

function detectTriggers(triggers: any): { hiring: boolean; role_change: boolean; funding: boolean; csuite: boolean } {
  const result = { hiring: false, role_change: false, funding: false, csuite: false };
  if (!triggers) return result;

  const openRoles = triggers.open_roles_60d ?? triggers.hiring_velocity ?? 0;
  if (openRoles >= 6) result.hiring = true;

  const rc = triggers.recent_role_changes ?? triggers.non_csuite_role_changes;
  if (rc) {
    const items = Array.isArray(rc) ? rc : [rc];
    for (const item of items) {
      const combined = `${(item.title || "").toLowerCase()} ${(item.department || "").toLowerCase()}`;
      if (HR_KEYWORDS.some((kw) => combined.includes(kw)) && (item.days_ago ?? 999) <= 60) {
        result.role_change = true;
        break;
      }
    }
  }

  const funding = triggers.funding ?? triggers.expansion ?? triggers.funding_expansion;
  if (funding) {
    if (typeof funding === "boolean" && funding) result.funding = true;
    else if (typeof funding === "object") {
      const mo = funding.months_ago ?? 999;
      if (mo <= 6) result.funding = true;
    }
  }

  const cs = triggers.c_suite_changes ?? triggers.leadership_changes;
  if (cs) {
    const mo = cs.months_ago ?? cs.recency_months ?? null;
    if (mo !== null && mo <= 3) result.csuite = true;
    else if (mo === null && (cs === true || (typeof cs === "object" && Object.keys(cs).length > 0))) result.csuite = true;
  }

  return result;
}

// ─── Normalize triggers → LeadSignals for UI and generators ───

function normalizeToLeadSignals(triggers: any, employeeCount: number | null): any {
  if (!triggers) return {};
  const signals: any = {};

  // Funding
  const funding = triggers.funding ?? triggers.expansion ?? triggers.funding_expansion;
  if (funding && typeof funding === "object") {
    const mo = funding.months_ago ?? 12;
    signals.funding = {
      stage: funding.stage || funding.round || "Series A",
      days_ago: mo * 30,
    };
  } else if (funding === true) {
    signals.funding = { stage: "Series A", days_ago: 90 };
  }

  // HR Role Change
  const rc = triggers.recent_role_changes ?? triggers.non_csuite_role_changes;
  if (rc) {
    const items = Array.isArray(rc) ? rc : [rc];
    let bestItem: any = null;
    let bestDays = 999;
    for (const item of items) {
      const combined = `${(item.title || "").toLowerCase()} ${(item.department || "").toLowerCase()}`;
      if (HR_KEYWORDS.some((kw) => combined.includes(kw))) {
        const d = item.days_ago ?? 999;
        if (d < bestDays) { bestDays = d; bestItem = item; }
      }
    }
    if (bestItem) {
      signals.hr_change = { title: bestItem.title || "HR leader", days_ago: bestDays < 999 ? bestDays : undefined };
    }
  }

  // C-Suite
  const cs = triggers.c_suite_changes ?? triggers.leadership_changes;
  if (cs) {
    const role = cs.role || cs.title || "Other";
    const mo = cs.months_ago ?? cs.recency_months ?? null;
    signals.csuite = { role, days_ago: mo !== null ? mo * 30 : 90 };
  }

  // Hiring
  const openRoles = triggers.open_roles_60d ?? triggers.hiring_velocity ?? 0;
  if (openRoles >= 3) {
    const intensity = openRoles >= 10 ? "Large" : openRoles >= 6 ? "Medium" : "Small";
    signals.hiring = { jobs_60d: openRoles, intensity };
  }

  // Triggers array (expansion, M&A, restructure, layoffs, new product, milestones)
  const triggerLabels: string[] = [];
  if (triggers.expansion_new_location || triggers.new_office) triggerLabels.push("New location");
  if (triggers.mergers_acquisitions || triggers.m_and_a || triggers.ma) triggerLabels.push("M&A");
  if (triggers.restructure || triggers.restructuring) triggerLabels.push("Restructure");
  if (triggers.layoffs || triggers.rif) triggerLabels.push("Layoffs");
  if (triggers.new_product || triggers.product_launch) triggerLabels.push("New product launch");
  if (triggerLabels.length > 0) signals.triggers = triggerLabels;

  // Headcount milestones
  if (employeeCount != null) {
    const milestones: any = {};
    if (employeeCount >= 50) milestones.hit_50 = true;
    if (employeeCount >= 75) milestones.hit_75 = true;
    if (employeeCount >= 100) milestones.hit_100 = true;
    if (employeeCount >= 150) milestones.hit_150 = true;
    if (Object.keys(milestones).length > 0) signals.milestones = milestones;
  }

  // News keywords
  const news = triggers.news ?? triggers.press ?? triggers.media;
  if (news) {
    const kw = Array.isArray(news) ? news : (news.keywords || []);
    if (kw.length > 0) signals.news = { keywords: kw, last_mention_days_ago: news.days_ago ?? null };
  }

  return signals;
}

// ─── Main scoring ───

interface PriorityReason {
  triggers_fired: { hiring: boolean; role_change: boolean; funding: boolean; csuite: boolean };
  signal_stars: 1 | 2 | 3;
  reach_stars: 0 | 1 | 2 | 3;
  contact_email: number;
  contact_phone: number;
  contact_linkedin: number;
  guardrail: string | null;
  signals: SignalSizes;
  lead_signals: any; // Normalized LeadSignals for UI chips and generators
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
  signal_stars: 1 | 2 | 3;
  reach_stars: 0 | 1 | 2 | 3;
  reasons: PriorityReason;
}

function scoreAccount(account: any, contacts: any[]): ScoredAccount {
  const geoBucket = getGeoBucket(account.hq_state);
  const triggers = account.triggers || {};
  const disposition = account.disposition || "active";

  const resolvedDomain = deriveDomain(account.domain, account.website);
  let guardrail: string | null = null;
  if (!resolvedDomain && !account.website) guardrail = "missing_domain_and_website";
  if (disposition === "suppressed") guardrail = "suppressed";
  if (disposition?.startsWith("rejected_")) guardrail = `disposition_${disposition}`;

  const fired = guardrail ? { hiring: false, role_change: false, funding: false, csuite: false } : detectTriggers(triggers);
  const signalSizes = classifySignals(triggers);
  const reachReady = (contacts || []).some((c: any) => c.email || c.phone);
  const signal_stars = guardrail ? 1 as const : computeSignalStars(signalSizes, reachReady);
  const reach_stars = guardrail ? 0 as const : computeReachStars(contacts);

  const hasEmail = contacts.some((c) => c.email) ? 1 : 0;
  const hasPhone = contacts.some((c) => c.phone) ? 1 : 0;
  const hasLinkedIn = contacts.some((c) => c.linkedin_url) ? 1 : 0;

  const empCount = typeof account.employee_count === "number" ? account.employee_count : null;
  const leadSignals = normalizeToLeadSignals(triggers, empCount);

  return {
    id: account.id,
    name: account.name,
    domain: resolvedDomain,
    industry: account.industry,
    employee_count: empCount,
    hq_state: account.hq_state,
    geography_bucket: geoBucket,
    disposition,
    triggers,
    signal_stars,
    reach_stars,
    reasons: {
      triggers_fired: fired,
      signal_stars,
      reach_stars,
      contact_email: hasEmail,
      contact_phone: hasPhone,
      contact_linkedin: hasLinkedIn,
      guardrail,
      signals: signalSizes,
      lead_signals: leadSignals,
    },
  };
}

// ─── Selection with geography gates ───
// NE and National now require ★★★ signal stars instead of numeric score thresholds

function selectTop50(scored: ScoredAccount[]): ScoredAccount[] {
  const eligible = scored.filter((a) => a.disposition === "active" || a.disposition === "needs_review");

  const sorted = [...eligible].sort((a, b) => {
    // Sort by signal stars first, then reach stars
    if (b.signal_stars !== a.signal_stars) return b.signal_stars - a.signal_stars;
    if (b.reach_stars !== a.reach_stars) return b.reach_stars - a.reach_stars;
    // Tie-breakers: employee count proximity to 150 → domain
    const aDist = Math.abs((a.employee_count ?? 0) - 150);
    const bDist = Math.abs((b.employee_count ?? 0) - 150);
    if (aDist !== bDist) return aDist - bDist;
    return (a.domain ?? "").localeCompare(b.domain ?? "");
  });

  const maPool = sorted.filter((a) => a.geography_bucket === "MA");
  const nePool = sorted.filter((a) => a.geography_bucket === "NE" && a.signal_stars === 3);
  const usPool = sorted.filter((a) => a.geography_bucket === "US" && a.signal_stars === 3);

  const selected: ScoredAccount[] = [];
  const usedIds = new Set<string>();

  for (const a of maPool) { if (selected.length >= 45) break; selected.push(a); usedIds.add(a.id); }
  let neCount = 0;
  for (const a of nePool) { if (neCount >= 4) break; if (usedIds.has(a.id)) continue; selected.push(a); usedIds.add(a.id); neCount++; }
  let usCount = 0;
  for (const a of usPool) { if (usCount >= 1) break; if (usedIds.has(a.id)) continue; selected.push(a); usedIds.add(a.id); usCount++; }
  if (selected.length < 50) { for (const a of maPool) { if (selected.length >= 50) break; if (usedIds.has(a.id)) continue; selected.push(a); usedIds.add(a.id); } }
  if (selected.length < 50) { for (const a of sorted) { if (selected.length >= 50) break; if (usedIds.has(a.id)) continue; selected.push(a); usedIds.add(a.id); } }

  return selected.slice(0, 50);
}

// ─── Main handler ───

// ─── Keyword scanner helpers ───

function proximityMatch(text: string, carriers: string[], phrases: string[], window = 100): { carrier: string; phrase: string } | null {
  const lower = text.toLowerCase();
  for (const carrier of carriers) {
    const cLower = carrier.toLowerCase();
    let cIdx = lower.indexOf(cLower);
    while (cIdx !== -1) {
      for (const phrase of phrases) {
        const pLower = phrase.toLowerCase();
        let pIdx = lower.indexOf(pLower);
        while (pIdx !== -1) {
          if (Math.abs(pIdx - cIdx) <= window) return { carrier, phrase };
          pIdx = lower.indexOf(pLower, pIdx + 1);
        }
      }
      cIdx = lower.indexOf(cLower, cIdx + 1);
    }
  }
  return null;
}

function scanForHrKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
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
      try { const body = await req.json(); if (body.dry_run) dryRun = true; if (body.run_date) runDate = body.run_date; } catch { /* no body */ }
    }

    if (!dryRun) {
      await supabase.from("lead_queue").delete().eq("run_date", runDate);
    }

    // ─── Load configurable keywords from settings ───
    const { data: kwRows } = await supabase.from("signal_keywords").select("category, keywords");
    const kwMap: Record<string, string[]> = {};
    for (const row of kwRows || []) {
      kwMap[(row as any).category] = (row as any).keywords as string[] ?? [];
    }
    const carrierNames = kwMap["carrier_names"] ?? [];
    const carrierPhrases = kwMap["carrier_change_phrases"] ?? [];
    const hrKeywords = kwMap["benefits_hr_keywords"] ?? [];

    const { data: accounts, error: accountsErr } = await supabase.from("accounts").select("*");
    if (accountsErr) throw accountsErr;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No accounts to score.", leads: [], stats: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: allContacts } = await supabase.from("contacts_le").select("*");
    const contactsByAccount = new Map<string, any[]>();
    for (const c of allContacts || []) { if (!c.account_id) continue; if (!contactsByAccount.has(c.account_id)) contactsByAccount.set(c.account_id, []); contactsByAccount.get(c.account_id)!.push(c); }

    const scored = accounts.map((a) => {
      const s = scoreAccount(a, contactsByAccount.get(a.id) || []);

      // ─── Keyword scanning on triggers.news / notes ───
      const newsText = (() => {
        const t = a.triggers as any;
        if (!t) return "";
        const news = t.news ?? t.press ?? t.media;
        if (typeof news === "string") return news;
        if (Array.isArray(news)) return news.join(" ");
        if (news?.text) return news.text;
        if (news?.keywords && Array.isArray(news.keywords)) return news.keywords.join(" ");
        return "";
      })();
      const scanText = `${newsText} ${(a as any).notes || ""}`;

      // Carrier change detection
      if (scanText && carrierNames.length > 0 && carrierPhrases.length > 0) {
        const match = proximityMatch(scanText, carrierNames, carrierPhrases);
        if (match) {
          s.reasons.lead_signals.carrier_change = {
            recent: true,
            former_carrier: null,
            new_carrier: match.carrier,
            days_ago: 0,
            source: "news",
          };
        }
      }

      // HR/Benefits keyword detection
      if (scanText && hrKeywords.length > 0) {
        const found = scanForHrKeywords(scanText, hrKeywords);
        if (found.length > 0) {
          if (!s.reasons.lead_signals.news) {
            s.reasons.lead_signals.news = { keywords: found, last_mention_days_ago: null };
          } else {
            const existing: string[] = s.reasons.lead_signals.news.keywords || [];
            const merged = [...new Set([...existing, ...found])];
            s.reasons.lead_signals.news.keywords = merged;
          }
        }
      }

      return s;
    });

    if (!dryRun) {
      for (const s of scored) {
        await supabase.from("accounts").update({ geography_bucket: s.geography_bucket }).eq("id", s.id);
      }
    }

    const top50 = selectTop50(scored);
    const maCount = top50.filter((a) => a.geography_bucket === "MA").length;
    const neCountFinal = top50.filter((a) => a.geography_bucket === "NE").length;
    const usCountFinal = top50.filter((a) => a.geography_bucket === "US").length;

    if (!dryRun && top50.length > 0) {
      const rows = top50.map((a, i) => ({
        account_id: a.id, run_date: runDate, priority_rank: i + 1,
        score: a.signal_stars,
        reason: a.reasons, status: "pending",
      }));
      const { error: insertErr } = await supabase.from("lead_queue").insert(rows);
      if (insertErr) throw insertErr;
      await supabase.from("audit_log").insert({ actor: "system", action: "daily_lead_run", entity_type: "lead_queue", details: { run_date: runDate, total: top50.length, ma: maCount, ne: neCountFinal, us: usCountFinal } });
    }

    return new Response(JSON.stringify({
      success: true, dry_run: dryRun, run_date: runDate,
      stats: { total: top50.length, ma: maCount, ne: neCountFinal, us: usCountFinal, total_candidates: scored.length },
      leads: top50.map((a, i) => ({
        rank: i + 1, signal_stars: a.signal_stars, reach_stars: a.reach_stars,
        name: a.name, domain: a.domain, industry: a.industry,
        employee_count: a.employee_count, geography: a.geography_bucket,
        state: a.hq_state, disposition: a.disposition, reasons: a.reasons,
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Score leads error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
