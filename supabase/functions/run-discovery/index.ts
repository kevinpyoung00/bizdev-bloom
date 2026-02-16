import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Geography helpers ───
const MA_NAMES = ["MA", "MASSACHUSETTS"];
const NE_STATES_SET = new Set(["CT", "RI", "NH", "ME", "VT"]);
const NE_FULL = new Set(["CONNECTICUT", "RHODE ISLAND", "NEW HAMPSHIRE", "MAINE", "VERMONT"]);

function normalizeState(s: string | null): string {
  if (!s) return "";
  return s.trim().toUpperCase();
}

function getGeoBucket(state: string): "MA" | "NE" | "US" {
  const s = normalizeState(state);
  if (MA_NAMES.includes(s)) return "MA";
  if (NE_STATES_SET.has(s) || NE_FULL.has(s)) return "NE";
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

  const abbrPattern = /([A-Z][a-zA-Z\s]{1,30}),\s*([A-Z]{2})\b/g;
  let match;
  while ((match = abbrPattern.exec(markdown)) !== null) {
    if (STATE_CODES.has(match[2])) {
      return { city: match[1].trim(), state: match[2], country: "US" };
    }
  }

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

  const hiringPatterns = [/(\d+)\+?\s*open\s*(positions|roles|jobs)/i, /join\s+our\s+team/i, /we['']re\s+hiring/i, /career\s+opportunities/i, /now\s+hiring/i, /job\s+openings/i];
  for (const p of hiringPatterns) {
    const m = markdown.match(p);
    if (m) { signals.open_roles_60d = m[1] ? parseInt(m[1]) : 5; break; }
  }

  const fundingPatterns = [/series\s+([a-e])/i, /raised\s+\$[\d,.]+\s*(million|m|billion|b)/i, /funding\s+round/i, /venture\s+funding/i, /capital\s+raise/i, /seed\s+round/i];
  for (const p of fundingPatterns) {
    const m = markdown.match(p);
    if (m) { signals.funding = { stage: m[1] ? `Series ${m[1].toUpperCase()}` : "Growth", months_ago: 3 }; break; }
  }

  const hrPatterns = [/chief\s+people\s+officer/i, /vp\s+(of\s+)?people/i, /chro/i, /vp\s+(of\s+)?human\s+resources/i, /head\s+of\s+people/i, /appointed/i, /names\s+new/i];
  for (const p of hrPatterns) {
    if (p.test(markdown)) { signals.hr_change = { recent: true, source: "website" }; break; }
  }

  const csuitePatterns = [/new\s+c[efo]o/i, /new\s+cto/i, /new\s+cio/i, /executive\s+appointment/i, /named?\s+(ceo|cfo|coo|cto|cio)/i, /promoted\s+to/i];
  for (const p of csuitePatterns) {
    if (p.test(markdown)) { signals.csuite_change = { recent: true, source: "website" }; break; }
  }

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

  const newsPatterns = [/announces/i, /press\s+release/i, /new\s+location/i, /expands\s+to/i, /partnership/i, /acquisition/i, /opens\s+new/i];
  for (const p of newsPatterns) {
    if (p.test(markdown)) { signals.news = { recent: true, source: "website" }; break; }
  }

  if (hrKeywords.length > 0) {
    const found = hrKeywords.filter(kw => lower.includes(kw.toLowerCase()));
    if (found.length > 0) {
      if (!signals.news) signals.news = {};
      signals.news.keywords = found;
      signals.news.source = "website";
    }
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
  if (triggers.news?.recent) reasons.push("strong_news");
  return { highIntent: reasons.length > 0, reasons };
}

// ─── ICP Classification ───
const CARRIER_PATTERNS = /\b(blue\s*cross|bcbs|bcbsma|point32health|tufts\s*health|harvard\s*pilgrim|aetna|cigna|united\s*health|uhc|anthem|humana|kaiser|umr|surest|oxford\s*health)\b/i;
const HOSPITAL_PATTERNS = /\b(hospital|medical\s*center|health\s*system|mass\s*general|brigham|beth\s*israel|lahey|steward\s*health|atrius|partners\s*health|dana[\s-]?farber)\b/i;
const UNIVERSITY_LAB_PATTERNS = /\b(broad\s*institute|wyss\s*institute|koch\s*institute|lincoln\s*lab|center\s+for\s+|department\s+of\s+|institute\s+of\s+|laboratory\s+of\s+)\b/i;
const PDF_PATTERNS = /\.(pdf|doc|docx|pptx?)$/i;
const SPAM_DOMAIN_PATTERNS = /\b(yelp\.com|glassdoor\.com|indeed\.com|crunchbase\.com|bloomberg\.com|bbb\.org|yellowpages|manta\.com|buzzfile|dnb\.com|zoominfo\.com|apollo\.io)\b/i;
const SOCIAL_DOMAINS = /\b(linkedin\.com|facebook\.com|twitter\.com|instagram\.com|youtube\.com|wikipedia\.org|tiktok\.com|reddit\.com)\b/i;

// ─── News/media domain list (signal-only, never create as employers) ───
const NEWS_MEDIA_DOMAINS = new Set([
  "bizjournals.com", "bostonglobe.com", "boston.com", "wbur.org", "wcvb.com",
  "masslive.com", "bostonherald.com", "statnews.com", "fiercebiotech.com",
  "fiercepharma.com", "biospace.com", "labiotech.eu", "techcrunch.com",
  "prnewswire.com", "businesswire.com", "globenewswire.com", "reuters.com",
  "wsj.com", "nytimes.com", "cnbc.com", "forbes.com", "inc.com",
  "wired.com", "theverge.com", "venturebeat.com", "axios.com",
  "patch.com", "wickedlocal.com", "nhpr.org", "vtdigger.org",
  "courant.com", "providencejournal.com", "pressherald.com",
  "capecodtimes.com", "gazettenet.com", "salemnews.com",
  "sentinelandenterprise.com", "lowellsun.com", "telegram.com",
  "southcoasttoday.com", "heraldnews.com", "tauntongazette.com",
  "patriotledger.com", "enterprisenews.com", "metrowestdailynews.com",
]);

// ─── Ecosystem/association/accelerator/VC patterns (signal-only) ───
const ECOSYSTEM_PATTERNS = /\b(massbio|mass\s*life\s*sciences|mlsc|mass\s*tech\s*collaborative|cambridge\s*innovation\s*center|cic|techstars|masschallenge|greentown\s*labs|incubator|accelerator|trade\s*association|industry\s*association|economic\s*development|chamber\s*of\s*commerce|massventures|mass\s*biomedical\s*initiatives|mbi|venture\s*capital|venture\s*fund|angel\s*fund|angel\s*investor|private\s*equity\s*firm|vc\s*fund|seed\s*fund|investment\s*fund|capital\s*partners|growth\s*equity|job\s*board|career\s*portal|staffing\s*portal)\b/i;

// ─── Generic non-employer page patterns ───
const GENERIC_PAGE_PATTERNS = /\b(greetings|boston\s+is\s+the\s+largest|top\s+\d+\s+(companies|employers|startups)|best\s+places\s+to\s+work|listicle|ranking|directory|award\s+winners)\b/i;

// ─── Path-only rejection patterns ───
const ARTICLE_PATH_PATTERNS = /\/(news|press|blog|article|story|post|publications?|resources|reports?|policies|policy|events?|webinar|podcast|newsletter|insights?|media|releases?|announcements?|awards?|rankings?)\b/i;

function isRootDomainUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.pathname === "/" || u.pathname === "" || u.pathname === "/index.html";
  } catch {
    return false;
  }
}

