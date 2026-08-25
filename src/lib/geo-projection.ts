import type { Geometry, Position } from "geojson";

/**
 * Minimal Web Mercator projection + SVG path helpers.
 *
 * Shared by every hand-rolled SVG map so they all sit in one coordinate
 * space — which is what lets the landing map zoom continuously from the
 * country outline down to Berlin's districts without re-projecting.
 */

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Both axes end up in degrees. Mixing degrees on x with radians on y is the
 * classic way to get a vertically squashed map; Mercator is conformal, so
 * with consistent units the aspect ratio needs no further correction.
 */
export function project(lon: number, lat: number): [number, number] {
  return [lon, -RAD_TO_DEG * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function ringsOf(geometry: Geometry): Position[][] {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

export function boundsOf(geometries: Geometry[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const geometry of geometries) {
    for (const ring of ringsOf(geometry)) {
      for (const [lon, lat] of ring) {
        const [x, y] = project(lon, lat);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

/** Maps projected coordinates into a fixed-width viewBox. */
export interface Frame {
  bounds: Bounds;
  width: number;
  height: number;
  scale: number;
}

export function frameFor(bounds: Bounds, width: number): Frame {
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  const scale = width / spanX;
  return { bounds, width, height: spanY * scale, scale };
}

export function toSvgPoint(frame: Frame, lon: number, lat: number): [number, number] {
  const [x, y] = project(lon, lat);
  return [(x - frame.bounds.minX) * frame.scale, (y - frame.bounds.minY) * frame.scale];
}

export function toPath(frame: Frame, geometry: Geometry, decimals = 1): string {
  return ringsOf(geometry)
    .map((ring) => {
      const points = ring.map(([lon, lat]) => {
        const [x, y] = toSvgPoint(frame, lon, lat);
        return `${x.toFixed(decimals)},${y.toFixed(decimals)}`;
      });
      return `M${points.join("L")}Z`;
    })
    .join(" ");
}

/**
 * Label anchor for a shape.
 *
 * Uses the bounding-box centre of the *largest* ring rather than a centroid
 * over all rings: for a MultiPolygon with an exclave, the combined centroid
 * can land outside the main body entirely, which is how Berlin's Pankow
 * ended up with its label floating in the wrong place on the interactive map.
 */
export function labelAnchor(frame: Frame, geometry: Geometry): [number, number] {
  const rings = ringsOf(geometry);
  if (rings.length === 0) return [0, 0];

  let largest = rings[0];
  let largestArea = -Infinity;
  for (const ring of rings) {
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    const absolute = Math.abs(area / 2);
    if (absolute > largestArea) {
      largestArea = absolute;
      largest = ring;
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [lon, lat] of largest) {
    const [x, y] = toSvgPoint(frame, lon, lat);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

/**
 * Removes MultiPolygon parts below a minimum area.
 *
 * Official boundary data carries surveying slivers — Berlin's Pankow ships
 * as four parts: the real 103 km² district plus fragments of roughly 200,
 * 20 and 4 m². MapLibre labels every part, and when tile simplification
 * collapses fragments that small the triangulation of the whole feature
 * fails, so the district loses its fill at some zoom levels.
 *
 * The database strips these on write (migration 0015); this is the client
 * side of the same guard, so the map renders correctly regardless of
 * whether that migration has been applied.
 *
 * Threshold is in square degrees: at Berlin's latitude 1 deg² is roughly
 * 7.5e9 m², so the default of 2e-6 is about 1.5 ha.
 */
export function dropSliverParts<G extends Geometry>(
  geometry: G,
  minArea = 2e-6,
): G {
  if (geometry.type !== "MultiPolygon") return geometry;

  const areaOf = (ring: Position[]) => {
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    return Math.abs(area / 2);
  };

  const kept = geometry.coordinates.filter((poly) => areaOf(poly[0]) >= minArea);
  // Never return an empty geometry: if every part is below the threshold the
  // shape is genuinely tiny, so keep it as it was.
  if (kept.length === 0 || kept.length === geometry.coordinates.length) return geometry;
  return { ...geometry, coordinates: kept };
}

/**
 * Label anchor in lon/lat, for callers without a projected frame.
 *
 * PostGIS supplies a proper ST_PointOnSurface anchor; this is the fallback
 * for when that column isn't populated yet. Uses the bounding-box centre of
 * the largest ring, which for a MultiPolygon with an exclave stays on the
 * main body — unlike a centroid over all parts.
 */
export function largestRingCenter(geometry: Geometry): [number, number] | null {
  const rings = ringsOf(geometry);
  if (rings.length === 0) return null;

  let largest = rings[0];
  let largestArea = -Infinity;
  for (const ring of rings) {
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    const absolute = Math.abs(area / 2);
    if (absolute > largestArea) {
      largestArea = absolute;
      largest = ring;
    }
  }

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of largest) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

/** Projected bounding box of a set of geometries, in viewBox units. */
export function svgBoundsOf(frame: Frame, geometries: Geometry[]) {
  const b = boundsOf(geometries);
  const [minX, minY] = [
    (b.minX - frame.bounds.minX) * frame.scale,
    (b.minY - frame.bounds.minY) * frame.scale,
  ];
  const [maxX, maxY] = [
    (b.maxX - frame.bounds.minX) * frame.scale,
    (b.maxY - frame.bounds.minY) * frame.scale,
  ];
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
