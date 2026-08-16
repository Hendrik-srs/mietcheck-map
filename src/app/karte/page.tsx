import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BerlinMap } from "@/components/map/berlin-map";
import { Badge } from "@/components/ui/badge";
import { getDistrictsGeoJSON } from "@/lib/data/districts";

export const metadata = {
  title: "Karte — MietCheck Map",
  description:
    "Interaktive Karte der Berliner Bezirke mit Datenquellen aus dem Geoportal Berlin.",
};

// The GeoJSON payload only changes when the monthly ingest runs, so serve
// it prerendered rather than querying PostGIS on every visit.
export const revalidate = 3600;

export default async function KartePage() {
  const districts = await getDistrictsGeoJSON("berlin");

  return (
    <main className="relative h-screen w-full overflow-hidden">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <Link
          href="/"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur transition-colors hover:bg-background"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          MietCheck Map
        </Link>
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-sm shadow-sm backdrop-blur">
          <span className="font-medium">Berlin</span>
          <Badge variant="secondary" className="text-xs">
            {districts.features.length} Bezirke
          </Badge>
        </div>
      </header>

      <BerlinMap districts={districts} />

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-3">
        <p className="pointer-events-auto rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
          Geometrie:{" "}
          <a
            href="https://daten.odis-berlin.de/de/dataset/bezirksgrenzen/"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
          >
            Geoportal Berlin / Bezirksgrenzen
          </a>{" "}
          · Karte: ©{" "}
          <a
            href="https://openfreemap.org/"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
          >
            OpenFreeMap
          </a>{" "}
          ·{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
          >
            OpenStreetMap
          </a>{" "}
          contributors
        </p>
      </footer>
    </main>
  );
}
