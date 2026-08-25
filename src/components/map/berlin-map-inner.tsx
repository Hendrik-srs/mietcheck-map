"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useCallback, useMemo, useState } from "react";
import {
  Layer,
  Map,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import { useRef } from "react";
import type { FeatureCollection, Geometry, Point } from "geojson";
import { Check, ChevronDown, Maximize2 } from "lucide-react";

import { RentHistoryChart } from "@/components/map/rent-history-chart";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import germanyStates from "@/lib/data/germany-states.json";
import { largestRingCenter } from "@/lib/geo-projection";
import { RENT_NO_DATA_COLOR, RENT_STOPS, rentGradientCss } from "@/lib/rent-color";
import { useIsDarkTheme } from "@/lib/use-theme";
import type {
  DistrictProperties,
  DistrictsFeatureCollection,
  RentHistoryPoint,
} from "@/lib/data/districts";

/**
 * The one interactive map.
 *
 * It carries two layers of geography: the federal states as country-level
 * context, and Berlin's districts with the rent choropleth. Zooming out
 * shows where the project stands nationally, zooming in shows the data —
 * which is why the landing page only links here instead of opening a
 * second, different map of its own.
 */

/** Below this zoom the country view dominates; above it, the districts. */
const DISTRICT_ZOOM = 8.2;

interface Region {
  id: string;
  name: string;
  /** null once a region has data; otherwise shown as coming later. */
  pending: boolean;
  center: [number, number];
  zoom: number;
}

const REGIONS: Region[] = [
  { id: "berlin", name: "Berlin", pending: false, center: [13.405, 52.52], zoom: 9.4 },
  { id: "hamburg", name: "Hamburg", pending: true, center: [9.993, 53.551], zoom: 9.6 },
  { id: "muenchen", name: "München", pending: true, center: [11.576, 48.137], zoom: 9.8 },
  { id: "koeln", name: "Köln", pending: true, center: [6.96, 50.937], zoom: 9.8 },
];

const GERMANY_VIEW = { center: [10.45, 51.16] as [number, number], zoom: 4.9 };

const STATES_FILL: LayerProps = {
  id: "states-fill",
  type: "fill",
  paint: {
    "fill-color": ["case", ["==", ["get", "name"], "Berlin"], "#f59e0b", "#94a3b8"],
    // Fades out as the districts take over, so the two never fight.
    "fill-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      4.5,
      0.35,
      DISTRICT_ZOOM,
      0.1,
      DISTRICT_ZOOM + 1,
      0,
    ],
  },
};

const STATES_LINE: LayerProps = {
  id: "states-line",
  type: "line",
  paint: {
    "line-color": "#475569",
    "line-width": 1,
    "line-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      4.5,
      0.8,
      DISTRICT_ZOOM,
      0.35,
      DISTRICT_ZOOM + 1,
      0,
    ],
  },
};

const STATES_LABEL: LayerProps = {
  id: "states-label",
  type: "symbol",
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Regular"],
    "text-size": 12,
    "text-allow-overlap": false,
  },
  paint: {
    "text-color": "#475569",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
    "text-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      5,
      1,
      DISTRICT_ZOOM - 0.5,
      1,
      DISTRICT_ZOOM + 0.5,
      0,
    ],
  },
};

const FILL_LAYER: LayerProps = {
  id: "districts-fill",
  type: "fill",
  paint: {
    "fill-color": [
      "case",
      ["==", ["get", "rent_median"], null],
      RENT_NO_DATA_COLOR,
      [
        "interpolate",
        ["linear"],
        ["to-number", ["get", "rent_median"]],
        ...RENT_STOPS.flat(),
      ],
    ],
    "fill-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      DISTRICT_ZOOM - 1.5,
      0.55,
      DISTRICT_ZOOM,
      0.75,
    ],
  },
};

const LINE_LAYER: LayerProps = {
  id: "districts-line",
  type: "line",
  paint: {
    "line-color": "#1e3a8a",
    "line-width": 1,
    "line-opacity": 0.6,
  },
};

/**
 * Labels come from a dedicated point source, not from the polygons.
 * MapLibre renders one symbol per polygon *part*, so a MultiPolygon with an
 * exclave gets labelled repeatedly — that is what showed "Pankow" twice.
 */
const LABEL_LAYER: LayerProps = {
  id: "districts-label",
  type: "symbol",
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Regular"],
    "text-size": 12,
    "text-allow-overlap": false,
    "text-padding": 4,
  },
  paint: {
    "text-color": "#0f172a",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
    "text-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      DISTRICT_ZOOM - 0.5,
      0,
      DISTRICT_ZOOM + 0.3,
      1,
    ],
  },
};

const EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUM = new Intl.NumberFormat("de-DE");

const BASEMAP = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const yearStart = start.slice(0, 4);
  const yearEnd = end.slice(0, 4);
  return yearStart === yearEnd ? `Kalenderjahr ${yearStart}` : `${yearStart}–${yearEnd}`;
}

// MapLibre flattens nested properties to JSON strings for the vector-tile
// model. Reconstruct the typed shape on the client.
function parseDistrictProperties(
  raw: Record<string, unknown> | null | undefined,
): DistrictProperties {
  const props = raw ?? {};
  let history: RentHistoryPoint[] = [];
  const rawHistory = props.rent_history;
  if (typeof rawHistory === "string") {
    try {
      history = JSON.parse(rawHistory) as RentHistoryPoint[];
    } catch {
      history = [];
    }
  } else if (Array.isArray(rawHistory)) {
    history = rawHistory as RentHistoryPoint[];
  }
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    id: String(props.id ?? ""),
    name: String(props.name ?? "Unbekannter Bezirk"),
    level: (props.level as DistrictProperties["level"]) ?? "bezirk",
    label_lon: num(props.label_lon),
    label_lat: num(props.label_lat),
    rent_median: num(props.rent_median),
    rent_sample_size: num(props.rent_sample_size),
    rent_period_start: str(props.rent_period_start),
    rent_period_end: str(props.rent_period_end),
    rent_metric: str(props.rent_metric),
    rent_source_id: str(props.rent_source_id),
    rent_source_name: str(props.rent_source_name),
    rent_source_publisher: str(props.rent_source_publisher),
    rent_source_url: str(props.rent_source_url),
    rent_history: history,
  };
}

