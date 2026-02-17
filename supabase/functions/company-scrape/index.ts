const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { website, company } = await req.json();

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let formattedUrl = website?.trim() || "";

    // Step 0: If no website provided but company name given, discover it via Firecrawl search
    // Domains Firecrawl cannot scrape
    const BLOCKED_DOMAINS = [
      "facebook.com", "fb.com", "instagram.com", "twitter.com", "x.com",
      "tiktok.com", "linkedin.com", "youtube.com", "reddit.com", "pinterest.com",
      "yelp.com", "glassdoor.com", "indeed.com", "craigslist.org",
    ];

    const isBlockedUrl = (url: string): boolean => {
      try {
        const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
        return BLOCKED_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
      } catch { return false; }
    };

    if (!formattedUrl && company) {
      console.log("No website provided — searching for:", company);
      const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `${company} official website`,
          limit: 5,
        }),
      });
      const searchData = await searchResp.json();
      if (searchResp.ok && searchData.data?.length > 0) {
        // Pick the first non-blocked result URL
        const validResult = searchData.data.find((r: any) => r.url && !isBlockedUrl(r.url));
        if (validResult) {
          formattedUrl = validResult.url;
          console.log("Discovered website:", formattedUrl);
        } else {
          console.warn("All discovered URLs are blocked social media sites");
        }
      }
    }

    if (!formattedUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "No website URL provided and could not discover one" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping:", formattedUrl);

    // Step 1: Scrape website with Firecrawl
    const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeResp.json();

    if (!scrapeResp.ok) {
      console.error("Firecrawl error:", scrapeData);
      // Return 422 (not 500) for unsupported sites so callers can handle gracefully
      const errMsg = scrapeData.error || "Failed to scrape website";
      const isUnsupported = typeof errMsg === "string" && (errMsg.includes("do not support") || errMsg.includes("blocked"));
      return new Response(
        JSON.stringify({ success: false, error: isUnsupported ? `Site not supported by scraper: ${formattedUrl}` : errMsg }),
        { status: isUnsupported ? 422 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

    if (!markdown || markdown.length < 50) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not extract meaningful content from this website" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Summarize with AI
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({
          success: true,
          website: formattedUrl,
          summary: markdown.slice(0, 500),
          outreach_angles: [],
          raw_title: metadata.title || "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const truncated = markdown.slice(0, 6000);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a business intelligence analyst helping a benefits consultant understand a prospective company. Analyze the website content and produce a JSON response with:
1. "summary" — A 2-4 sentence company description covering what they do, who they serve, and their market position.
2. "key_facts" — An array of 3-6 short factual bullet points (products, services, locations, culture, recent news).
3. "outreach_angles" — An array of 2-4 specific angles a benefits/HR consultant could use to personalize outreach (e.g., growth indicators, workforce challenges, culture themes, expansion signals).
4. "pain_points" — An array of 2-3 likely HR/benefits pain points inferred from the company profile.

Respond with valid JSON only. No markdown, no backticks.`,
          },
          {
            role: "user",
            content: `Website: ${formattedUrl}\nTitle: ${metadata.title || "Unknown"}\n\nContent:\n${truncated}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);

      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          website: formattedUrl,
          summary: markdown.slice(0, 500),
          outreach_angles: [],
          key_facts: [],
          pain_points: [],
          raw_title: metadata.title || "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      parsed = {
        summary: markdown.slice(0, 500),
        outreach_angles: [],
        key_facts: [],
        pain_points: [],
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        website: formattedUrl,
        summary: parsed.summary || "",
        key_facts: parsed.key_facts || [],
        outreach_angles: parsed.outreach_angles || [],
        pain_points: parsed.pain_points || [],
        raw_title: metadata.title || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("company-scrape error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
