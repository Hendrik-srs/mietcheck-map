"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useCallback, useMemo, useState } from "react";
import {
  Layer,
  Map,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";

import { RentHistoryChart } from "@/components/map/rent-history-chart";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RENT_NO_DATA_COLOR, RENT_STOPS, rentGradientCss } from "@/lib/rent-color";
import { useIsDarkTheme } from "@/lib/use-theme";
import type {
  DistrictProperties,
  DistrictsFeatureCollection,
  RentHistoryPoint,
} from "@/lib/data/districts";

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
    "fill-opacity": 0.7,
  },
};

const LINE_LAYER: LayerProps = {
  id: "districts-line",
  type: "line",
  paint: {
    "line-color": "#1e3a8a",
    "line-width": 1,
  },
};

const LABEL_LAYER: LayerProps = {
  id: "districts-label",
  type: "symbol",
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Regular"],
    "text-size": 12,
    "text-allow-overlap": false,
  },
  paint: {
    "text-color": "#0f172a",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

const EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUM = new Intl.NumberFormat("de-DE");

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
  return {
    id: String(props.id ?? ""),
    name: String(props.name ?? "Unbekannter Bezirk"),
    level: (props.level as DistrictProperties["level"]) ?? "bezirk",
    rent_median: typeof props.rent_median === "number" ? props.rent_median : null,
    rent_sample_size:
      typeof props.rent_sample_size === "number" ? props.rent_sample_size : null,
    rent_period_start:
      typeof props.rent_period_start === "string" ? props.rent_period_start : null,
    rent_period_end:
      typeof props.rent_period_end === "string" ? props.rent_period_end : null,
    rent_metric: typeof props.rent_metric === "string" ? props.rent_metric : null,
    rent_source_id:
      typeof props.rent_source_id === "string" ? props.rent_source_id : null,
    rent_source_name:
      typeof props.rent_source_name === "string" ? props.rent_source_name : null,
    rent_source_publisher:
      typeof props.rent_source_publisher === "string"
        ? props.rent_source_publisher
        : null,
    rent_source_url:
      typeof props.rent_source_url === "string" ? props.rent_source_url : null,
    rent_history: history,
  };
}

/**
 * OpenFreeMap ships a light and a dark basemap. Picking one to match the
 * site theme keeps a dark page from being lit up by a white map.
 */
const BASEMAP = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export default function BerlinMapInner({
  districts,
}: {
  districts: DistrictsFeatureCollection;
}) {
  const [selected, setSelected] = useState<DistrictProperties | null>(null);
  const [cursor, setCursor] = useState<"auto" | "pointer">("auto");
  const isDark = useIsDarkTheme();

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) return;
    setSelected(parseDistrictProperties(feature.properties));
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

  return (
    <>
      <Map
        initialViewState={{ longitude: 13.405, latitude: 52.52, zoom: 9.4 }}
        minZoom={8}
        maxZoom={16}
        style={{ width: "100%", height: "100%" }}
        mapStyle={isDark ? BASEMAP.dark : BASEMAP.light}
        interactiveLayerIds={[FILL_LAYER.id!]}
        onClick={onClick}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("auto")}
        cursor={cursor}
      >
        <Source id="districts" type="geojson" data={districts}>
          <Layer {...FILL_LAYER} />
          <Layer {...LINE_LAYER} />
          <Layer {...LABEL_LAYER} />
        </Source>
      </Map>

      {stats && (
        <Legend min={stats.min} max={stats.max} count={stats.count} />
      )}

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

function Legend({
  min,
  max,
  count,
}: {
  min: number;
  max: number;
  count: number;
}) {
  return (
    <div className="pointer-events-auto absolute right-4 bottom-16 z-10 w-60 rounded-lg border bg-background/90 p-3 text-xs shadow-md backdrop-blur">
      <div className="mb-1 font-medium text-foreground">
        Median-Angebotsmiete
      </div>
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
                <dd className="text-foreground">
                  {district.rent_source_publisher}
                </dd>
              </div>
            )}
          </dl>
        )}

        <p className="text-[11px] text-muted-foreground">
          Angebotsmiete = aus Online-Inseraten ermittelte Median-Miete für neu
          angebotene Wohnungen. Sie liegt typischerweise über der
          Bestandsmiete (= laufende Mieten in bestehenden Verträgen).
        </p>
      </div>
    </>
  );
}
