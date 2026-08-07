import type { OptionCost } from "@/lib/db/seed-data/events";

// Shared between the event detail page (option gating/labels) and the
// rail's "Can you afford it?" block (components/team-rail.tsx) so both
// read the same affordability rule off the same OptionCost shape.
export interface OwnRegionResources {
  fundRemaining: number;
  ppeDaysRemaining: number;
  antiviralsRemaining: number;
}

export function formatCost(cost: OptionCost | undefined): string {
  if (!cost) return "No direct resource cost.";
  const parts: string[] = [];
  if (cost.fund) parts.push(`$${cost.fund.toLocaleString()}`);
  if (cost.ppeDays) parts.push(`${cost.ppeDays} PPE-days`);
  if (cost.antivirals) parts.push(`${cost.antivirals.toLocaleString()} antiviral doses`);
  return parts.length > 0 ? `Costs ${parts.join(" + ")}.` : "No direct resource cost.";
}

export function affordabilityIssue(cost: OptionCost | undefined, resources: OwnRegionResources | undefined): string | null {
  if (!cost || !resources) return null;
  if (cost.fund && resources.fundRemaining < cost.fund) {
    return `Requires $${cost.fund.toLocaleString()} — you have $${resources.fundRemaining.toLocaleString()}.`;
  }
  if (cost.ppeDays && resources.ppeDaysRemaining < cost.ppeDays) {
    return `Requires ${cost.ppeDays} PPE-days — you have ${resources.ppeDaysRemaining}.`;
  }
  if (cost.antivirals && resources.antiviralsRemaining < cost.antivirals) {
    return `Requires ${cost.antivirals.toLocaleString()} antiviral doses — you have ${resources.antiviralsRemaining.toLocaleString()}.`;
  }
  return null;
}