function isArticleOrResourcePath(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length > 2) return true;
    if (ARTICLE_PATH_PATTERNS.test(u.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

const CAREERS_PATH_PATTERNS = /\/(careers|jobs|employment|join-us|join|work-with-us|openings|hiring|positions|opportunities|team|about|contact|who-we-are)\b/i;

function isCareerOrAboutPath(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return CAREERS_PATH_PATTERNS.test(u.pathname);
  } catch {
    return false;
  }
}

function isNewsDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  for (const nd of NEWS_MEDIA_DOMAINS) {
    if (d === nd || d.endsWith("." + nd)) return true;
  }
  return false;
}

function extractEmployerName(markdown: string, fallbackTitle: string, domain: string): string | null {
  if (!markdown) return null;
  const orgMatch = markdown.match(/"@type"\s*:\s*"Organization"[^}]*"name"\s*:\s*"([^"]+)"/);
  if (orgMatch) return orgMatch[1].trim();
  const orgMatch2 = markdown.match(/"name"\s*:\s*"([^"]+)"[^}]*"@type"\s*:\s*"Organization"/);
  if (orgMatch2) return orgMatch2[1].trim();
  const ogMatch = markdown.match(/og:site_name[^"]*"([^"]+)"/i);
  if (ogMatch) return ogMatch[1].trim();
  if (fallbackTitle) {
    const cleaned = fallbackTitle.split(/[|–—\-:]/)[0].trim().replace(/\s*(Home|Homepage|Official Site|Welcome|Careers|Jobs|About|Contact)$/i, "").trim();
    if (cleaned.length > 2 && cleaned.length < 80) return cleaned;
  }
  return null;
}

function verifyEmployerEntity(markdown: string): boolean {
  if (!markdown || markdown.length < 100) return false;
  const hasOrgSchema = /"@type"\s*:\s*"Organization"/i.test(markdown);
  const hasCompanyName = /\b(inc|llc|co\b|corp|ltd|company|group)\b/i.test(markdown);
  const hasAbout = /\b(about\s+us|our\s+(company|team|mission|story))\b/i.test(markdown);
  const hasContact = /\b(contact\s+us|headquarters|office|address)\b/i.test(markdown);
  const hasCareers = /\b(careers|jobs|open\s+positions|join\s+(our|the)\s+team)\b/i.test(markdown);
  const hasProducts = /\b(products|services|solutions|our\s+work|what\s+we\s+do)\b/i.test(markdown);
  const score = [hasOrgSchema, hasCompanyName, hasAbout, hasContact, hasCareers, hasProducts].filter(Boolean).length;
  return score >= 2;
}

function isEcosystemOrg(name: string, domain: string, markdown: string): boolean {
  if (ECOSYSTEM_PATTERNS.test(name)) return true;
  if (ECOSYSTEM_PATTERNS.test(domain)) return true;
  if (markdown && ECOSYSTEM_PATTERNS.test(markdown.slice(0, 3000))) {
    const lower = markdown.slice(0, 3000).toLowerCase();
    if (/\b(member\s*organizations?|our\s*members|member\s*companies|industry\s*group|advocacy)\b/i.test(lower)) return true;
  }
  return false;
}

function isGenericPage(markdown: string): boolean {
  if (!markdown) return true;
  if (markdown.length < 200) return true;
  if (GENERIC_PAGE_PATTERNS.test(markdown.slice(0, 2000))) return true;
  return false;
}

function classifyIcp(
  name: string,
  domain: string,
  markdown: string,
  blacklistDomains: string[],
  blacklistNames: string[],
  toggles: { allow_edu: boolean; allow_gov: boolean; allow_hospital_systems: boolean; allow_university_research: boolean },
): string {
  const lowerName = name.toLowerCase();
  const lowerDomain = domain.toLowerCase();

  if (blacklistDomains.some(d => lowerDomain.includes(d.toLowerCase()))) return "excluded_carrier";
  if (blacklistNames.some(n => lowerName.includes(n.toLowerCase()))) return "excluded_carrier";
  if (CARRIER_PATTERNS.test(name) || CARRIER_PATTERNS.test(markdown.slice(0, 2000))) return "excluded_carrier";
  if (!toggles.allow_hospital_systems && (HOSPITAL_PATTERNS.test(name) || HOSPITAL_PATTERNS.test(markdown.slice(0, 2000)))) return "excluded_hospital";
  if (!toggles.allow_university_research && UNIVERSITY_LAB_PATTERNS.test(name)) return "excluded_university_lab";
  if (isEcosystemOrg(name, domain, markdown)) return "excluded_ecosystem";
  if (lowerDomain.endsWith(".edu") && !toggles.allow_edu) return "excluded_university_lab";
  if (lowerDomain.endsWith(".gov") && !toggles.allow_gov) return "excluded_generic";
  if (PDF_PATTERNS.test(domain)) return "excluded_pdf";
  if (SOCIAL_DOMAINS.test(domain) || SPAM_DOMAIN_PATTERNS.test(domain)) return "excluded_generic";
  if (isGenericPage(markdown) && !verifyEmployerEntity(markdown)) return "excluded_generic";

  return "employer";
}

// ─── Industry inference from page content ───
// Tight synonym sets for each industry key
const INDUSTRY_INFERENCE_MAP: Record<string, RegExp> = {
  "biotech_life_sciences": /\b(biotech|life\s*science|pharma|biolog|genomic|gene\s*therapy|cro\b|clinical\s*trial|drug\s*discovery|biologics|mrna|cell\s*therapy|precision\s*medicine|bioinformatics|proteomics|immunotherapy|biosimilar|reagent|diagnostics)\b/i,
  "tech_pst": /\b(saas|software|tech\s*company|information\s*technology|cybersecurity|fintech|edtech|healthtech|proptech|martech|cloud|ai\s*platform|data\s*analytics|devops|enterprise\s*software|iot|robotics\s*software)\b/i,
  "advanced_mfg_med_devices": /\b(manufactur|medical\s*device|medtech|precision\s*engineer|cnc|injection\s*mold|defense\s*contractor|aerospace|semiconductor|3d\s*print|additive\s*manufactur|industrial\s*automation)\b/i,
  "healthcare_social_assistance": /\b(urgent\s*care|dental\s*group|physical\s*therapy|home\s*health|mental\s*health|substance\s*abuse|hospice|primary\s*care|community\s*health|fqhc|health\s*center|clinic|surgical\s*center|telehealth|senior\s*care|assisted\s*living|behavioral\s*health)\b/i,
  "professional_services": /\b(accounting\s*firm|cpa\s*firm|law\s*firm|staffing\s*agency|marketing\s*agency|consulting|wealth\s*management|architecture\s*firm|engineering\s*consult|it\s*consult|management\s*consult|real\s*estate|professional\s*services)\b/i,
  "banks_cu": /\b(credit\s*union|community\s*bank|regional\s*bank|savings\s*bank|trust\s*company|banking|financial\s*institution|bank\b)\b/i,
  "cannabis": /\b(cannabis|marijuana|dispensar|cbd|hemp|cultivation|thc)\b/i,
  "education": /\b(school\s*district|charter\s*school|k-12|private\s*school|community\s*college|academy|education|learning\s*center)\b/i,
  "nonprofit": /\b(nonprofit|non-profit|501\s*c|ymca|boys\s*&?\s*girls|jcc|united\s*way|human\s*services|salvation\s*army|habitat|goodwill|foundation|charitable)\b/i,
  "municipal": /\b(municipal|town\s*of|city\s*of|\.gov|public\s*works|selectmen|town\s*hall|city\s*hall|department\s*of\s*public)\b/i,
  "logistics": /\b(logistics|freight|warehousing|supply\s*chain|trucking|shipping|transportation|3pl|last\s*mile)\b/i,
  "retail": /\b(retail|store|shop|boutique|e-commerce|ecommerce|consumer\s*goods|merchandise)\b/i,
  "hospitality": /\b(hotel|resort|restaurant|hospitality|catering|event\s*venue|inn\b|lodging)\b/i,
  "higher_ed_nonprofit": /\b(university|college|higher\s*ed|academic|faculty|campus)\b/i,
};

// Map user-selected industry labels to inference keys
const INDUSTRY_LABEL_TO_KEY: Record<string, string[]> = {
  "biotech": ["biotech_life_sciences"],
  "life sciences": ["biotech_life_sciences"],
  "pharmaceuticals": ["biotech_life_sciences"],
  "genomics": ["biotech_life_sciences"],
  "technology": ["tech_pst"],
  "saas": ["tech_pst"],
  "software": ["tech_pst"],
  "it services": ["tech_pst"],
  "manufacturing": ["advanced_mfg_med_devices"],
  "medical devices": ["advanced_mfg_med_devices"],
  "precision engineering": ["advanced_mfg_med_devices"],
  "healthcare": ["healthcare_social_assistance"],
  "clinics": ["healthcare_social_assistance"],
  "medical providers": ["healthcare_social_assistance"],
  "behavioral health": ["healthcare_social_assistance"],
  "community health center": ["healthcare_social_assistance"],
  "professional services": ["professional_services"],
  "consulting": ["professional_services"],
  "financial services": ["professional_services", "banks_cu"],
  "insurance brokerage": ["professional_services"],
  "bank": ["banks_cu"],
  "credit union": ["banks_cu"],
  "cannabis": ["cannabis"],
  "any": [], // wildcard
};

function inferIndustryKey(name: string, domain: string, markdown: string): string | null {
  const text = (name + " " + domain + " " + (markdown || "").slice(0, 4000)).toLowerCase();
  for (const [key, pattern] of Object.entries(INDUSTRY_INFERENCE_MAP)) {
    if (pattern.test(text)) return key;
  }
  return null;
}

function resolveSelectedIndustryKeys(selectedIndustries: string[]): Set<string> {
  const keys = new Set<string>();
  for (const sel of selectedIndustries) {
    const lower = sel.toLowerCase();
    // Direct key match
    if (INDUSTRY_INFERENCE_MAP[lower]) { keys.add(lower); continue; }
    // Label-to-key map
    const mapped = INDUSTRY_LABEL_TO_KEY[lower];
    if (mapped) { for (const k of mapped) keys.add(k); continue; }
    // Fuzzy: check if any key contains the selected string
    for (const key of Object.keys(INDUSTRY_INFERENCE_MAP)) {
      if (key.includes(lower) || lower.includes(key.split("_")[0])) { keys.add(key); break; }
    }
  }
  return keys;
}

// ─── Subtype classifier for kept employers ───
function classifySubtype(name: string, domain: string, md: string): string {
  const lower = (name + " " + domain + " " + md.slice(0, 2000)).toLowerCase();
  if (/\b(bank|credit\s*union|savings\s*bank|trust\s*company)\b/.test(lower)) return "bank_cu";
  if (/\b(cannabis|marijuana|dispensary|cbd|hemp|cultivation)\b/.test(lower)) return "cannabis";
  if (/\b(ymca|boys\s*&?\s*girls|jcc|united\s*way|nonprofit|non-profit|501\s*c|human\s*services|salvation\s*army|habitat|goodwill)\b/.test(lower)) return "nonprofit";
  if (/\b(municipal|town\s*of|city\s*of|\.gov)\b/.test(lower)) return "municipal";
  if (/\b(school\s*district|charter\s*school|k-12|academy|community\s*college|private\s*school)\b/.test(lower)) return "school";
  if (/\b(community\s*health|fqhc|health\s*center|clinic)\b/.test(lower)) return "clinic";
  return "private";
}

// ─── Rotating themes ───
interface DayTheme {
  key: string; label: string; industries: string[]; subSectors: string[];
}

const DAY_THEMES: Record<number, DayTheme> = {
  1: {
    key: "biotech_life_sciences", label: "Life Sciences / Biotech",
    industries: ["biotech", "life sciences", "pharmaceuticals", "genomics"],
    subSectors: ["gene therapy", "CRO", "contract research", "diagnostics", "clinical trials", "drug discovery", "biologics", "mRNA", "cell therapy", "precision medicine", "bioinformatics", "proteomics", "immunotherapy", "biosimilars", "reagents", "independent lab"],
  },
  2: {
    key: "tech_pst", label: "Tech / SaaS",
    industries: ["technology", "SaaS", "software", "IT services"],
    subSectors: ["cybersecurity", "fintech", "edtech", "healthtech", "proptech", "martech", "cloud infrastructure", "AI platform", "data analytics", "DevOps", "enterprise software", "B2B SaaS", "IoT platform", "robotics software", "cannabis tech"],
  },
  3: {
    key: "advanced_mfg_med_devices", label: "Manufacturing / Med Devices",
    industries: ["manufacturing", "medical devices", "precision engineering"],
    subSectors: ["medtech engineering", "CNC machining", "injection molding", "electronics manufacturing", "defense contractor", "aerospace parts", "semiconductor equipment", "clean energy manufacturing", "industrial automation", "3D printing", "additive manufacturing", "quality systems", "cannabis packaging", "cannabis equipment"],
  },
  4: {
    key: "healthcare_social_assistance", label: "Healthcare / Clinics / Providers",
    industries: ["healthcare", "clinics", "medical providers", "behavioral health", "community health center"],
    subSectors: ["urgent care", "dental group", "physical therapy", "home health", "mental health", "substance abuse treatment", "hospice", "primary care network", "community health center", "FQHC", "surgical center", "radiology group", "telehealth", "senior care", "assisted living"],
  },
  5: {
    key: "professional_services", label: "Professional Services / Financial Services",
    industries: ["professional services", "consulting", "financial services", "insurance brokerage", "bank", "credit union"],
    subSectors: ["accounting firm", "law firm", "staffing agency", "marketing agency", "wealth management", "private equity", "venture capital", "architecture firm", "engineering consulting", "IT consulting", "management consulting", "real estate", "credit union", "community bank", "regional bank"],
  },
  6: {
    key: "hiring_sweep", label: "Hiring Velocity Sweep",
    industries: ["any"],
    subSectors: ["rapid growth", "scaling company", "talent acquisition", "mass hiring", "workforce expansion", "new office", "high growth startup", "cannabis dispensary hiring", "nonprofit careers", "school district employment", "municipal jobs"],
  },
  0: {
    key: "trigger_sweep", label: "Leadership / Funding / Carrier Triggers",
    industries: ["any"],
    subSectors: ["executive transition", "funding round", "benefits renewal", "carrier change", "M&A activity", "IPO preparation"],
  },
};

const GEO_TERMS = [
  "Boston", "Cambridge", "Worcester", "Waltham", "Lowell", "Andover",
  "New Bedford", "Springfield", "North Shore MA", "South Shore MA",
  "Cape Cod", "Western Massachusetts", "Central Massachusetts",
  "Framingham", "Quincy", "Newton", "Somerville", "Brockton",
  "Needham", "Burlington MA", "Lexington MA", "Bedford MA",
  "Route 128 corridor", "MetroWest",
];

const NE_GEO_TERMS = [
  "Hartford CT", "New Haven CT", "Stamford CT", "Providence RI",
  "Portland ME", "Manchester NH", "Burlington VT", "Nashua NH",
];

const TRIGGER_KEYWORDS: Record<string, string[]> = {
  funding: ["raises $", "Series A", "Series B", "Series C", "funding round", "venture funding", "growth equity", "capital raise", "seed round"],
  hr_leader: ["Chief People Officer", "VP People", "CHRO", "VP Human Resources", "Head of People", "appointed", "names new", "hires"],
  csuite: ["new CEO", "new CFO", "new COO", "new CTO", "new CIO", "executive appointment", "promoted to", "names new CEO"],
  carrier_change: ["switches benefits carrier", "Point32Health", "Harvard Pilgrim", "Tufts Health Plan", "BCBS", "UHC", "Aetna", "Cigna", "Anthem", "Humana", "UMR", "Surest", "benefits renewal"],
  hiring: ["we're hiring", "open roles", "careers", "join our team", "now hiring", "job openings", "career opportunities"],
  pr_news: ["announces", "press release", "opens", "expands", "new location", "partnership", "acquisition"],
};

const QUERY_TEMPLATES = [
  "{geo} {industry} company",
  "{geo} {subsector}",
  "Massachusetts {industry} {trigger}",
  "Boston MA {subsector} {trigger}",
  "HQ Massachusetts {industry}",
  "{industry} company careers MA",
  "{geo} {industry} about us",
  "{subsector} company {geo} contact",
  "{industry} {trigger} Massachusetts",
  "New England {subsector} company",
  "school district employment Massachusetts",
  "nonprofit careers Massachusetts",
  "community health center jobs Massachusetts",
  "credit union careers Massachusetts",
  "cannabis dispensary jobs Massachusetts",
  "cannabis cultivation hiring Massachusetts",
  "{geo} employer {industry}",
  "municipality careers {geo}",
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function buildQueries(params: {
  industries?: string[];
  triggers?: string[];
  geoTerms?: string[];
  subSectors?: string[];
  maxQueries?: number;
}): string[] {
  const { industries = [], triggers = [], geoTerms = GEO_TERMS, subSectors = [], maxQueries = 10 } = params;
  const queries: Set<string> = new Set();

  const geos = pickRandom(geoTerms, 5);
  const subs = pickRandom(subSectors, 4);
  const triggerKeys = triggers.length > 0 ? triggers : pickRandom(Object.keys(TRIGGER_KEYWORDS), 2);
  const triggerTerms: string[] = [];
  for (const tk of triggerKeys) {
    const terms = TRIGGER_KEYWORDS[tk] || [];
    triggerTerms.push(...pickRandom(terms, 2));
  }

  const templates = pickRandom(QUERY_TEMPLATES, Math.min(maxQueries + 2, QUERY_TEMPLATES.length));
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

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function canonicalize(name: string): string {
  return name
    .replace(/\b(inc|llc|co|corp|ltd|limited|corporation|company|group|holdings|plc|lp|llp|pllc|pc|pa|dba|enterprises)\b\.?/gi, "")
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
    const mode = body.mode || "auto";
    const manualParams = body.params || {};
    const overrideMaNe = body.override_ma_ne || false;

    // ─── Load discovery settings ───
    const { data: settingsRows } = await supabase.from("discovery_settings").select("key, value");
    const settings: Record<string, any> = {};
    for (const row of settingsRows || []) settings[row.key] = row.value;

    const blacklistDomains: string[] = settings.blacklist_domains || [];
    const blacklistNames: string[] = settings.blacklist_names || [];
    const toggles = settings.toggles || { allow_edu: true, allow_gov: false, allow_hospital_systems: false, allow_university_research: false };
    const sweepSize = typeof settings.sweep_size === "number" ? settings.sweep_size : (typeof settings.sweep_size === "string" ? parseInt(settings.sweep_size) : 300);
    const candidateCap = body.candidate_cap || sweepSize;

    // Load signal keywords from DB
    const { data: kwRows } = await supabase.from("signal_keywords").select("category, keywords");
    const kwMap: Record<string, string[]> = {};
    for (const row of kwRows || []) {
      kwMap[(row as any).category] = (row as any).keywords as string[] ?? [];
    }
    const carrierNames = kwMap["carrier_names"] ?? [];
    const carrierPhrases = kwMap["carrier_change_phrases"] ?? [];
    const hrKeywords = kwMap["benefits_hr_keywords"] ?? [];

    // ─── 30-day repeat suppression: load recent domains/canonicals ───
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: existingAccounts } = await supabase
      .from("accounts")
      .select("id, domain, canonical_company_name, name, created_at, triggers");
    const existingDomains = new Set<string>();
    const existingCanonicals = new Map<string, string>();
    const existingTitles = new Set<string>();
    // Track recently created accounts for repeat suppression
    const recentDomains = new Set<string>();
    const recentCanonicals = new Set<string>();

    for (const a of existingAccounts || []) {
      if (a.domain) existingDomains.add(a.domain.toLowerCase());
      if (a.canonical_company_name) existingCanonicals.set(a.canonical_company_name.toLowerCase(), a.id);
      if (a.name) existingTitles.add(normalizeTitle(a.name));
      // Check if created within last 30 days (for repeat suppression)
      if (a.created_at && new Date(a.created_at) >= thirtyDaysAgo) {
        if (a.domain) recentDomains.add(a.domain.toLowerCase());
        if (a.canonical_company_name) recentCanonicals.add(a.canonical_company_name.toLowerCase());
      }
    }

    function normalizeTitle(t: string): string {
      return t.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\b(the|and|of|for|in|at|to|a|an|is|are|was|were|inc|llc|corp|ltd|co)\b/g, "").replace(/\s+/g, " ").trim();
    }

    // ─── Resolve selected industries for manual mode ───
    let selectedIndustryKeys: Set<string> | null = null;
    if (mode === "manual" && manualParams.industries && manualParams.industries.length > 0) {
      const hasWildcard = manualParams.industries.some((i: string) => i.toLowerCase() === "any");
      if (!hasWildcard) {
        selectedIndustryKeys = resolveSelectedIndustryKeys(manualParams.industries);
        console.log(`Manual mode: selected industry keys = ${Array.from(selectedIndustryKeys).join(", ")}`);
      }
    }

    // ─── Build queries based on mode ───
    let queries: string[];
    let geoTerms = [...GEO_TERMS, ...pickRandom(NE_GEO_TERMS, 3)];
    let themeLabel = "manual";

    if (mode === "manual") {
      const industries = manualParams.industries || ["company"];
      const triggers = manualParams.triggers || [];
      const geoStates = manualParams.geography || ["MA"];
      if (geoStates.length > 0 && !(geoStates.length === 1 && geoStates[0] === "MA")) {
        geoTerms = geoStates.map((s: string) => s);
      }
      const resultCount = manualParams.result_count || 50;
      queries = buildQueries({
        industries,
        triggers,
        geoTerms,
        subSectors: manualParams.sub_sectors || industries,
        maxQueries: Math.min(Math.ceil(resultCount / 3), 20),
      });
    } else {
      const dayOfWeek = new Date().getDay();
      const theme = DAY_THEMES[dayOfWeek] || DAY_THEMES[1];
      themeLabel = theme.label;
      console.log(`Auto-discovery: ${theme.label} (day ${dayOfWeek})`);
      queries = buildQueries({
        industries: theme.industries,
        subSectors: theme.subSectors,
        geoTerms,
        maxQueries: 12,
      });
    }

    // ─── Firecrawl Search for net-new domains ───
    const candidateDomains: Map<string, { url: string; title: string; description: string }> = new Map();
    const searchErrors: string[] = [];
    let rejectedCarrier = 0, rejectedHospital = 0, rejectedUniversityLab = 0;
    let rejectedPdf = 0, rejectedGeneric = 0, rejectedUnknownHq = 0;
    let rejectedNewsDomain = 0, rejectedPathOnly = 0, rejectedEcosystem = 0;
    let rejectedIndustryMismatch = 0;
    let rejectedRepeat30d = 0;

    if (firecrawlKey) {
      for (const query of queries) {
        if (candidateDomains.size >= candidateCap) break;
        try {
          const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ query, limit: 8 }),
          });
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            for (const result of searchData.data || []) {
              const url = result.url || "";
              const domain = extractDomain(url);
              if (!domain) continue;

              if (existingDomains.has(domain)) continue;
              if (SOCIAL_DOMAINS.test(domain) || SPAM_DOMAIN_PATTERNS.test(domain)) continue;

              if (isNewsDomain(domain)) { rejectedNewsDomain++; continue; }
              if (PDF_PATTERNS.test(url)) { rejectedPdf++; continue; }

              if (!isRootDomainUrl(url) && isArticleOrResourcePath(url) && !isCareerOrAboutPath(url)) {
                rejectedPathOnly++;
                continue;
              }

              if (!candidateDomains.has(domain)) {
                candidateDomains.set(domain, {
                  url: `https://${domain}`,
                  title: result.title || "",
                  description: result.description || "",
                });
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
      console.log("No FIRECRAWL_API_KEY — enriching existing accounts only");
    }

    console.log(`Found ${candidateDomains.size} candidate domains from ${queries.length} queries`);

    // ─── Scrape ROOT DOMAIN + HQ + ICP + industry match + create accounts ───
    let candidatesCreated = 0;
    let candidatesUpdated = 0;
    let hqMA = 0;
    let hqNE = 0;
    let discardedNonNE = 0;
    const scrapeErrors: string[] = [];
    const keptCandidates: any[] = [];
    const keptBySubtype: Record<string, number> = {};
    const keptByIndustry: Record<string, number> = {};

    const CONCURRENCY = 5;
    const SCRAPE_TIMEOUT_MS = 8000;
    const domainEntries = Array.from(candidateDomains.entries()).slice(0, candidateCap);

    async function scrapeDomain(domain: string, info: { url: string; title: string; description: string }) {
      let markdown = "";
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
        const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: `https://${domain}`, formats: ["markdown"], onlyMainContent: false }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (scrapeResp.ok) {
          const scrapeData = await scrapeResp.json();
          markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
        }
      } catch (e) {
        scrapeErrors.push(`${domain}: ${e.message?.includes("abort") ? "timeout" : e.message}`);
        return null;
      }

      const employerName = extractEmployerName(markdown, info.title, domain);
      if (!employerName) return { rejected: "excluded_generic" };
      if (!verifyEmployerEntity(markdown)) return { rejected: "excluded_generic" };

      const companyName = employerName;
      const icpClass = classifyIcp(companyName, domain, markdown, blacklistDomains, blacklistNames, toggles);
      if (icpClass !== "employer") return { rejected: icpClass };

      const hq = extractHqState(markdown);
      if (!hq.state || !hq.country) return { rejected: "unknown_hq" };
      if (hq.country !== "US") return { rejected: "non_ne" };

      const bucket = getGeoBucket(hq.state);
      if (!overrideMaNe && bucket === "US") return { rejected: "non_ne" };

      const signals = detectSignalsFromContent(markdown, carrierNames, carrierPhrases, hrKeywords);
      const { highIntent, reasons: intentReasons } = isHighIntent(signals);
      const canonical = canonicalize(companyName);

      // Infer industry for filtering
      const inferredIndustry = inferIndustryKey(companyName, domain, markdown);

      return { companyName, domain, hq, bucket, signals, highIntent, intentReasons, canonical, markdown, inferredIndustry };
    }

    // Process in batches of CONCURRENCY
    for (let i = 0; i < domainEntries.length; i += CONCURRENCY) {
      const batch = domainEntries.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(([domain, info]) => scrapeDomain(domain, info))
      );

      for (const result of results) {
        if (result.status === "rejected" || !result.value) continue;
        const val = result.value;

        if ("rejected" in val) {
          const reason = val.rejected as string;
          if (reason === "excluded_carrier") rejectedCarrier++;
          else if (reason === "excluded_hospital") rejectedHospital++;
          else if (reason === "excluded_university_lab") rejectedUniversityLab++;
          else if (reason === "excluded_pdf") rejectedPdf++;
          else if (reason === "excluded_ecosystem") rejectedEcosystem++;
          else if (reason === "unknown_hq") rejectedUnknownHq++;
          else if (reason === "non_ne") discardedNonNE++;
          else rejectedGeneric++;
          continue;
        }

        const { companyName, domain, hq, bucket, signals, highIntent, intentReasons, canonical, markdown: scrapedMarkdown, inferredIndustry } = val;

        // ── GUARD: Industry-must-match for manual runs ──
        if (selectedIndustryKeys && selectedIndustryKeys.size > 0) {
          if (!inferredIndustry || !selectedIndustryKeys.has(inferredIndustry)) {
            rejectedIndustryMismatch++;
            continue;
          }
        }

        // ── GUARD: 30-day repeat suppression ──
        // Only suppress if already in DB AND created <30d ago AND no new strong signals
        if (recentDomains.has(domain.toLowerCase()) || recentCanonicals.has(canonical)) {
          const hasNewStrongSignal = !!(signals.funding || signals.hr_change || signals.csuite_change || signals.carrier_change || (signals.open_roles_60d && signals.open_roles_60d >= 8));
          if (!hasNewStrongSignal) {
            rejectedRepeat30d++;
            continue;
          }
        }

        if (bucket === "MA") hqMA++;
        else if (bucket === "NE") hqNE++;

        // Stronger dedupe: domain → canonical → normalized title
        const normTitle = normalizeTitle(companyName);
        if (existingTitles.has(normTitle)) continue;
        const existingId = existingCanonicals.get(canonical);
        if (existingId) {
          if (Object.keys(signals).length > 0) {
            await supabase.from("accounts").update({
              triggers: signals,
              geography_bucket: bucket,
              hq_state: hq.state,
              hq_city: hq.city,
              hq_country: hq.country || "US",
              icp_class: "employer",
              high_intent: highIntent,
              high_intent_reason: intentReasons.join(",") || null,
            } as any).eq("id", existingId);
            candidatesUpdated++;
          }
          continue;
        }

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
          icp_class: "employer",
          high_intent: highIntent,
          high_intent_reason: intentReasons.join(",") || null,
          industry: inferredIndustry || null,
        } as any).select("id, name, domain, hq_state, geography_bucket").single();

        if (insertErr) {
          scrapeErrors.push(`${domain}: insert failed - ${insertErr.message}`);
          continue;
        }

        candidatesCreated++;
        existingDomains.add(domain);
        existingCanonicals.set(canonical, newAccount.id);
        existingTitles.add(normTitle);

        const subtype = classifySubtype(companyName, domain, scrapedMarkdown || "");
        keptBySubtype[subtype] = (keptBySubtype[subtype] || 0) + 1;
        if (inferredIndustry) {
          keptByIndustry[inferredIndustry] = (keptByIndustry[inferredIndustry] || 0) + 1;
        }

        keptCandidates.push({
          id: newAccount.id,
          name: companyName,
          domain,
          hq_state: hq.state,
          geography_bucket: bucket,
          high_intent: highIntent,
          intent_reasons: intentReasons,
          top_signal: Object.keys(signals)[0] || null,
          icp_class: "employer",
          entity_subtype: subtype,
          inferred_industry: inferredIndustry,
        });
      }
    }

    // ─── Diversity caps enforcement ───
    // Max 40% life sciences; ensure ≥10% for each selected industry (manual) or present category (auto)
    const LIFE_SCI_CAP = 0.4;
    const MIN_CATEGORY_PCT = 0.1;
    const totalKept = keptCandidates.length;
    const lifeSciKeys = new Set(["biotech_life_sciences"]);
    const lifeSciCount = Object.entries(keptByIndustry)
      .filter(([k]) => lifeSciKeys.has(k))
      .reduce((sum, [, v]) => sum + v, 0);
    const lifeSciPct = totalKept > 0 ? lifeSciCount / totalKept : 0;

    // Identify under-represented categories that need micro-query fill
    const underRepresented: string[] = [];
    if (totalKept > 0) {
      const targetKeys = selectedIndustryKeys && selectedIndustryKeys.size > 0
        ? Array.from(selectedIndustryKeys)
        : Object.keys(keptByIndustry);
      for (const key of targetKeys) {
        const count = keptByIndustry[key] || 0;
        if (count / totalKept < MIN_CATEGORY_PCT && !lifeSciKeys.has(key)) {
          underRepresented.push(key);
        }
      }
    }

    // Advisory: log diversity metrics (actual micro-query fill would require another search pass,
    // which we implement if firecrawlKey is available and there are under-represented categories)
    let microQueryFills = 0;
    if (firecrawlKey && underRepresented.length > 0 && totalKept > 5) {
      console.log(`Diversity fill needed for: ${underRepresented.join(", ")}`);
      // Run one micro-query per under-represented industry (max 3)
      for (const industryKey of underRepresented.slice(0, 3)) {
        const industryLabel = Object.entries(INDUSTRY_INFERENCE_MAP).find(([k]) => k === industryKey)?.[0] || industryKey;
        const microQuery = `Massachusetts ${industryLabel.replace(/_/g, " ")} company employer`;
        try {
          const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ query: microQuery, limit: 5 }),
          });
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            for (const result of searchData.data || []) {
              const url = result.url || "";
              const domain = extractDomain(url);
              if (!domain || existingDomains.has(domain) || candidateDomains.has(domain)) continue;
              if (SOCIAL_DOMAINS.test(domain) || SPAM_DOMAIN_PATTERNS.test(domain) || isNewsDomain(domain)) continue;
              // Quick add as candidate for this industry
              candidateDomains.set(domain, { url: `https://${domain}`, title: result.title || "", description: result.description || "" });
              microQueryFills++;
            }
          }
        } catch (e) {
          searchErrors.push(`Micro-query error for ${industryKey}: ${e.message}`);
        }
      }
      if (microQueryFills > 0) {
        console.log(`Diversity micro-queries added ${microQueryFills} new candidates`);
      }
    }

    const diversityMetrics = {
      life_sci_pct: totalKept > 0 ? Math.round(lifeSciPct * 100) : 0,
      life_sci_over_cap: lifeSciPct > LIFE_SCI_CAP,
      subtypes: { ...keptBySubtype },
      by_industry: { ...keptByIndustry },
      under_represented: underRepresented,
      micro_query_fills: microQueryFills,
    };

    // ─── Audit log ───
    const summary = {
      mode,
      theme: mode === "auto" ? themeLabel : "manual",
      queries_run: queries.length,
      domains_found: candidateDomains.size,
      candidates_created: candidatesCreated,
      candidates_updated: candidatesUpdated,
      hq_MA: hqMA,
      hq_NE: hqNE,
      discarded_non_NE: discardedNonNE,
      rejected_carrier: rejectedCarrier,
      rejected_hospital: rejectedHospital,
      rejected_university_lab: rejectedUniversityLab,
      rejected_pdf: rejectedPdf,
      rejected_generic: rejectedGeneric,
      rejected_unknown_hq: rejectedUnknownHq,
      rejected_news_domain: rejectedNewsDomain,
      rejected_path_only: rejectedPathOnly,
      rejected_ecosystem: rejectedEcosystem,
      rejected_industry_mismatch: rejectedIndustryMismatch,
      rejected_repeat_30d: rejectedRepeat30d,
      kept_candidates: keptCandidates.length,
      kept_by_subtype: keptBySubtype,
      kept_by_industry: keptByIndustry,
      diversity: diversityMetrics,
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
      preview_candidates: keptCandidates,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("run-discovery error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
