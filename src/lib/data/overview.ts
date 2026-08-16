import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

import { createStaticClient } from "@/lib/supabase/static";

/**
 * Landing-page data: real numbers straight from the database.
 *
 * Everything the landing page claims about coverage is derived here, so
 * the marketing copy can't drift away from what we actually ingested —
 * which matters more than usual for a project whose whole premise is
 * "every value is source-backed".
 */

export interface DistrictOverviewProperties {
  id: string;
  name: string;
  rent_median: number | null;
}

export type DistrictsOverview = FeatureCollection<
  Polygon | MultiPolygon,
  DistrictOverviewProperties
>;

export async function getDistrictsOverview(
  cityId: string,
): Promise<DistrictsOverview> {
  const supabase = createStaticClient();
  const { data, error } = await supabase.rpc("get_districts_overview", {
    p_city_id: cityId,
  });

  if (!error) return data as DistrictsOverview;

  // Fall back to the full-geometry RPC when the lightweight one isn't
  // available yet (migration 0013 not applied). Same shape, ~40x the
  // payload — correct but slower, which beats an empty landing page.
  console.warn(
    "[overview] get_districts_overview unavailable, falling back to get_districts_geojson:",
    error.message,
  );
  const { data: full, error: fullError } = await supabase.rpc(
    "get_districts_geojson",
    { p_city_id: cityId },
  );
  if (fullError) throw fullError;

  const collection = full as DistrictsOverview;
  return {
    type: "FeatureCollection",
    features: (collection.features ?? []).map((feature) => ({
      type: "Feature",
      id: feature.id,
      geometry: feature.geometry,
      properties: {
        id: feature.properties.id,
        name: feature.properties.name,
        rent_median: feature.properties.rent_median ?? null,
      },
    })),
  };
}

export interface LandingStats {
  bezirke: number;
  ortsteile: number;
  /** Address points carrying an official Wohnlage classification. */
  wohnlagenAddresses: number;
  /** Rows extracted from the official Mietspiegel table. */
  mietspiegelRows: number;
  /** Long-format rent observations across all districts and years. */
  rentDataPoints: number;
  /** Distinct registered data sources (drives the "n Quellen" claim). */
  sources: number;
  /** Earliest and latest year covered by rent observations. */
  yearFrom: number | null;
  yearTo: number | null;
}

/**
 * One round-trip per counter, but all of them are `head: true` count
 * queries (no rows transferred) and they run concurrently. Callers
 * prerender with a revalidate window, so this runs on rebuild rather than
 * per visitor.
 */
export async function getLandingStats(): Promise<LandingStats> {
  const supabase = createStaticClient();

  const countOf = async (
    table: string,
    filter?: { column: string; value: string },
  ): Promise<number> => {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) query = query.eq(filter.column, filter.value);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  };

  const [
    bezirke,
    ortsteile,
    wohnlagenAddresses,
    mietspiegelRows,
    rentDataPoints,
    sources,
    yearRange,
  ] = await Promise.all([
    countOf("districts", { column: "level", value: "bezirk" }),
    countOf("districts", { column: "level", value: "ortsteil" }),
    countOf("berlin_wohnlagen"),
    countOf("berlin_mietspiegel_2024"),
    countOf("rent_data_points"),
    countOf("data_sources"),
    (async () => {
      const [oldest, newest] = await Promise.all([
        supabase
          .from("rent_data_points")
          .select("period_end")
          .order("period_end", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("rent_data_points")
          .select("period_end")
          .order("period_end", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const toYear = (v: { period_end: string } | null) =>
        v?.period_end ? Number(v.period_end.slice(0, 4)) : null;
      return { from: toYear(oldest.data), to: toYear(newest.data) };
    })(),
  ]);

  return {
    bezirke,
    ortsteile,
    wohnlagenAddresses,
    mietspiegelRows,
    rentDataPoints,
    sources,
    yearFrom: yearRange.from,
    yearTo: yearRange.to,
  };
}
