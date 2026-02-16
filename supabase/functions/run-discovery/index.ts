import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Geography helpers ───
const MA_NAMES = ["MA", "MASSACHUSETTS"];
const NE_STATES = ["CT", "RI", "NH", "ME", "VT", "CONNECTICUT", "RHODE ISLAND", "NEW HAMPSHIRE", "MAINE", "VERMONT"];
const NE_CODES = new Set(["CT", "RI", "NH", "ME", "VT"]);

function normalizeState(s: string | null): string {
  if (!s) return "";
  return s.trim().toUpperCase();
}

function getGeoBucket(state: string): "MA" | "NE" | "US" {
  const s = normalizeState(state);
  if (MA_NAMES.includes(s)) return "MA";
  if (NE_STATES.includes(s)) return "NE";
  return "US";
}

// ─── State maps ───
const STATE_ABBREVS: Record<string, string> = {
  "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA","colorado":"CO",
  "connecticut":"CT","delaware":"DE","florida":"FL","georgia":"GA","hawaii":"HI","idaho":"ID",
  "illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS","kentucky":"KY","louisiana":"LA",
  "maine":"ME","maryland":"MD","massachusetts":"MA","michigan":"MI","minnesota":"MN",
  "mississippi":"MS","missouri":"MO","montana":"MT","nebraska":"NE","nevada":"NV",
  "new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC",
  "north dakota":"ND","ohio":"OH","oklahoma":"OK","oregon":"OR","pennsylvania":"PA",
  "rhode island":"RI","south carolina":"SC","south dakota":"SD","tennessee":"TN","texas":"TX",
  "utah":"UT","vermont":"VT","virginia":"VA","washington":"WA","west virginia":"WV",
  "wisconsin":"WI","wyoming":"WY",
};
const STATE_CODES = new Set(Object.values(STATE_ABBREVS));

// ─── HQ extraction ───
function extractHqState(markdown: string): { city: string | null; state: string | null; country: string | null } {
  if (!markdown) return { city: null, state: null, country: null };

  // Schema.org PostalAddress
  const schemaMatch = markdown.match(/"addressRegion"\s*:\s*"([^"]+)"/);
  if (schemaMatch) {
    const region = schemaMatch[1].trim().toUpperCase();
    const code = STATE_CODES.has(region) ? region : STATE_ABBREVS[region.toLowerCase()];
    if (code) {
      const countryMatch = markdown.match(/"addressCountry"\s*:\s*"([^"]+)"/);
      const country = countryMatch ? countryMatch[1].trim().toUpperCase() : "US";
      const cityMatch = markdown.match(/"addressLocality"\s*:\s*"([^"]+)"/);
      return { city: cityMatch ? cityMatch[1].trim() : null, state: code, country };
    }
  }

  // "City, ST" pattern
  const abbrPattern = /([A-Z][a-zA-Z\s]{1,30}),\s*([A-Z]{2})\b/g;
  let match;
  while ((match = abbrPattern.exec(markdown)) !== null) {
    if (STATE_CODES.has(match[2])) {
      return { city: match[1].trim(), state: match[2], country: "US" };
    }
  }

  // Full state name
  const lower = markdown.toLowerCase();
  for (const [fullName, code] of Object.entries(STATE_ABBREVS)) {
    const idx = lower.indexOf(fullName);
    if (idx > 0) {
      const before = markdown.substring(Math.max(0, idx - 40), idx);
      const cityMatch = before.match(/([A-Z][a-zA-Z\s]{1,25}),\s*$/);
      return { city: cityMatch ? cityMatch[1].trim() : null, state: code, country: "US" };
    }
  }

  return { city: null, state: null, country: null };
}

