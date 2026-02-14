// Dual 3-star system: Signal Stars + Reachability Stars + Priority Label

export type SignalSize = "large" | "medium" | "small" | null;

export interface SignalSizes {
  role_change_size: SignalSize;
  hiring_size: SignalSize;
  funding_size: SignalSize;
  csuite_size: SignalSize;
}

/**
 * Classify trigger signals into sizes for star computation.
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

// ─── Signal Stars (1-3) ───

export function computeSignalStars(signals: SignalSizes, reachReady: boolean): 1 | 2 | 3 {
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

export function computeReachStars(contacts?: any[], reason?: any): 0 | 1 | 2 | 3 {
  // Try from reason object first (server-computed)
  if (reason?.reach_stars !== undefined) return reason.reach_stars as 0 | 1 | 2 | 3;

  let hasEmail = false;
  let hasPhone = false;
  let hasLinkedIn = false;

  if (reason) {
    hasEmail = (reason.contact_email ?? 0) > 0;
    hasPhone = (reason.contact_phone ?? 0) > 0;
    hasLinkedIn = (reason.contact_linkedin ?? 0) > 0;
  }

  if (contacts && contacts.length > 0) {
    hasEmail = hasEmail || contacts.some((c: any) => c.email);
    hasPhone = hasPhone || contacts.some((c: any) => c.phone);
    hasLinkedIn = hasLinkedIn || contacts.some((c: any) => c.linkedin_url);
  }

  const count = [hasEmail, hasPhone, hasLinkedIn].filter(Boolean).length;
  if (count >= 3) return 3;
  if (count === 2) return 2;
  if (count === 1) return 1;
  return 0;
}

// ─── Get signal stars from reason or compute client-side ───

export function getSignalStars(reason: any, triggers: any, contacts?: any[]): 1 | 2 | 3 {
  if (reason?.signal_stars) return reason.signal_stars as 1 | 2 | 3;
  // Legacy field fallback
  if (reason?.stars) return reason.stars as 1 | 2 | 3;
  const signals = reason?.signals ?? classifySignals(triggers);
  const reachReady = contacts ? contacts.some((c: any) => c.email || c.phone) : (reason?.contact_email ?? 0) > 0 || (reason?.contact_phone ?? 0) > 0;
  return computeSignalStars(signals, reachReady);
}

// ─── Priority Label (based only on signal stars) ───

export type PriorityLevel = "High" | "Medium" | "Low";

export function getPriorityLabel(signalStars: 1 | 2 | 3): PriorityLevel {
  if (signalStars === 3) return "High";
  if (signalStars === 2) return "Medium";
  return "Low";
}

export function priorityBadgeColor(level: PriorityLevel): string {
  if (level === "High") return "bg-orange-500/15 text-orange-600 border-orange-500/30";
  if (level === "Medium") return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30";
  return "bg-muted text-muted-foreground border-border";
}

// ─── Display helpers ───

export function signalStarsDisplay(stars: 1 | 2 | 3): string {
  if (stars === 3) return "★★★";
  if (stars === 2) return "★★☆";
  return "★☆☆";
}

export function reachStarsDisplay(stars: 0 | 1 | 2 | 3): string {
  if (stars === 3) return "★★★";
  if (stars === 2) return "★★☆";
  if (stars === 1) return "★☆☆";
  return "☆☆☆";
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

  if (signals.role_change_size === "large" || signals.hiring_size === "large") {
    actions.push("push");
  }

  if (signals.role_change_size) actions.push("hr");
  if (signals.csuite_size) actions.push("cfo");
  if (signals.hiring_size) actions.push("growth");

  if (!actions.includes("hr")) actions.push("hr");
  if (!actions.includes("cfo")) actions.push("cfo");
  if (!actions.includes("push")) actions.push("push");
  actions.push("brief", "export");

  return actions;
}
