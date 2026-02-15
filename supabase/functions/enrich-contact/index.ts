import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Provider stubs ───
// Each returns { fields_merged: string[], data: Record<string,any> } or null on skip/error

interface EnrichResult {
  provider: string;
  fields_merged: string[];
  data: Record<string, any>;
  skipped?: boolean;
  error?: string;
}

async function tryZoomInfo(apiKey: string, domain: string | null): Promise<EnrichResult> {
  // TODO: Implement real ZoomInfo API call
  // GET https://api.zoominfo.com/lookup?outputFields=...&companyDomain={domain}
  if (!domain) return { provider: "zoominfo", fields_merged: [], data: {}, skipped: true, error: "no_domain" };
  console.log(`[enrich] ZoomInfo stub for domain=${domain}`);
  return { provider: "zoominfo", fields_merged: [], data: {}, skipped: true, error: "stub_not_implemented" };
}

async function tryClearbit(apiKey: string, domain: string | null): Promise<EnrichResult> {
  // TODO: Implement Clearbit Enrichment API
  // GET https://company.clearbit.com/v2/companies/find?domain={domain}
  if (!domain) return { provider: "clearbit", fields_merged: [], data: {}, skipped: true, error: "no_domain" };
  console.log(`[enrich] Clearbit stub for domain=${domain}`);
  return { provider: "clearbit", fields_merged: [], data: {}, skipped: true, error: "stub_not_implemented" };
}

async function tryApollo(apiKey: string, linkedinUrl: string | null): Promise<EnrichResult> {
  // TODO: Implement Apollo People Enrichment
  // POST https://api.apollo.io/api/v1/people/match with linkedin_url
  if (!linkedinUrl) return { provider: "apollo", fields_merged: [], data: {}, skipped: true, error: "no_linkedin" };
  console.log(`[enrich] Apollo stub for linkedin=${linkedinUrl}`);
  return { provider: "apollo", fields_merged: [], data: {}, skipped: true, error: "stub_not_implemented" };
}

async function tryCrunchbase(apiKey: string, domain: string | null): Promise<EnrichResult> {
  // TODO: Implement Crunchbase API
  // GET https://api.crunchbase.com/api/v4/entities/organizations/{domain}
  if (!domain) return { provider: "crunchbase", fields_merged: [], data: {}, skipped: true, error: "no_domain" };
  console.log(`[enrich] Crunchbase stub for domain=${domain}`);
  return { provider: "crunchbase", fields_merged: [], data: {}, skipped: true, error: "stub_not_implemented" };
}

async function tryNewsApi(apiKey: string, companyName: string): Promise<EnrichResult> {
  // TODO: Implement News API
  // GET https://newsapi.org/v2/everything?q={companyName}&sortBy=publishedAt
  console.log(`[enrich] NewsAPI stub for company=${companyName}`);
  return { provider: "news_api", fields_merged: [], data: {}, skipped: true, error: "stub_not_implemented" };
}