// ─── Signal detection ───
function detectSignalsFromContent(markdown: string, carrierNames: string[], carrierPhrases: string[], hrKeywords: string[]): Record<string, any> {
  const signals: Record<string, any> = {};
  if (!markdown) return signals;
  const lower = markdown.toLowerCase();

  const hiringPatterns = [/(\d+)\+?\s*open\s*(positions|roles|jobs)/i, /join\s+our\s+team/i, /we['']re\s+hiring/i, /career\s+opportunities/i];
  for (const p of hiringPatterns) {
    const m = markdown.match(p);
    if (m) { signals.open_roles_60d = m[1] ? parseInt(m[1]) : 5; break; }
  }

  const fundingPatterns = [/series\s+([a-e])/i, /raised\s+\$[\d,.]+\s*(million|m|billion|b)/i, /new\s+office|new\s+location|expanding\s+to/i];
  for (const p of fundingPatterns) {
    const m = markdown.match(p);
    if (m) { signals.funding = { stage: m[1] ? `Series ${m[1].toUpperCase()}` : "Growth", months_ago: 3 }; break; }
  }

  // HR / C-suite detection
  const hrPatterns = [/chief\s+people\s+officer/i, /vp\s+(of\s+)?people/i, /chro/i, /vp\s+(of\s+)?human\s+resources/i, /head\s+of\s+people/i];
  for (const p of hrPatterns) {
    if (p.test(markdown)) { signals.hr_change = { recent: true, source: "website" }; break; }
  }
  const csuitePatterns = [/new\s+c[efo]o/i, /executive\s+appointment/i, /named?\s+(ceo|cfo|coo|cto|cio)/i];
  for (const p of csuitePatterns) {
    if (p.test(markdown)) { signals.csuite_change = { recent: true, source: "website" }; break; }
  }

  // Carrier change proximity
  if (carrierNames.length > 0 && carrierPhrases.length > 0) {
    for (const carrier of carrierNames) {
      const cIdx = lower.indexOf(carrier.toLowerCase());
      if (cIdx === -1) continue;
      for (const phrase of carrierPhrases) {
        const pIdx = lower.indexOf(phrase.toLowerCase());
        if (pIdx !== -1 && Math.abs(pIdx - cIdx) <= 100) {
          signals.carrier_change = { recent: true, new_carrier: carrier, source: "website" };
          break;
        }
      }
      if (signals.carrier_change) break;
    }
  }

  // HR/Benefits keywords
  if (hrKeywords.length > 0) {
    const found = hrKeywords.filter(kw => lower.includes(kw.toLowerCase()));
    if (found.length > 0) signals.news = { keywords: found, source: "website" };
  }

  return signals;
}

// ─── High-intent check ───
function isHighIntent(triggers: Record<string, any>): { highIntent: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (triggers.funding) {
    const monthsAgo = triggers.funding.months_ago ?? 6;
    if (monthsAgo <= 4) reasons.push(`funding_${monthsAgo * 30}d`);
  }
  if (triggers.hr_change?.recent) reasons.push("hr_leader_recent");
  if (triggers.csuite_change?.recent) reasons.push("csuite_recent");
  if (triggers.carrier_change?.recent) reasons.push("carrier_change_recent");
  if ((triggers.open_roles_60d ?? 0) >= 8) reasons.push(`hiring_${triggers.open_roles_60d}_roles`);
  if (triggers.news?.keywords?.length >= 2) reasons.push("strong_news");
  return { highIntent: reasons.length > 0, reasons };
}

// ─── Rotating themes ───
interface DayTheme {
  key: string; label: string; industries: string[]; subSectors: string[];
}

const DAY_THEMES: Record<number, DayTheme> = {
  1: { key: "biotech_life_sciences", label: "Life Sciences / Biotech", industries: ["biotech", "life sciences", "pharmaceuticals", "genomics"], subSectors: ["gene therapy", "CRO", "diagnostics", "clinical trials", "drug discovery", "biologics", "mRNA", "cell therapy", "precision medicine", "immunotherapy"] },
  2: { key: "tech_pst", label: "Tech / SaaS", industries: ["technology", "SaaS", "software", "IT services"], subSectors: ["cybersecurity", "fintech", "edtech", "healthtech", "cloud infrastructure", "AI platform", "data analytics", "DevOps", "enterprise software", "B2B SaaS"] },
  3: { key: "advanced_mfg_med_devices", label: "Manufacturing / Med Devices", industries: ["manufacturing", "medical devices", "precision engineering"], subSectors: ["medtech engineering", "CNC machining", "electronics manufacturing", "defense contractor", "semiconductor equipment", "industrial automation", "3D printing", "additive manufacturing"] },
  4: { key: "healthcare_social_assistance", label: "Healthcare / Clinics / Providers", industries: ["healthcare", "clinics", "medical providers"], subSectors: ["urgent care", "dental group", "physical therapy", "home health", "mental health", "community health center", "telehealth", "primary care network"] },
  5: { key: "professional_services", label: "Professional Services / Financial", industries: ["professional services", "consulting", "financial services"], subSectors: ["accounting firm", "law firm", "staffing agency", "marketing agency", "wealth management", "IT consulting", "management consulting", "real estate"] },
  6: { key: "hiring_sweep", label: "Hiring Velocity Sweep", industries: ["rapid growth company", "scaling startup", "high growth"], subSectors: ["talent acquisition", "workforce expansion", "mass hiring", "new office opening"] },
  0: { key: "trigger_sweep", label: "Leadership / Funding / Carrier Triggers", industries: ["executive transition", "funding round", "benefits renewal"], subSectors: ["M&A activity", "carrier change", "IPO preparation", "new leadership"] },
};

