import { NextResponse } from "next/server";

/**
 * Address suggestions for the Fairness-Check, proxied.
 *
 * Photon (Komoot) is an OpenStreetMap-based geocoder built for
 * type-ahead — unlike Nominatim, which explicitly asks not to be used for
 * autocomplete. Same data, same ODbL licence as the geocoder we already
 * use for the final lookup.
 *
 * It runs through our own route rather than straight from the browser so
 * that the visitor's IP and their half-typed address never reach a third
 * party. That costs one extra hop; the debounce in the client matters far
 * more for perceived speed.
 */

const PHOTON_URL = "https://photon.komoot.io/api/";
/** Berlin bounding box — suggestions outside it are noise for now. */
const BERLIN_BBOX = "13.088,52.338,13.761,52.676";
const BERLIN_CENTER = { lat: "52.52", lon: "13.405" };

export interface AddressSuggestion {
  /**
   * A full address ("Sonnenallee 100, 12045 Berlin") or, while the house
   * number is still missing, the street on its own. Streets are offered
   * because that is what people type first — without them the list stays
   * empty until the very last characters.
   */
  kind: "address" | "street";
  label: string;
  /** Neighbourhood and postcode, shown as secondary text. */
  context: string | null;
  /**
   * Only set for full addresses. A street's coordinates would point at its
   * midpoint, which is the wrong building for a Wohnlage lookup, so those
   * are left out and the server geocodes the completed address instead.
   */
  lat: number | null;
  lon: number | null;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    osm_key?: string;
  };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  // Below three characters every query matches half the city.
  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("lat", BERLIN_CENTER.lat);
  url.searchParams.set("lon", BERLIN_CENTER.lon);
  url.searchParams.set("bbox", BERLIN_BBOX);
  url.searchParams.set("lang", "de");
  url.searchParams.set("limit", "8");

  let features: PhotonFeature[] = [];
  try {
    const response = await fetch(url, {
      headers: { "Accept-Language": "de" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { features?: PhotonFeature[] };
    features = body.features ?? [];
  } catch (error) {
    console.error("[adress-vorschlaege]", error);
    // A failing suggestion service must not block the form: the user can
    // still type the address by hand and the server geocodes on submit.
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }

  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];

  for (const feature of features) {
    const p = feature.properties;
    const context = [p.district, p.postcode].filter(Boolean).join(" · ") || null;

    if (p.street && p.housenumber) {
      const label = [
        `${p.street} ${p.housenumber}`,
        [p.postcode, p.city ?? "Berlin"].filter(Boolean).join(" "),
      ].join(", ");
      // Photon returns the plain address and any POI at it as separate hits.
      if (seen.has(label)) continue;
      seen.add(label);
      suggestions.push({
        kind: "address",
        label,
        context,
        lon: feature.geometry.coordinates[0],
        lat: feature.geometry.coordinates[1],
      });
    } else if (p.osm_key === "highway" && p.name) {
      // A street: offered so the list is useful before the number is typed.
      const key = `${p.name}|${p.postcode ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push({
        kind: "street",
        label: p.name,
        context,
        lat: null,
        lon: null,
      });
    }

    if (suggestions.length >= 6) break;
  }

  // Full addresses first: they are what the check actually needs.
  suggestions.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "address" ? -1 : 1));

  return NextResponse.json(
    { suggestions },
    // Same prefix typed again within the minute is common; let the edge
    // absorb it without another upstream call.
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
