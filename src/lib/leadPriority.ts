// Star priority + signal helpers shared between queue list and drawer

export type SignalSize = "large" | "medium" | "small" | null;

export interface SignalSizes {
  role_change_size: SignalSize;
  hiring_size: SignalSize;
  funding_size: SignalSize;
  csuite_size: SignalSize;
}

/**
 * Classify trigger signals into sizes for star computation.
 * Mirrors server-side logic so stars work client-side on reason.signals too.
 */
export function classifySignals(triggers: any): SignalSizes {
  const result: SignalSizes = { role_change_size: null, hiring_size: null, funding_size: null, csuite_size: null };
  if (!triggers) return result;

  const rc = triggers.recent_role_changes ?? triggers.non_csuite_role_changes;
  if (rc) {
    const items = Array.isArray(rc) ? rc : [rc];
    const HR_KW = ["hr", "human resources", "benefits", "people ops", "people operations", "finance", "controller", "payroll"];
    let bestDays = 999;
    for (const item of items) {
      const combined = `${(item.title || "").toLowerCase()} ${(item.department || "").toLowerCase()}`;
      if (HR_KW.some((kw) => combined.includes(kw))) bestDays = Math.min(bestDays, item.days_ago ?? 999);
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

  // C-suite — never Large, at most Medium
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

export function computeStars(signals: SignalSizes, reachReady: boolean): 1 | 2 | 3 {
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

/** Get stars from the reason object (server-computed) or fallback to client computation */
export function getStars(reason: any, triggers: any, contacts?: any[]): 1 | 2 | 3 {
  if (reason?.stars) return reason.stars as 1 | 2 | 3;
  const signals = reason?.signals ?? classifySignals(triggers);
  const reachReady = contacts ? contacts.some((c: any) => c.email || c.phone) : (reason?.reachability ?? 0) >= 12;
  return computeStars(signals, reachReady);
}

export function starsDisplay(stars: 1 | 2 | 3): string {
  if (stars === 3) return "★★★";
  if (stars === 2) return "★★☆";
  return "★☆☆";
}

export function starsLabel(stars: 1 | 2 | 3): string {
  if (stars === 3) return "High";
  if (stars === 2) return "Medium";
  return "Low";
}

export function starsColor(stars: 1 | 2 | 3): string {
  if (stars === 3) return "text-amber-500";
  if (stars === 2) return "text-amber-400";
  return "text-muted-foreground";
}

/** Build a short signal summary string for table rows */
export function signalSummary(triggers: any): string {
  if (!triggers) return "—";
  const parts: string[] = [];

  const rc = triggers.recent_role_changes ?? triggers.non_csuite_role_changes;
  if (rc) {
    const items = Array.isArray(rc) ? rc : [rc];
    const HR_KW = ["hr", "human resources", "benefits", "people ops", "people operations", "finance", "controller", "payroll"];
    for (const item of items) {
      const combined = `${(item.title || "").toLowerCase()} ${(item.department || "").toLowerCase()}`;
      if (HR_KW.some((kw) => combined.includes(kw))) {
        const d = item.days_ago ?? null;
        parts.push(`Role Δ ${d != null ? d + "d" : ""}`);
        break;
      }
    }
  }

  const cs = triggers.c_suite_changes ?? triggers.leadership_changes;
  if (cs) parts.push("C-Suite Δ");

  const openRoles = triggers.open_roles_60d ?? triggers.hiring_velocity ?? 0;
  if (openRoles >= 3) parts.push(`Hiring ${openRoles}`);

  const funding = triggers.funding ?? triggers.expansion ?? triggers.funding_expansion;
  if (funding) parts.push("Funding");

  return parts.length > 0 ? parts.join(" · ") : "—";
}

/** Build detailed signal text for the drawer */
export function signalDetails(triggers: any): string[] {
  if (!triggers) return [];
  const lines: string[] = [];

  const rc = triggers.recent_role_changes ?? triggers.non_csuite_role_changes;
  if (rc) {
    const items = Array.isArray(rc) ? rc : [rc];
    for (const item of items) {
      const d = item.days_ago ?? "?";
      lines.push(`Role Change: ${item.title || "Unknown"} — ${d} days ago`);
    }
  }

  const cs = triggers.c_suite_changes ?? triggers.leadership_changes;
  if (cs && typeof cs === "object" && cs !== true) {
    const mo = cs.months_ago ?? cs.recency_months ?? "?";
    const role = cs.title || cs.role || "Leadership";
    lines.push(`C-Suite: ${role} change — ${mo} months ago`);
  } else if (cs) {
    lines.push("C-Suite: Leadership change detected");
  }

  const openRoles = triggers.open_roles_60d ?? triggers.hiring_velocity ?? 0;
  if (openRoles > 0) lines.push(`Hiring: ${openRoles} open roles in last 60 days`);

  const funding = triggers.funding ?? triggers.expansion ?? triggers.funding_expansion;
  if (funding) {
    if (typeof funding === "object" && funding.months_ago != null) {
      lines.push(`Funding/Expansion: ${funding.months_ago} months ago`);
    } else {
      lines.push("Funding/Expansion: Detected");
    }
  }

  return lines;
}

/** Determine action order based on signal priority */
export function getActionOrder(triggers: any): ("hr" | "cfo" | "growth" | "brief" | "push" | "export")[] {
  const signals = classifySignals(triggers);
  const actions: ("hr" | "cfo" | "growth" | "brief" | "push" | "export")[] = [];

  // Push & claim first if any strong signal
  if (signals.role_change_size === "large" || signals.hiring_size === "large") {
    actions.push("push");
  }

  // Signal-driven email priority
  if (signals.role_change_size) actions.push("hr");
  if (signals.csuite_size) actions.push("cfo");
  if (signals.hiring_size) actions.push("growth");

  // Fill remaining
  if (!actions.includes("hr")) actions.push("hr");
  if (!actions.includes("cfo")) actions.push("cfo");
  if (!actions.includes("push")) actions.push("push");
  actions.push("brief", "export");

  return actions;
}