export default function BerlinMapInner({
  districts,
}: {
  districts: DistrictsFeatureCollection;
}) {
  const [selected, setSelected] = useState<DistrictProperties | null>(null);
  const [cursor, setCursor] = useState<"auto" | "pointer">("auto");
  const [activeRegion, setActiveRegion] = useState<string>("berlin");
  const isDark = useIsDarkTheme();
  const mapRef = useRef<MapRef>(null);

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) return;
    setSelected(parseDistrictProperties(feature.properties));
  }, []);

  const flyTo = useCallback((center: [number, number], zoom: number) => {
    mapRef.current?.flyTo({ center, zoom, duration: 1400, essential: true });
  }, []);

  const stats = useMemo(() => {
    const medians = districts.features
      .map((f) => f.properties.rent_median)
      .filter((v): v is number => typeof v === "number");
    if (medians.length === 0) return null;
    return {
      min: Math.min(...medians),
      max: Math.max(...medians),
      count: medians.length,
    };
  }, [districts]);

  // One point per district, positioned by the anchor PostGIS computed.
  // Falls back to a locally derived anchor when the column isn't populated,
  // so the map stays labelled either way.
  const labelPoints = useMemo<FeatureCollection<Point, { name: string }>>(
    () => ({
      type: "FeatureCollection",
      features: districts.features.flatMap((f) => {
        const { label_lon: lon, label_lat: lat, name } = f.properties;
        const coordinates =
          lon != null && lat != null ? [lon, lat] : largestRingCenter(f.geometry);
        if (!coordinates) return [];
        return [
          {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates },
            properties: { name },
          },
        ];
      }),
    }),
    [districts],
  );

  return (
    <>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: REGIONS[0].center[0],
          latitude: REGIONS[0].center[1],
          zoom: REGIONS[0].zoom,
        }}
        minZoom={4.5}
        maxZoom={16}
        style={{ width: "100%", height: "100%" }}
        mapStyle={isDark ? BASEMAP.dark : BASEMAP.light}
        interactiveLayerIds={[FILL_LAYER.id!]}
        onClick={onClick}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("auto")}
        cursor={cursor}
      >
        <Source
          id="states"
          type="geojson"
          data={germanyStates as FeatureCollection<Geometry, { name: string }>}
        >
          <Layer {...STATES_FILL} />
          <Layer {...STATES_LINE} />
          <Layer {...STATES_LABEL} />
        </Source>

        <Source id="districts" type="geojson" data={districts}>
          <Layer {...FILL_LAYER} />
          <Layer {...LINE_LAYER} />
        </Source>

        <Source id="district-labels" type="geojson" data={labelPoints}>
          <Layer {...LABEL_LAYER} />
        </Source>
      </Map>

      <RegionSwitcher
        active={activeRegion}
        onSelect={(region) => {
          setActiveRegion(region.id);
          flyTo(region.center, region.zoom);
        }}
        onOverview={() => {
          setActiveRegion("");
          flyTo(GERMANY_VIEW.center, GERMANY_VIEW.zoom);
        }}
      />

      {stats && <Legend min={stats.min} max={stats.max} count={stats.count} />}

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent>
          {selected && <DistrictDetails district={selected} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function RegionSwitcher({
  active,
  onSelect,
  onOverview,
}: {
  active: string;
  onSelect: (region: Region) => void;
  onOverview: () => void;
}) {
  const [open, setOpen] = useState(false);
  const current = REGIONS.find((r) => r.id === active);

  return (
    <div className="pointer-events-auto absolute top-4 left-1/2 z-10 -translate-x-1/2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-9 items-center gap-2 rounded-full border bg-background/90 px-4 text-sm font-medium shadow-sm backdrop-blur transition-colors hover:bg-accent"
        >
          {current ? current.name : "Deutschland"}
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <div className="absolute top-11 left-1/2 w-56 -translate-x-1/2 overflow-hidden rounded-lg border bg-background/95 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => {
                onOverview();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <Maximize2 className="size-3.5 text-muted-foreground" />
              Ganz Deutschland
            </button>
            <div className="h-px bg-border" />
            {REGIONS.map((region) => (
              <button
                key={region.id}
                type="button"
                disabled={region.pending}
                onClick={() => {
                  onSelect(region);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <span className="flex items-center gap-2">
                  {region.id === active && <Check className="size-3.5 text-primary" />}
                  <span className={region.id === active ? "" : "ml-5"}>
                    {region.name}
                  </span>
                </span>
                {region.pending && (
                  <span className="text-xs text-muted-foreground">geplant</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ min, max, count }: { min: number; max: number; count: number }) {
  return (
    <div className="pointer-events-auto absolute right-4 bottom-16 z-10 w-60 rounded-lg border bg-background/90 p-3 text-xs shadow-md backdrop-blur">
      <div className="mb-1 font-medium text-foreground">Median-Angebotsmiete</div>
      <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        € / m² Nettokalt · {count} Bezirke
      </div>
      <div
        className="h-2 w-full rounded-sm"
        style={{ background: rentGradientCss() }}
        aria-hidden
      />
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{NUM.format(RENT_STOPS[0][0])}</span>
        <span>{NUM.format(RENT_STOPS[RENT_STOPS.length - 1][0])}</span>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Aktuell: {NUM.format(min)}–{NUM.format(max)} €/m²
      </div>
    </div>
  );
}

function DistrictDetails({ district }: { district: DistrictProperties }) {
  const period = formatPeriod(district.rent_period_start, district.rent_period_end);
  const median = typeof district.rent_median === "number" ? district.rent_median : null;
  const samples = district.rent_sample_size;
  const history = district.rent_history;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{district.name}</SheetTitle>
        <SheetDescription>Bezirk in Berlin</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 overflow-y-auto px-4 pb-6">
        {median !== null ? (
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Median-Angebotsmiete
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tabular-nums">
                {EUR.format(median)}
              </span>
              <span className="text-sm text-muted-foreground">/ m² netto kalt</span>
            </div>
            {samples != null && (
              <div className="mt-2 text-xs text-muted-foreground">
                Basis: {NUM.format(samples)} Online-Inserate
                {period ? ` · ${period}` : null}
              </div>
            )}
            {history.length >= 2 && (
              <div className="mt-4 border-t pt-3">
                <RentHistoryChart history={history} />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Noch keine Mietpreis-Daten vorhanden.
            </p>
            <p className="mt-1">
              Für diesen Bezirk wurden noch keine Werte aus offiziellen Quellen
              eingelesen.
            </p>
          </div>
        )}

        {district.rent_source_name && (
          <dl className="space-y-1 text-xs">
            <div>
              <dt className="text-muted-foreground">Quelle</dt>
              <dd className="text-foreground">
                {district.rent_source_url ? (
                  <a
                    href={district.rent_source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {district.rent_source_name}
                  </a>
                ) : (
                  district.rent_source_name
                )}
              </dd>
            </div>
            {district.rent_source_publisher && (
              <div>
                <dt className="text-muted-foreground">Herausgeber</dt>
                <dd className="text-foreground">{district.rent_source_publisher}</dd>
              </div>
            )}
          </dl>
        )}

        <p className="text-[11px] text-muted-foreground">
          Angebotsmiete = aus Online-Inseraten ermittelte Median-Miete für neu
          angebotene Wohnungen. Sie liegt typischerweise über der Bestandsmiete
          (= laufende Mieten in bestehenden Verträgen).
        </p>
      </div>
    </>
  );
}
