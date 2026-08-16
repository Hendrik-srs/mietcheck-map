import Link from "next/link";
import type { Position } from "geojson";

import type { DistrictsOverview } from "@/lib/data/overview";
import { rentToColor } from "@/lib/rent-color";
import { bezirkSlugForName } from "@/lib/slugs";

/**
 * Berlin choropleth as a plain server-rendered SVG.
 *
 * Deliberately not MapLibre: the landing page should show the product in
 * the first paint, with no map library, no tile requests and no client
 * JavaScript at all. Each district is a real <a>, so the map doubles as
 * internal linking to the /bezirk/[slug] pages and works without JS.
 *
 * Colours come from the shared scale in lib/rent-color, which is the same
 * source the interactive map's MapLibre paint expression uses.
 */

const VIEW_WIDTH = 1000;

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Web Mercator, matching what the interactive map projects with.
 *
 * Both axes must end up in the same unit or the shape gets squashed: x is
 * longitude in degrees, so the latitude term is converted from radians to
 * degrees too. Mercator is conformal, so with consistent units the aspect
 * ratio comes out right without any extra correction.
 */
function project(lon: number, lat: number): [number, number] {
  return [lon, -RAD_TO_DEG * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
}

type Ring = Position[];

function ringsOf(geometry: DistrictsOverview["features"][number]["geometry"]): Ring[] {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeBounds(features: DistrictsOverview["features"]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const feature of features) {
    for (const ring of ringsOf(feature.geometry)) {
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

export function BerlinHeroMap({ districts }: { districts: DistrictsOverview }) {
  const features = districts.features ?? [];
  if (features.length === 0) return null;

  const bounds = computeBounds(features);
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  if (!(spanX > 0) || !(spanY > 0)) return null;

  // Preserve aspect ratio: width is fixed, height follows the projection.
  const viewHeight = (VIEW_WIDTH * spanY) / spanX;
  const scale = VIEW_WIDTH / spanX;

  const toPath = (geometry: DistrictsOverview["features"][number]["geometry"]) =>
    ringsOf(geometry)
      .map((ring) => {
        const points = ring.map(([lon, lat]) => {
          const [x, y] = project(lon, lat);
          return `${((x - bounds.minX) * scale).toFixed(1)},${(
            (y - bounds.minY) * scale
          ).toFixed(1)}`;
        });
        return `M${points.join("L")}Z`;
      })
      .join(" ");

  // Sorted cheapest-first so the caller can show a ranked list alongside.
  const ranked = [...features]
    .filter((f) => typeof f.properties.rent_median === "number")
    .sort((a, b) => (b.properties.rent_median ?? 0) - (a.properties.rent_median ?? 0));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight.toFixed(1)}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Karte der 12 Berliner Bezirke, eingefärbt nach Median-Angebotsmiete"
      >
        <g>
          {features.map((feature) => {
            const { id, name, rent_median: rentMedian } = feature.properties;
            const slug = bezirkSlugForName(name);
            const label = `${name}${
              typeof rentMedian === "number"
                ? `, ${rentMedian.toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                  })} Euro pro Quadratmeter`
                : ", keine Daten"
            }`;
            // No <title> child for the tooltip: React 19 treats <title> as
            // hoistable document metadata and moves it into <head> on the
            // client, which breaks hydration inside an <svg>. aria-label
            // carries the same information for assistive tech, and the
            // ranked list beside the map shows the values visually.
            const path = (
              <path
                d={toPath(feature.geometry)}
                fill={rentToColor(rentMedian)}
                fillRule="evenodd"
                stroke="var(--background)"
                strokeWidth={2}
                strokeLinejoin="round"
                className="transition-[filter,opacity] duration-200 hover:opacity-90 hover:[filter:brightness(1.08)]"
              />
            );
            // A native SVG <a>, not next/link: inside an <svg> the anchor
            // belongs to the SVG namespace.
            return slug ? (
              <a key={id} href={`/bezirk/${slug}`} aria-label={label}>
                {path}
              </a>
            ) : (
              <g key={id} aria-label={label}>
                {path}
              </g>
            );
          })}
        </g>
      </svg>

      {ranked.length > 0 && (
        <ol className="grid gap-1.5 text-sm">
          {ranked.map((feature) => {
            const { id, name, rent_median: rentMedian } = feature.properties;
            const slug = bezirkSlugForName(name);
            const row = (
              <>
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: rentToColor(rentMedian) }}
                />
                <span className="truncate">{name}</span>
                <span className="ml-auto shrink-0 font-medium tabular-nums">
                  {rentMedian?.toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                    €/m²
                  </span>
                </span>
              </>
            );
            return (
              <li key={id}>
                {slug ? (
                  <Link
                    href={`/bezirk/${slug}`}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    {row}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2.5 px-2 py-1.5">{row}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
