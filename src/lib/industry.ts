// Industry mapping for the five live industries

export const DEFAULT_INDUSTRIES: Record<string, string> = {
  biotech_life_sciences: 'Biotech & Life Sciences',
  tech_pst: 'Tech / Professional, Scientific & Technical',
  advanced_mfg_med_devices: 'Advanced Manufacturing & Medical Devices',
  healthcare_social_assistance: 'Healthcare & Social Assistance',
  higher_ed_nonprofit: 'Higher Education & Nonprofit',
  cannabis: 'Cannabis',
};

const INDUSTRY_PATTERNS: Record<string, RegExp> = {
  biotech_life_sciences: /biotech|life\s*science|pharma|biolog|genomic/i,
  tech_pst: /tech|software|saas|profession.*scientific.*technical|IT\s|information\s*tech|digital|computer/i,
  advanced_mfg_med_devices: /manufactur|medical\s*device|precision|aerospace|defense|industrial|fabricat/i,
  healthcare_social_assistance: /health\s*care|healthcare|hospital|clinic|social\s*(assistance|service)|elder|nurs/i,
  higher_ed_nonprofit: /higher\s*ed|university|college|nonprofit|non-profit|foundation|association|education/i,
  cannabis: /cannabis|marijuana|dispensar|hemp|weed|THC|CBD/i,
};

export function matchIndustryKey(rawIndustry?: string | null): string {
  if (!rawIndustry) return 'general_exec';
  for (const [key, pattern] of Object.entries(INDUSTRY_PATTERNS)) {
    if (pattern.test(rawIndustry)) return key;
  }
  return 'general_exec';
}

export function getIndustryLabel(key: string): string {
  return DEFAULT_INDUSTRIES[key] || 'General';
}
