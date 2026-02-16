import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Geography helpers ───

const MA_NAMES = ["MA", "MASSACHUSETTS"];
const NE_STATES = ["CT", "RI", "NH", "ME", "VT", "CONNECTICUT", "RHODE ISLAND", "NEW HAMPSHIRE", "MAINE", "VERMONT"];

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

// ─── HQ extraction from scraped content ───

const STATE_ABBREVS: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
  "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
  "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
  "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
  "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
  "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
  "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
};

const STATE_CODES = new Set(Object.values(STATE_ABBREVS));

function extractHqState(markdown: string): { city: string | null; state: string | null } {
  if (!markdown) return { city: null, state: null };

  // Pattern: "City, ST" or "City, State Name"
  // Try abbreviation first: "Boston, MA" pattern
  const abbrPattern = /([A-Z][a-zA-Z\s]{1,30}),\s*([A-Z]{2})\b/g;
  let match;
  while ((match = abbrPattern.exec(markdown)) !== null) {
    const code = match[2];
    if (STATE_CODES.has(code)) {
      return { city: match[1].trim(), state: code };
    }
  }

  // Try full state name: "Boston, Massachusetts"
  const lower = markdown.toLowerCase();
  for (const [fullName, code] of Object.entries(STATE_ABBREVS)) {
    const idx = lower.indexOf(fullName);
    if (idx > 0) {
      // Look for city before it
      const before = markdown.substring(Math.max(0, idx - 40), idx);
      const cityMatch = before.match(/([A-Z][a-zA-Z\s]{1,25}),\s*$/);
      return { city: cityMatch ? cityMatch[1].trim() : null, state: code };
    }
  }

  return { city: null, state: null };
}

// ─── Signal detection from website content ───