const GEO_TERMS = [
  "Boston", "Cambridge", "Worcester", "Waltham", "Lowell", "Andover", "New Bedford",
  "Springfield", "North Shore MA", "South Shore MA", "Cape Cod", "Western Massachusetts",
  "Central Massachusetts", "Framingham", "Quincy", "Newton", "Route 128 corridor", "MetroWest",
];

const NE_GEO_TERMS = [
  "Hartford CT", "New Haven CT", "Stamford CT", "Providence RI",
  "Portland ME", "Manchester NH", "Burlington VT", "Nashua NH",
];

const TRIGGER_KEYWORDS: Record<string, string[]> = {
  funding: ["raises $", "Series A", "Series B", "Series C", "funding round", "venture funding"],
  hr_leader: ["Chief People Officer", "VP People", "CHRO", "VP Human Resources", "Head of People"],
  csuite: ["new CEO", "new CFO", "new COO", "new CTO", "executive appointment"],
  carrier_change: ["switches benefits carrier", "Point32Health", "Harvard Pilgrim", "Tufts Health Plan", "BCBS", "UHC", "Aetna", "Cigna"],
  hiring: ["we're hiring", "open roles", "careers", "join our team", "career opportunities"],
  pr_news: ["announces", "press release", "opens new", "expands to", "partnership"],
};

