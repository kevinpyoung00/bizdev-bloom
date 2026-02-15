// Token system with fallback syntax: {{token | "fallback"}}
// Supports dot-path resolution for nested objects

export interface TokenContext {
  contact?: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    linkedin_url?: string;
    title?: string;
  };
  company?: {
    name?: string;
    domain?: string;
    industry_key?: string;
    industry_label?: string;
    hq_city?: string;
    hq_state?: string;
    employee_count?: string | number | null;
    renewal_month?: string;
    current_carrier?: string;
  };
  persona?: string | { name?: string; track?: string };
  signals?: {
    funding?: { stage?: string; days_ago?: number };
    hiring?: { jobs_60d?: number; intensity?: string };
    hr_change?: { title?: string; days_ago?: number };
    csuite?: { role?: string; days_ago?: number };
  };
  reach?: { hasEmail?: boolean; hasPhone?: boolean; hasLinkedIn?: boolean };
  // Legacy flat tokens for backward compat
  company_name?: string;
  industry_label?: string;
  hq_city?: string;
  hq_state?: string;
  employee_count?: number | null;
  renewal_month?: string;
  first_name?: string;
}

export function resolveTokens(template: string, ctx: TokenContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
    const parts = expr.split('|').map((p: string) => p.trim());
    const path = parts[0];
    const fallback = parts[1]?.replace(/^["']|["']$/g, '') || '';

    const value = resolvePath(ctx, path);
    if (value !== undefined && value !== null && value !== '') return String(value);
    return fallback;
  });
}

function resolvePath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[key];
  }, obj);
}