async function tryZywave(_domain: string | null): Promise<EnrichResult> {
  // TODO: Implement Zywave connector (no key needed)
  console.log(`[enrich] Zywave stub`);
  return { provider: "zywave", fields_merged: [], data: {}, skipped: true, error: "stub_not_implemented" };
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

    const { contact_id, account_id } = await req.json();
    if (!contact_id && !account_id) {
      return new Response(JSON.stringify({ success: false, error: "contact_id or account_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load integration settings
    const { data: integrations } = await supabase.from("integration_settings").select("*").order("sort_order");
    const providers: Record<string, { enabled: boolean; api_key_ref: string | null }> = {};
    for (const row of integrations || []) {
      providers[(row as any).provider] = {
        enabled: (row as any).enabled,
        api_key_ref: (row as any).api_key_ref,
      };
    }

    // Load contact and account
    let contact: any = null;
    let account: any = null;

    if (contact_id) {
      const { data } = await supabase.from("contacts_le").select("*").eq("id", contact_id).single();
      contact = data;
    }

    if (account_id || contact?.account_id) {
      const aid = account_id || contact.account_id;
      const { data } = await supabase.from("accounts").select("*").eq("id", aid).single();
      account = data;
    }

    const domain = account?.domain || null;
    const linkedinUrl = contact?.linkedin_url || null;
    const companyName = account?.name || "";

    const enrichmentLog: EnrichResult[] = [];

    // ─── Pipeline order ───

    // 1) ZoomInfo
    if (providers.zoominfo?.enabled && providers.zoominfo?.api_key_ref) {
      try {
        const result = await tryZoomInfo(providers.zoominfo.api_key_ref, domain);
        enrichmentLog.push({ ...result, provider: "zoominfo" });
      } catch (err) {
        console.error("[enrich] ZoomInfo error:", err);
        enrichmentLog.push({ provider: "zoominfo", fields_merged: [], data: {}, error: String(err) });
      }
    }

    // 2) Clearbit
    if (providers.clearbit?.enabled && providers.clearbit?.api_key_ref) {
      try {
        const result = await tryClearbit(providers.clearbit.api_key_ref, domain);
        enrichmentLog.push({ ...result, provider: "clearbit" });
      } catch (err) {
        console.error("[enrich] Clearbit error:", err);
        enrichmentLog.push({ provider: "clearbit", fields_merged: [], data: {}, error: String(err) });
      }
    }

    // 3) Apollo
    if (providers.apollo?.enabled && providers.apollo?.api_key_ref) {
      try {
        const result = await tryApollo(providers.apollo.api_key_ref, linkedinUrl);
        enrichmentLog.push({ ...result, provider: "apollo" });
      } catch (err) {
        console.error("[enrich] Apollo error:", err);
        enrichmentLog.push({ provider: "apollo", fields_merged: [], data: {}, error: String(err) });
      }
    }

    // 4) Crunchbase / News
    if (providers.crunchbase?.enabled && providers.crunchbase?.api_key_ref) {
      try {
        const result = await tryCrunchbase(providers.crunchbase.api_key_ref, domain);
        enrichmentLog.push({ ...result, provider: "crunchbase" });
      } catch (err) {
        console.error("[enrich] Crunchbase error:", err);
        enrichmentLog.push({ provider: "crunchbase", fields_merged: [], data: {}, error: String(err) });
      }
    }

    if (providers.news_api?.enabled && providers.news_api?.api_key_ref) {
      try {
        const result = await tryNewsApi(providers.news_api.api_key_ref, companyName);
        enrichmentLog.push({ ...result, provider: "news_api" });
      } catch (err) {
        console.error("[enrich] NewsAPI error:", err);
        enrichmentLog.push({ provider: "news_api", fields_merged: [], data: {}, error: String(err) });
      }
    }

    // 5) Zywave
    if (providers.zywave?.enabled) {
      try {
        const result = await tryZywave(domain);
        enrichmentLog.push({ ...result, provider: "zywave" });
      } catch (err) {
        console.error("[enrich] Zywave error:", err);
        enrichmentLog.push({ provider: "zywave", fields_merged: [], data: {}, error: String(err) });
      }
    }

    // 6) Firecrawl website summary — always runs via existing company-scrape function
    // (not duplicated here; called separately from frontend or via useCompanyEnrich hook)

    // Write enrichment log to contact record
    if (contact_id && enrichmentLog.length > 0) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        results: enrichmentLog,
      };

      const existingLog = Array.isArray(contact?.enrichment_log) ? contact.enrichment_log : [];
      existingLog.push(logEntry);

      await supabase
        .from("contacts_le")
        .update({ enrichment_log: existingLog } as any)
        .eq("id", contact_id);
    }

    return new Response(JSON.stringify({
      success: true,
      enrichment_log: enrichmentLog,
      providers_checked: Object.entries(providers)
        .filter(([_, v]) => v.enabled)
        .map(([k]) => k),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Enrich contact error:", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