const QUERY_TEMPLATES = [
  "{geo} {industry} company",
  "{geo} {subsector}",
  "Massachusetts {industry} {trigger}",
  "Boston MA {subsector} {trigger}",
  "HQ Massachusetts {industry}",
  "{industry} company careers MA",
  "{geo} {industry} about us",
  "{subsector} company {geo}",
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

// ─── Build search queries ───
function buildQueries(params: {
  industries?: string[];
  triggers?: string[];
  geoTerms?: string[];
  subSectors?: string[];
  maxQueries?: number;
}): string[] {
  const { industries = [], triggers = [], geoTerms = GEO_TERMS, subSectors = [], maxQueries = 8 } = params;
  const queries: Set<string> = new Set();

  const geos = pickRandom(geoTerms, 4);
  const subs = pickRandom(subSectors, 3);
  const triggerKeys = triggers.length > 0 ? triggers : pickRandom(Object.keys(TRIGGER_KEYWORDS), 2);
  const triggerTerms: string[] = [];
  for (const tk of triggerKeys) {
    const terms = TRIGGER_KEYWORDS[tk] || [];
    triggerTerms.push(...pickRandom(terms, 2));
  }

  const templates = pickRandom(QUERY_TEMPLATES, 6);
  for (const tpl of templates) {
    const geo = pickRandom(geos, 1)[0] || "Massachusetts";
    const industry = pickRandom(industries, 1)[0] || "company";
    const subsector = pickRandom(subs, 1)[0] || industry;
    const trigger = pickRandom(triggerTerms, 1)[0] || "";

    const q = tpl
      .replace("{geo}", geo)
      .replace("{industry}", industry)
      .replace("{subsector}", subsector)
      .replace("{trigger}", trigger)
      .trim();
    if (q.length > 5) queries.add(q);
    if (queries.size >= maxQueries) break;
  }

  return Array.from(queries);
}

// ─── Extract domain from URL ───
function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// ─── Canonicalize company name ───
function canonicalize(name: string): string {
  return name
    .replace(/\b(inc|llc|co|corp|ltd|limited|corporation|company|group|holdings|plc|lp|llp)\b\.?/gi, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "auto"; // "auto" (rotating) or "manual"
    const manualParams = body.params || {};
    const candidateCap = body.candidate_cap || 150;
    const overrideMaNe = body.override_ma_ne || false;

    // Load signal keywords from DB
    const { data: kwRows } = await supabase.from("signal_keywords").select("category, keywords");
    const kwMap: Record<string, string[]> = {};
    for (const row of kwRows || []) {
      kwMap[(row as any).category] = (row as any).keywords as string[] ?? [];
    }
    const carrierNames = kwMap["carrier_names"] ?? [];
    const carrierPhrases = kwMap["carrier_change_phrases"] ?? [];
    const hrKeywords = kwMap["benefits_hr_keywords"] ?? [];

    // Load existing account domains for dedup
    const { data: existingAccounts } = await supabase.from("accounts").select("id, domain, canonical_company_name, name");
    const existingDomains = new Set<string>();
    const existingCanonicals = new Map<string, string>();
    for (const a of existingAccounts || []) {
      if (a.domain) existingDomains.add(a.domain.toLowerCase());
      if (a.canonical_company_name) existingCanonicals.set(a.canonical_company_name.toLowerCase(), a.id);
    }

    // ─── Build queries based on mode ───
    let queries: string[];
    let geoTerms = [...GEO_TERMS, ...pickRandom(NE_GEO_TERMS, 3)];

    if (mode === "manual") {
      const industries = manualParams.industries || ["company"];
      const triggers = manualParams.triggers || [];
      const geoStates = manualParams.geography || ["MA"];
      // If custom states provided, build geo terms from them
      if (geoStates.length > 0 && !(geoStates.length === 1 && geoStates[0] === "MA")) {
        geoTerms = geoStates.map((s: string) => s);
      }
      const resultCount = manualParams.result_count || 50;
      queries = buildQueries({
        industries,
        triggers,
        geoTerms,
        subSectors: manualParams.sub_sectors || industries,
        maxQueries: Math.min(Math.ceil(resultCount / 3), 15),
      });
    } else {
      // Auto: rotating theme by day-of-week
      const dayOfWeek = new Date().getDay();
      const theme = DAY_THEMES[dayOfWeek] || DAY_THEMES[1];
      console.log(`Auto-discovery: ${theme.label} (day ${dayOfWeek})`);
      queries = buildQueries({
        industries: theme.industries,
        subSectors: theme.subSectors,
        geoTerms,
        maxQueries: 10,
      });
    }

    // ─── Firecrawl Search for net-new domains ───
    const candidateDomains: Map<string, { url: string; title: string; description: string }> = new Map();
    let searchErrors: string[] = [];

    if (firecrawlKey) {
      for (const query of queries) {
        if (candidateDomains.size >= candidateCap) break;
        try {
          const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ query, limit: 5 }),
          });
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            for (const result of searchData.data || []) {
              const domain = extractDomain(result.url);
              if (!domain) continue;
              // Skip already-known domains
              if (existingDomains.has(domain)) continue;
              // Skip common non-company domains
              if (/linkedin\.com|facebook\.com|twitter\.com|instagram\.com|youtube\.com|wikipedia\.org|yelp\.com|glassdoor\.com|indeed\.com|crunchbase\.com|bloomberg\.com|bbb\.org/.test(domain)) continue;
              if (!candidateDomains.has(domain)) {
                candidateDomains.set(domain, { url: result.url, title: result.title || "", description: result.description || "" });
              }
            }
          } else {
            searchErrors.push(`Search failed for "${query}": ${searchResp.status}`);
          }
        } catch (e) {
          searchErrors.push(`Search error for "${query}": ${e.message}`);
        }
      }
    } else {
      // No Firecrawl key: fall back to enriching existing accounts only
      console.log("No FIRECRAWL_API_KEY — enriching existing accounts only");
    }

    console.log(`Found ${candidateDomains.size} candidate domains from ${queries.length} queries`);

    // ─── Scrape + HQ extract + create accounts ───
    let candidatesCreated = 0;
    let candidatesUpdated = 0;
    let hqMA = 0;
    let hqNE = 0;
    let discardedNonNE = 0;
    let discardedUnknownHQ = 0;
    let scrapeErrors: string[] = [];
    const keptCandidates: any[] = [];

    for (const [domain, info] of candidateDomains) {
      if (keptCandidates.length >= candidateCap) break;

      let markdown = "";
      try {
        const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: `https://${domain}`, formats: ["markdown"], onlyMainContent: true }),
        });
        if (scrapeResp.ok) {
          const scrapeData = await scrapeResp.json();
          markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
        }
      } catch (e) {
        scrapeErrors.push(`${domain}: scrape failed - ${e.message}`);
        continue;
      }

      // Extract HQ
      const hq = extractHqState(markdown);

      // HQ gating
      if (!hq.state || !hq.country) {
        discardedUnknownHQ++;
        continue;
      }
      if (hq.country !== "US") {
        discardedNonNE++;
        continue;
      }

      const bucket = getGeoBucket(hq.state);
      if (!overrideMaNe && bucket === "US") {
        discardedNonNE++;
        continue;
      }

      if (bucket === "MA") hqMA++;
      else if (bucket === "NE") hqNE++;

      // Detect signals
      const signals = detectSignalsFromContent(markdown, carrierNames, carrierPhrases, hrKeywords);
      const { highIntent, reasons: intentReasons } = isHighIntent(signals);

      // Infer company name from title or domain
      const companyName = info.title
        ? info.title.split(/[|–—\-:]/)[0].trim().replace(/\s*(Home|Homepage|Official Site|Welcome)$/i, "").trim()
        : domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);

      const canonical = canonicalize(companyName);

      // Check canonical name dedup
      const existingId = existingCanonicals.get(canonical);
      if (existingId) {
        // Update existing account with new signals if any
        if (Object.keys(signals).length > 0) {
          await supabase.from("accounts").update({
            triggers: signals,
            geography_bucket: bucket,
            hq_state: hq.state,
            hq_city: hq.city,
            hq_country: hq.country || "US",
          } as any).eq("id", existingId);
          candidatesUpdated++;
        }
        continue;
      }

      // Create new account
      const { data: newAccount, error: insertErr } = await supabase.from("accounts").insert({
        name: companyName,
        domain,
        canonical_company_name: canonical,
        website: `https://${domain}`,
        hq_city: hq.city,
        hq_state: hq.state,
        hq_country: hq.country || "US",
        geography_bucket: bucket,
        triggers: Object.keys(signals).length > 0 ? signals : {},
        source: "auto_discovery_rotating_v1",
        disposition: "active",
        d365_status: "unknown",
        needs_review: false,
      } as any).select("id, name, domain, hq_state, geography_bucket").single();

      if (insertErr) {
        scrapeErrors.push(`${domain}: insert failed - ${insertErr.message}`);
        continue;
      }

      candidatesCreated++;
      existingDomains.add(domain);
      existingCanonicals.set(canonical, newAccount.id);

      keptCandidates.push({
        id: newAccount.id,
        name: companyName,
        domain,
        hq_state: hq.state,
        geography_bucket: bucket,
        high_intent: highIntent,
        intent_reasons: intentReasons,
        top_signal: Object.keys(signals)[0] || null,
      });
    }

    // ─── Also enrich existing accounts missing HQ/triggers ───
    const { data: unenrichedAccounts } = await supabase.from("accounts")
      .select("*")
      .or("hq_state.is.null,triggers.eq.{}")
      .limit(50);

    for (const account of unenrichedAccounts || []) {
      const website = account.website || account.domain;
      if (!website || !firecrawlKey) continue;

      try {
        let formattedUrl = website.trim();
        if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
          formattedUrl = `https://${formattedUrl}`;
        }
        const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: formattedUrl, formats: ["markdown"], onlyMainContent: true }),
        });
        if (!scrapeResp.ok) continue;
        const scrapeData = await scrapeResp.json();
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
        if (!markdown) continue;

        const updates: Record<string, any> = {};
        if (!account.hq_state) {
          const hq = extractHqState(markdown);
          if (hq.state) {
            updates.hq_state = hq.state;
            if (hq.city) updates.hq_city = hq.city;
            if (hq.country) updates.hq_country = hq.country;
            updates.geography_bucket = getGeoBucket(hq.state);
          }
        }
        const existingTriggers = (account.triggers && typeof account.triggers === "object" && !Array.isArray(account.triggers)) ? account.triggers : {};
        if (Object.keys(existingTriggers).length === 0) {
          const signals = detectSignalsFromContent(markdown, carrierNames, carrierPhrases, hrKeywords);
          if (Object.keys(signals).length > 0) updates.triggers = signals;
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from("accounts").update(updates).eq("id", account.id);
          candidatesUpdated++;
        }
      } catch (e) {
        scrapeErrors.push(`${account.name}: enrich failed - ${e.message}`);
      }
    }

    // ─── Audit log ───
    const summary = {
      mode,
      theme: mode === "auto" ? (DAY_THEMES[new Date().getDay()] || DAY_THEMES[1]).label : "manual",
      queries_run: queries.length,
      domains_found: candidateDomains.size,
      candidates_created: candidatesCreated,
      candidates_updated: candidatesUpdated,
      hq_MA: hqMA,
      hq_NE: hqNE,
      discarded_non_NE: discardedNonNE,
      discarded_unknown_HQ: discardedUnknownHQ,
      kept_candidates: keptCandidates.length,
      errors: [...searchErrors, ...scrapeErrors].slice(0, 10),
    };

    try {
      await supabase.from("audit_log").insert({
        actor: "system", action: "run_discovery",
        entity_type: "accounts",
        details: summary,
      });
    } catch (_) { /* non-critical */ }

    return new Response(JSON.stringify({
      success: true,
      ...summary,
      preview_candidates: keptCandidates.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("run-discovery error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
