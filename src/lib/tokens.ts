// Token system with fallback syntax: {{token | "fallback"}}

export interface TokenContext {
  company_name?: string;
  industry_label?: string;
  hq_city?: string;
  hq_state?: string;
  employee_count?: number | null;
  renewal_month?: string;
  first_name?: string;
  signals?: {
    funding?: { stage?: string; days_ago?: number };
    hiring?: { jobs_60d?: number; intensity?: string };
    hr_change?: { title?: string; days_ago?: number };
    csuite?: { role?: string; days_ago?: number };
  };
  persona?: { name?: string; track?: string };
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
