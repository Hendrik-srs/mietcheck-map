import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

import { createStaticClient } from "@/lib/supabase/static";

export interface RentHistoryPoint {
  period_end: string;
  value_median: number;
  sample_size: number | null;
}

export interface DistrictProperties {
  id: string;
  name: string;
  level: "bezirk" | "ortsteil" | "plz";
  /**
   * Explicit label anchor from PostGIS (ST_PointOnSurface of the largest
   * part). Labels are drawn from a separate point source rather than the
   * polygons, because MapLibre places one symbol per polygon *part* — a
   * district with an exclave would otherwise be labelled twice.
   */
  label_lon: number | null;
  label_lat: number | null;
  rent_median: number | null;
  rent_sample_size: number | null;
  rent_period_start: string | null;
  rent_period_end: string | null;
  rent_metric: string | null;
  rent_source_id: string | null;
  rent_source_name: string | null;
  rent_source_publisher: string | null;
  rent_source_url: string | null;
  rent_history: RentHistoryPoint[];
}

export type DistrictsFeatureCollection = FeatureCollection<
  Polygon | MultiPolygon,
  DistrictProperties
>;

export async function getDistrictsGeoJSON(
  cityId: string,
): Promise<DistrictsFeatureCollection> {
  const supabase = createStaticClient();
  const { data, error } = await supabase.rpc("get_districts_geojson", {
    p_city_id: cityId,
  });
  if (error) throw error;
  return data as DistrictsFeatureCollection;
}
