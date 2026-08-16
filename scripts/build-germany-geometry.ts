/**
 * Build-time data prep: German federal states as a small, checked-in GeoJSON.
 *
 * Source: Eurostat GISCO, NUTS 2024, level 1 (which for Germany is exactly
 * the 16 Bundesländer).
 *   https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics
 *
 * These outlines are context, not data: the landing map uses them to show
 * where Berlin sits and which states are still empty. They never change, so
 * a checked-in file beats a database table and a runtime query.
 *
 * Run with:
 *   npx tsx scripts/build-germany-geometry.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";

const NUTS_URL =
  "https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_10M_2024_4326_LEVL_1.geojson";

const OUT_PATH = join(process.cwd(), "src/lib/data/germany-states.json");

/** Douglas-Peucker tolerance in degrees. ~0.01° ≈ 1 km, plenty for a
 *  country-level outline that renders a few hundred pixels wide. */
const TOLERANCE = 0.012;

/** Perpendicular distance from point to the line segment a–b. */
function perpendicularDistance(p: Position, a: Position, b: Position): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + clamped * dx), py - (ay + clamped * dy));
}

function simplifyRing(ring: Position[], tolerance: number): Position[] {
  if (ring.length <= 4) return ring;

  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;

  // Iterative Douglas-Peucker to avoid deep recursion on long coastlines.
  const stack: Array<[number, number]> = [[0, ring.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const distance = perpendicularDistance(ring[i], ring[start], ring[end]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (maxDistance > tolerance && index !== -1) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  const simplified = ring.filter((_, i) => keep[i] === 1);
  // A polygon ring needs at least 4 positions (closed): bail out to the
  // original rather than emitting something invalid.
  if (simplified.length < 4) return ring;
  // Keep the ring closed after filtering.
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push([...first]);
  return simplified;
}

/** Drops islands/exclaves below an area threshold to keep the file small. */
function ringArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area / 2);
}

const MIN_RING_AREA = 0.0015; // ~ a few km²; removes tiny offshore specks

function simplifyGeometry(geometry: Geometry): Geometry | null {
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates
      .map((r) => simplifyRing(r, TOLERANCE))
      .filter((r, i) => i === 0 || ringArea(r) >= MIN_RING_AREA);
    if (ringArea(rings[0]) < MIN_RING_AREA) return null;
    return { type: "Polygon", coordinates: rings };
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates
      .map((poly) => poly.map((r) => simplifyRing(r, TOLERANCE)))
      .filter((poly) => ringArea(poly[0]) >= MIN_RING_AREA);
    if (polygons.length === 0) return null;
    return { type: "MultiPolygon", coordinates: polygons };
  }
  return geometry;
}

function round(geometry: Geometry, decimals = 4): Geometry {
  const factor = 10 ** decimals;
  const fix = (p: Position): Position => [
    Math.round(p[0] * factor) / factor,
    Math.round(p[1] * factor) / factor,
  ];
  if (geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: geometry.coordinates.map((r) => r.map(fix)) };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((poly) => poly.map((r) => r.map(fix))),
    };
  }
  return geometry;
}

interface NutsProperties {
  NUTS_ID: string;
  CNTR_CODE: string;
  NAME_LATN: string;
}

async function main() {
  console.log(`Fetching ${NUTS_URL} ...`);
  const res = await fetch(NUTS_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching NUTS level 1`);
  const fc = (await res.json()) as FeatureCollection<Geometry, NutsProperties>;

  const german = fc.features.filter((f) => f.properties.CNTR_CODE === "DE");
  console.log(`  -> ${german.length} German states of ${fc.features.length} NUTS-1 regions`);
  if (german.length !== 16) {
    throw new Error(`Expected 16 Bundesländer, got ${german.length}`);
  }

  const features: Feature[] = [];
  for (const feature of german) {
    const simplified = simplifyGeometry(feature.geometry);
    if (!simplified) {
      console.warn(`  ! ${feature.properties.NAME_LATN} collapsed, skipping`);
      continue;
    }
    features.push({
      type: "Feature",
      properties: {
        id: feature.properties.NUTS_ID,
        name: feature.properties.NAME_LATN,
      },
      geometry: round(simplified),
    });
  }

  features.sort((a, b) =>
    String(a.properties?.name).localeCompare(String(b.properties?.name), "de"),
  );

  const out: FeatureCollection = { type: "FeatureCollection", features };
  const json = JSON.stringify(out);
  writeFileSync(OUT_PATH, `${json}\n`);

  console.log(`\nWrote ${OUT_PATH}`);
  console.log(`  ${features.length} states, ${(json.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
