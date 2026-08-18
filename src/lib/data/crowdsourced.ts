import { createAdminClient } from "@/lib/supabase/admin";

export type BuildingAgeBracket =
  | "vor_1949"
  | "1949_1990"
  | "1991_2010"
  | "nach_2010";

export const buildingAgeLabels: Record<BuildingAgeBracket, string> = {
  vor_1949: "Vor 1949 (Altbau)",
  "1949_1990": "1949 – 1990",
  "1991_2010": "1991 – 2010",
  nach_2010: "Nach 2010 (Neubau)",
};

/**
 * Mappt ein konkretes Baujahr auf den groberen Bracket, der in der
 * crowdsourced_rents-Tabelle gespeichert wird. Erlaubt der UI ein einziges
 * Baujahr-Feld statt zwei separaten Inputs.
 */
export function buildingYearToBracket(year: number): BuildingAgeBracket {
  if (year < 1949) return "vor_1949";
  if (year < 1991) return "1949_1990";
  if (year < 2011) return "1991_2010";
  return "nach_2010";
}

/**
 * Range a submitted rent has to fall into, in EUR per square metre.
 *
 * Berlin's 2024 Mietspiegel starts at 4.79 EUR/sqm, so 3 is below any real
 * tenancy; 60 is far above the priciest new-build. The point is not to
 * filter unusual rents — those are exactly what makes crowdsourced data
 * worth having — but to reject values that cannot be a rent at all, before
 * they reach a human reviewer. Mirrored in the RPC (migration 0016) so the
 * rule also holds if the action is bypassed.
 */
export const PLAUSIBLE_RENT_PER_SQM = { min: 3, max: 60 } as const;

export function isPlausibleRentPerSqm(eurPerSqm: number): boolean {
  return (
    Number.isFinite(eurPerSqm) &&
    eurPerSqm >= PLAUSIBLE_RENT_PER_SQM.min &&
    eurPerSqm <= PLAUSIBLE_RENT_PER_SQM.max
  );
}

interface SubmitArgs {
  districtId: string;
  sizeSqm: number;
  monthlyRentEur: number;
  buildingAgeBracket: BuildingAgeBracket | null;
}

export async function submitCrowdsourcedRent(args: SubmitArgs): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("submit_crowdsourced_rent", {
    p_district_id: args.districtId,
    p_size_sqm: args.sizeSqm,
    p_monthly_rent_eur: args.monthlyRentEur,
    p_building_age_bracket: args.buildingAgeBracket,
  });
  if (error) throw error;
  return data as string;
}