function detectSignalsFromContent(markdown: string, carrierNames: string[], carrierPhrases: string[], hrKeywords: string[]): Record<string, any> {
  const signals: Record<string, any> = {};
  if (!markdown) return signals;
  const lower = markdown.toLowerCase();

  // Hiring signals - look for careers/jobs pages indicators
  const hiringPatterns = [
    /(\d+)\+?\s*open\s*(positions|roles|jobs)/i,
    /join\s+our\s+team/i,
    /we['']re\s+hiring/i,
    /career\s+opportunities/i,
  ];
  for (const p of hiringPatterns) {
    const m = markdown.match(p);
    if (m) {
      const count = m[1] ? parseInt(m[1]) : 5;
      signals.open_roles_60d = count;
      break;
    }
  }

  // Funding/expansion signals
  const fundingPatterns = [
    /series\s+([a-e])/i,
    /raised\s+\$[\d,.]+\s*(million|m|billion|b)/i,
    /new\s+office|new\s+location|expanding\s+to/i,
  ];
  for (const p of fundingPatterns) {
    const m = markdown.match(p);
    if (m) {
      signals.funding = { stage: m[1] ? `Series ${m[1].toUpperCase()}` : "Growth", months_ago: 3 };
      break;
    }
  }

  // Carrier change proximity matching
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

  // HR/Benefits keyword detection
  if (hrKeywords.length > 0) {
    const found = hrKeywords.filter(kw => lower.includes(kw.toLowerCase()));
    if (found.length > 0) {
      signals.news = { keywords: found, source: "website" };
    }
  }

  return signals;
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

    // Load signal keywords
    const { data: kwRows } = await supabase.from("signal_keywords").select("category, keywords");
    const kwMap: Record<string, string[]> = {};
    for (const row of kwRows || []) {
      kwMap[(row as any).category] = (row as any).keywords as string[] ?? [];
    }
    const carrierNames = kwMap["carrier_names"] ?? [];
    const carrierPhrases = kwMap["carrier_change_phrases"] ?? [];
    const hrKeywords = kwMap["benefits_hr_keywords"] ?? [];

    // Load all accounts
    const { data: accounts, error: accErr } = await supabase.from("accounts").select("*");
    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({
        success: true, candidates_added: 0, candidates_updated: 0,
        hq_MA: 0, hq_NE: 0, discarded_non_NE: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let candidatesAdded = 0;
    let candidatesUpdated = 0;
    let hqMA = 0;
    let hqNE = 0;
    let discardedNonNE = 0;
    let errors: string[] = [];

    for (const account of accounts) {
      const website = account.website || account.domain;
      const alreadyHasState = !!account.hq_state;
      const alreadyHasTriggers = account.triggers && Object.keys(account.triggers).length > 0;

      // Skip if fully enriched already (has HQ state + triggers)
      if (alreadyHasState && alreadyHasTriggers) {
        // Still count geo buckets
        const bucket = getGeoBucket(account.hq_state);
        if (bucket === "MA") hqMA++;
        else if (bucket === "NE") hqNE++;
        else discardedNonNE++;
        candidatesUpdated++;
        continue;
      }

      // Try to scrape if we have Firecrawl and a website/company name
      let markdown = "";
      let discoveredWebsite: string | null = null;

      if (firecrawlKey && (website || account.name)) {
        try {
          let scrapeUrl = website;

          // Discover website if missing
          if (!scrapeUrl) {
            const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
              method: "POST",
              headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ query: `${account.name} official website`, limit: 1 }),
            });
            const searchData = await searchResp.json();
            if (searchResp.ok && searchData.data?.length > 0) {
              scrapeUrl = searchData.data[0].url;
              discoveredWebsite = scrapeUrl;
            }
          }

          if (scrapeUrl) {
            let formattedUrl = scrapeUrl.trim();
            if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
              formattedUrl = `https://${formattedUrl}`;
            }

            const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ url: formattedUrl, formats: ["markdown"], onlyMainContent: true }),
            });

            if (scrapeResp.ok) {
              const scrapeData = await scrapeResp.json();
              markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
            }
          }
        } catch (e) {
          errors.push(`${account.name}: scrape failed - ${e.message}`);
        }
      }

      // Extract HQ if missing
      const updates: Record<string, any> = {};
      if (!alreadyHasState && markdown) {
        const hq = extractHqState(markdown);
        if (hq.state) {
          updates.hq_state = hq.state;
          if (hq.city) updates.hq_city = hq.city;
        }
      }

      // Detect signals from content
      if (markdown) {
        const newSignals = detectSignalsFromContent(markdown, carrierNames, carrierPhrases, hrKeywords);
        if (Object.keys(newSignals).length > 0) {
          const existingTriggers = (account.triggers && typeof account.triggers === "object") ? account.triggers : {};
          updates.triggers = { ...existingTriggers, ...newSignals };
        }
      }

      // Set discovered website
      if (discoveredWebsite && !account.website) {
        updates.website = discoveredWebsite;
      }

      // Compute geo bucket
      const effectiveState = updates.hq_state || account.hq_state;
      const bucket = getGeoBucket(effectiveState);
      updates.geography_bucket = bucket;

      if (bucket === "MA") hqMA++;
      else if (bucket === "NE") hqNE++;
      else discardedNonNE++;

      // Apply updates
      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase.from("accounts").update(updates).eq("id", account.id);
        if (updateErr) errors.push(`${account.name}: update failed - ${updateErr.message}`);
        else {
          if (alreadyHasState || alreadyHasTriggers) candidatesUpdated++;
          else candidatesAdded++;
        }
      } else {
        candidatesUpdated++;
      }
    }

    // Audit log
    try {
      await supabase.from("audit_log").insert({
        actor: "system", action: "run_discovery",
        entity_type: "accounts",
        details: {
          candidates_added: candidatesAdded,
          candidates_updated: candidatesUpdated,
          hq_MA: hqMA, hq_NE: hqNE,
          discarded_non_NE: discardedNonNE,
          errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        },
      });
    } catch (_) { /* non-critical */ }

    return new Response(JSON.stringify({
      success: true,
      candidates_added: candidatesAdded,
      candidates_updated: candidatesUpdated,
      hq_MA: hqMA,
      hq_NE: hqNE,
      discarded_non_NE: discardedNonNE,
      total_accounts: accounts.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("run-discovery error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
