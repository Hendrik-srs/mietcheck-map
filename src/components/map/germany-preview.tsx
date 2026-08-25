import Link from "next/link";
import type { FeatureCollection, Geometry } from "geojson";
import { ArrowRight } from "lucide-react";

import type { DistrictsOverview } from "@/lib/data/overview";
import {
  boundsOf,
  frameFor,
  svgBoundsOf,
  toPath,
  type Frame,
} from "@/lib/geo-projection";
import { rentToColor } from "@/lib/rent-color";

/**
 * Static preview of the map for the landing page.
 *
 * It is a link, not a second map: clicking anywhere goes to /karte, which
 * is the single interactive map. Earlier this component opened its own
 * full-screen viewer, which meant the hero image and the "Karte ansehen"
 * button led to two different places showing the same data.
 *
 * Rendered on the server as plain SVG — no map library, no tiles, visible
 * in the first paint.
 */

const VIEW_WIDTH = 1000;

type StatesCollection = FeatureCollection<Geometry, { id: string; name: string }>;

export function GermanyPreview({
  states,
  districts,
}: {
  states: StatesCollection;
  districts: DistrictsOverview;
}) {
  const stateFeatures = states.features ?? [];
  const districtFeatures = districts.features ?? [];
  if (stateFeatures.length === 0) return null;

  const frame: Frame = frameFor(
    boundsOf(stateFeatures.map((f) => f.geometry)),
    VIEW_WIDTH,
  );
  const berlinBox = svgBoundsOf(
    frame,
    districtFeatures.map((f) => f.geometry),
  );

  return (
    <Link
      href="/karte"
      aria-label="Zur interaktiven Karte"
      className="group relative block overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div
        className="w-full transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
        style={{ aspectRatio: `${VIEW_WIDTH} / ${frame.height}` }}
      >
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${frame.height.toFixed(1)}`}
          className="h-full w-full"
          role="img"
          aria-label="Karte von Deutschland, Berlin hervorgehoben"
        >
          {stateFeatures.map((feature, index) => (
            <path
              key={feature.properties?.id ?? index}
              d={toPath(frame, feature.geometry)}
              fill="var(--muted)"
              stroke="var(--background)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {districtFeatures.map((feature) => (
            <path
              key={String(feature.properties.id)}
              d={toPath(frame, feature.geometry)}
              fill={rentToColor(feature.properties.rent_median)}
              fillRule="evenodd"
              stroke="var(--background)"
              strokeWidth={0.6}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Ring so the eye finds Berlin at country scale. */}
          <circle
            cx={berlinBox.minX + berlinBox.width / 2}
            cy={berlinBox.minY + berlinBox.height / 2}
            r={Math.max(berlinBox.width, berlinBox.height) * 1.05}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            className="opacity-60"
          />
        </svg>
      </div>

      <span className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center gap-1.5 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-opacity duration-300 sm:opacity-0 sm:group-hover:opacity-100">
        Karte öffnen
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
