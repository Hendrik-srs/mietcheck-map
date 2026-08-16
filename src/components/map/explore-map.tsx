"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FeatureCollection, Geometry } from "geojson";
import { Expand, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";

import type { DistrictsOverview } from "@/lib/data/overview";
import {
  boundsOf,
  frameFor,
  labelAnchor,
  svgBoundsOf,
  toPath,
  type Frame,
} from "@/lib/geo-projection";
import { rentToColor } from "@/lib/rent-color";
import { bezirkSlugForName } from "@/lib/slugs";

/**
 * The landing page's map.
 *
 * Collapsed it shows Germany with Berlin marked — the honest picture of
 * where the project stands. Clicking opens a full-screen view that then
 * zooms into Berlin's districts. Both views are the same SVG in the same
 * projected coordinate space, so zooming is one CSS transform on a single
 * <g> rather than a swap between two different maps.
 *
 * Deliberately not MapLibre: this is the first thing a visitor sees, and it
 * renders from markup already present in the HTML — no tiles, no map
 * library, nothing to wait for.
 */

const VIEW_WIDTH = 1000;
/** How much of the frame Berlin fills once zoomed in. */
const ZOOM_FILL = 0.82;
/** Keep in sync with the transform transition below. */
const ZOOM_MS = 900;

type StatesCollection = FeatureCollection<Geometry, { id: string; name: string }>;

interface Shape {
  key: string;
  name: string;
  path: string;
  anchor: [number, number];
}

interface DistrictShape extends Shape {
  slug: string | null;
  rentMedian: number | null;
}

const EUR = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function ExploreMap({
  states,
  districts,
}: {
  states: StatesCollection;
  districts: DistrictsOverview;
}) {
  // `open` controls the overlay; `zoomed` drives the camera. They're
  // separate so the overlay can fade in still showing Germany and only
  // then fly to Berlin — a single combined state would snap. Once open,
  // the toggle lets you pull back out to the country view.
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const model = useMemo(() => {
    const stateFeatures = states.features ?? [];
    const districtFeatures = districts.features ?? [];

    // One frame for everything: Germany defines the coordinate space and
    // Berlin's districts are placed inside it.
    const frame: Frame = frameFor(
      boundsOf(stateFeatures.map((f) => f.geometry)),
      VIEW_WIDTH,
    );

    const stateShapes: Shape[] = stateFeatures.map((feature, index) => ({
      key: feature.properties?.id ?? `state-${index}`,
      name: feature.properties?.name ?? "",
      path: toPath(frame, feature.geometry),
      anchor: labelAnchor(frame, feature.geometry),
    }));

    const districtShapes: DistrictShape[] = districtFeatures.map((feature) => ({
      key: String(feature.properties.id),
      name: feature.properties.name,
      path: toPath(frame, feature.geometry),
      anchor: labelAnchor(frame, feature.geometry),
      slug: bezirkSlugForName(feature.properties.name),
      rentMedian: feature.properties.rent_median,
    }));

    const berlinBox = svgBoundsOf(
      frame,
      districtFeatures.map((f) => f.geometry),
    );
    return { frame, stateShapes, districtShapes, berlinBox };
  }, [states, districts]);

  const { frame, stateShapes, districtShapes, berlinBox } = model;

  const ranked = useMemo(
    () =>
      [...districtShapes].sort(
        (a, b) => (b.rentMedian ?? -Infinity) - (a.rentMedian ?? -Infinity),
      ),
    [districtShapes],
  );

  /**
   * How much of the viewBox the overlay actually shows.
   *
   * The viewBox is portrait (Germany) but the overlay is usually landscape,
   * so `preserveAspectRatio` letterboxes it: the visible width is smaller
   * than 1000 user units. Zooming against the raw viewBox would leave Berlin
   * filling barely half the screen, so measure the container and zoom
   * against the region that is genuinely on screen.
   */
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    const element = mapBoxRef.current;
    if (!element || !open) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setViewport({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  const camera = useMemo(() => {
    const viewBoxAspect = frame.width / frame.height;
    // Guard against a zero-height container: the ratio would be Infinity,
    // the scale would follow, and an invalid transform silently resolves to
    // identity — the overlay opens but never zooms.
    const measured =
      viewport && viewport.width > 0 && viewport.height > 0
        ? viewport.width / viewport.height
        : viewBoxAspect;
    const containerAspect = Number.isFinite(measured) ? measured : viewBoxAspect;

    // Letterboxing: whichever axis is constrained decides how many user
    // units are visible along the other one.
    const visibleWidth =
      containerAspect > viewBoxAspect ? frame.height * containerAspect : frame.width;
    const visibleHeight =
      containerAspect > viewBoxAspect ? frame.height : frame.width / containerAspect;

    const rawScale = Math.min(
      (visibleWidth * ZOOM_FILL) / berlinBox.width,
      (visibleHeight * ZOOM_FILL) / berlinBox.height,
    );
    const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
    // The SVG is centred in its box, so the viewBox centre is the screen
    // centre — translating against it puts Berlin in the middle.
    return {
      scale,
      x: frame.width / 2 - scale * (berlinBox.minX + berlinBox.width / 2),
      y: frame.height / 2 - scale * (berlinBox.minY + berlinBox.height / 2),
    };
  }, [frame, berlinBox, viewport]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    // Let the overlay paint at zoom 1 before flying in, otherwise the
    // browser collapses both states into one frame and the zoom snaps.
    // A timer rather than requestAnimationFrame: rAF is throttled to a halt
    // in a backgrounded tab, which would leave the overlay stuck on the
    // country view until it regains focus.
    window.setTimeout(() => setZoomed(true), 32);
  }, []);

  const handleClose = useCallback(() => {
    setZoomed(false);
    window.setTimeout(() => setOpen(false), ZOOM_MS * 0.55);
  }, []);

  // Escape to close, and stop the page behind the overlay from scrolling.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, handleClose]);

  /**
   * One renderer for both views. `interactive` is false for the static
   * panel on the page, so only the overlay carries links and zoom state.
   */
  const renderMap = (interactive: boolean) => {
    const isZoomed = interactive && zoomed;
    const labelScale = isZoomed ? 1 / camera.scale : 1;
    // The small panel renders at roughly a third of the overlay's size, where
    // sixteen state labels would be illegible noise. Only the overlay, which
    // has room for them, gets labels at all.
    const showLabels = interactive;

    return (
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${frame.height.toFixed(1)}`}
        className="h-full w-full"
        role="img"
        aria-label={
          isZoomed
            ? "Karte der Berliner Bezirke, eingefärbt nach Median-Angebotsmiete"
            : "Karte von Deutschland, Berlin hervorgehoben"
        }
      >
        <g
          style={{
            transform: isZoomed
              ? `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`
              : "translate(0px, 0px) scale(1)",
            transformOrigin: "0px 0px",
            transition: `transform ${ZOOM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
          className="motion-reduce:!transition-none"
        >
          {/* Federal states — context, and the roadmap made visible. */}
          <g
            style={{
              opacity: isZoomed ? 0.1 : 1,
              transition: "opacity 700ms ease",
            }}
          >
            {stateShapes.map((shape) => (
              <path
                key={shape.key}
                d={shape.path}
                fill="var(--muted)"
                stroke="var(--background)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>

          {/* Berlin's districts, drawn in place inside the country frame. */}
          <g>
            {districtShapes.map((shape) => {
              const path = (
                <path
                  d={shape.path}
                  fill={rentToColor(shape.rentMedian)}
                  fillRule="evenodd"
                  stroke="var(--background)"
                  strokeWidth={isZoomed ? 1.5 : 0.6}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="transition-[filter] duration-200 hover:[filter:brightness(1.08)]"
                />
              );
              return isZoomed && shape.slug ? (
                <a
                  key={shape.key}
                  href={`/bezirk/${shape.slug}`}
                  aria-label={`${shape.name}${
                    shape.rentMedian != null
                      ? `, ${EUR.format(shape.rentMedian)} Euro pro Quadratmeter`
                      : ""
                  }`}
                >
                  {path}
                </a>
              ) : (
                <g key={shape.key}>{path}</g>
              );
            })}
          </g>

          {/* State labels while zoomed out. They fade fast: at full zoom
              they are magnified 11x, so lingering means giant words sweeping
              across the frame mid-flight. */}
          {showLabels && (
            <g
              style={{ opacity: isZoomed ? 0 : 1, transition: "opacity 180ms ease" }}
              className="pointer-events-none"
            >
              {stateShapes.map((shape) => (
                <text
                  key={shape.key}
                  x={shape.anchor[0]}
                  y={shape.anchor[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[15px] font-medium"
                >
                  {shape.name}
                </text>
              ))}
            </g>
          )}

          {/* District labels once zoomed in, counter-scaled to stay legible. */}
          <g
            style={{
              opacity: isZoomed ? 1 : 0,
              transition: `opacity 350ms ease ${isZoomed ? "500ms" : "0ms"}`,
            }}
            className="pointer-events-none"
            aria-hidden={!isZoomed}
          >
            {showLabels && districtShapes.map((shape) => (
              <g
                key={shape.key}
                transform={`translate(${shape.anchor[0]} ${shape.anchor[1]}) scale(${labelScale})`}
              >
                <text
                  textAnchor="middle"
                  className="fill-foreground text-[13px] font-semibold"
                  style={{
                    paintOrder: "stroke",
                    stroke: "var(--background)",
                    strokeWidth: 3,
                    strokeLinejoin: "round",
                  }}
                >
                  {shape.name}
                </text>
                {shape.rentMedian != null && (
                  <text
                    y={15}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[11px] tabular-nums"
                    style={{
                      paintOrder: "stroke",
                      stroke: "var(--background)",
                      strokeWidth: 3,
                      strokeLinejoin: "round",
                    }}
                  >
                    {EUR.format(shape.rentMedian)} €/m²
                  </text>
                )}
              </g>
            ))}
          </g>
        </g>

        {/* Ring around Berlin while zoomed out, so the eye finds it. */}
        <g
          style={{ opacity: isZoomed ? 0 : 1, transition: "opacity 250ms ease" }}
          className="pointer-events-none"
        >
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
        </g>
      </svg>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Karte vergrößern und nach Berlin zoomen"
        aria-expanded={open}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div
          className="w-full transition-transform duration-500 ease-out group-hover:scale-[1.015] motion-reduce:transition-none"
          style={{ aspectRatio: `${VIEW_WIDTH} / ${frame.height}` }}
        >
          {renderMap(false)}
        </div>
        <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-opacity duration-300 group-hover:opacity-100 sm:opacity-0">
          <Expand className="size-3.5" />
          Berlin ansehen
        </span>
      </button>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Berliner Bezirke"
        onClick={handleClose}
        className={`fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-start justify-between gap-4 p-4 sm:p-6">
          <div>
            <p className="text-sm font-semibold sm:text-base">
              {zoomed ? "Berlin · Median-Angebotsmiete je Bezirk" : "Deutschland"}
            </p>
            <p className="text-xs text-muted-foreground">
              {zoomed
                ? "Nettokalt in € / m² · Bezirk anklicken für Details"
                : "Daten liegen bisher für Berlin vor"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setZoomed((value) => !value);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              {zoomed ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />}
              <span className="hidden sm:inline">
                {zoomed ? "Deutschland" : "Berlin"}
              </span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                router.push("/karte");
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Maximize2 className="size-4" />
              <span className="hidden sm:inline">Interaktive Karte</span>
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              aria-label="Schließen"
              className="inline-flex size-9 items-center justify-center rounded-md border border-border transition-colors hover:bg-accent"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* The map's viewBox is portrait while most screens are landscape, so
            fitting it leaves a wide empty column. The ranking fills it and
            gives the values a readable, sortable form next to the shapes. */}
        {/* grid-rows must be an explicit 1fr: with auto rows the map cell
            takes its height from the SVG, the SVG takes its height from the
            cell, and the whole thing collapses to zero. */}
        <div
          className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 px-2 pb-4 sm:px-6 sm:pb-6 lg:grid-cols-[minmax(0,1fr)_18rem]"
          onClick={(event) => event.stopPropagation()}
        >
          <div ref={mapBoxRef} className="min-h-0 min-w-0">
            {open && renderMap(true)}
          </div>

          <ol
            className="hidden min-h-0 flex-col gap-1 overflow-y-auto text-sm lg:flex"
            aria-label="Bezirke nach Median-Angebotsmiete"
          >
            {ranked.map((shape) => (
              <li key={shape.key}>
                {shape.slug ? (
                  <a
                    href={`/bezirk/${shape.slug}`}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ background: rentToColor(shape.rentMedian) }}
                    />
                    <span className="truncate">{shape.name}</span>
                    <span className="ml-auto shrink-0 font-medium tabular-nums">
                      {shape.rentMedian != null ? EUR.format(shape.rentMedian) : "—"}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                        €/m²
                      </span>
                    </span>
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
