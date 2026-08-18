import Link from "next/link";
import type { FeatureCollection, Geometry } from "geojson";
import {
  ArrowRight,
  Code2,
  Database,
  Map,
  RefreshCw,
  Scale,
  ShieldCheck,
} from "lucide-react";

import { GermanyPreview } from "@/components/map/germany-preview";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import germanyStates from "@/lib/data/germany-states.json";
import { getAllDataSources } from "@/lib/data/sources";
import { getDistrictsOverview, getLandingStats } from "@/lib/data/overview";
import { rentGradientCss, RENT_STOPS } from "@/lib/rent-color";
import { BERLIN_BEZIRKE } from "@/lib/slugs";

/**
 * Prerender the landing page and refresh it hourly. The underlying data
 * only moves when the monthly auto-ingest runs, so serving a static page
 * costs nothing in freshness and keeps the first paint off the database.
 */
export const revalidate = 3600;

const NUM = new Intl.NumberFormat("de-DE");

const features = [
  {
    icon: Scale,
    href: "/check",
    title: "Fairness-Check",
    description:
      "Adresse, Wohnfläche und Kaltmiete eintragen. Vergleich gegen Marktmedian und amtlichen Mietspiegel — inklusive Mietpreisbremsen-Hinweis.",
    cta: "Miete prüfen",
  },
  {
    icon: Map,
    href: "/karte",
    title: "Interaktive Karte",
    description:
      "Heatmap aller Bezirke mit Detail-Ansicht, Mietentwicklung seit 2012 und Quellenangabe pro Wert.",
    cta: "Karte öffnen",
  },
  {
    icon: ShieldCheck,
    href: "/quellen",
    title: "Belegbare Herkunft",
    description:
      "Jeder Wert verlinkt auf seine Originalveröffentlichung mit Lizenz und Bezugsdatum. Nichts geschätzt, nichts gescrapet.",
    cta: "Quellen ansehen",
  },
];

export default async function Home() {
  const [districts, stats, sources] = await Promise.all([
    getDistrictsOverview("berlin"),
    getLandingStats(),
    getAllDataSources(),
  ]);

  const years =
    stats.yearFrom && stats.yearTo ? stats.yearTo - stats.yearFrom + 1 : null;

  const keyFigures = [
    {
      value: NUM.format(stats.wohnlagenAddresses),
      label: "Adressen mit amtlicher Wohnlage",
    },
    {
      value: `${stats.bezirke} + ${stats.ortsteile}`,
      label: "Bezirke und Ortsteile als Geometrie",
    },
    {
      value: years ? `${years} Jahre` : "—",
      label: stats.yearFrom ? `Miethistorie seit ${stats.yearFrom}` : "Miethistorie",
    },
    {
      value: `${stats.sources} / 0`,
      label: "offizielle Quellen / gescrapte Werte",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader width="6xl" />

      {/* Hero — copy on the left, the product itself on the right. */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-12 pb-16 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
          <div>
            <Badge variant="outline" className="mb-6">
              Berlin · weitere Städte folgen
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Wohnst du <span className="text-primary">fair</span>?
            </h1>
            <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
              Prüfe deine Miete gegen den amtlichen Mietspiegel und den
              Marktdurchschnitt deines Bezirks — mit Hinweis auf mögliche
              Mietpreisbremsen-Verstöße. Ausschließlich aus offiziellen Quellen,
              jeder Wert belegt.
            </p>
            {/* One call to action. The map next to it is its own entry
                point — a "Karte ansehen" button beside a clickable map only
                splits the same decision in two. */}
            <div className="mt-8">
              <Link
                href="/check"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Scale className="size-4" />
                Miete prüfen
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">Wo es Daten gibt</p>
              <p className="text-xs text-muted-foreground">
                Stand {stats.yearTo ?? "2025"}
              </p>
            </div>
            <GermanyPreview
              states={germanyStates as FeatureCollection<Geometry, { id: string; name: string }>}
              districts={districts}
            />
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                Median-Angebotsmiete, € / m² nettokalt
              </p>
              <div className="w-28 shrink-0">
                <div
                  className="h-1.5 w-full rounded-full"
                  style={{ background: rentGradientCss() }}
                  aria-hidden
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{NUM.format(RENT_STOPS[0][0])} €</span>
                  <span>{NUM.format(RENT_STOPS[RENT_STOPS.length - 1][0])} €</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key figures — every number is a live count from the database. */}
      <section className="border-y border-border/60 bg-muted/20">
        <div className="mx-auto w-full max-w-6xl px-6 py-12">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {keyFigures.map(({ value, label }) => (
              <div key={label}>
                <dt className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                  {value}
                </dt>
                <dd className="mt-1.5 text-sm text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* What you can do here */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-5 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, description, href, cta }) => (
            <Link key={title} href={href} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardHeader>
                  <Icon className="mb-2 size-6 text-primary" />
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    {cta}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Trust — sources come from the database, so this list can't drift
          away from what we actually ingested. */}
      <section className="border-y border-border/60 bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Datenherkunft
                </span>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
                Jeder Wert quellen-belegt. Kein Scraping, keine Schätzungen.
              </h2>
              <p className="mt-4 text-pretty text-muted-foreground">
                Diese {stats.sources} Quellen sind alles, worauf die Seite basiert —
                direkt aus der Datenbank gelistet, nicht aus einer Marketing-Liste.
              </p>
              <div className="mt-6 flex flex-col gap-3 text-sm">
                <Link
                  href="/quellen"
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  Alle Quellen mit Lizenz und Bezugsdatum
                  <ArrowRight className="size-4" />
                </Link>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <RefreshCw className="size-3.5" />
                  Automatisch aktualisiert, monatlich per GitHub Actions
                </span>
              </div>
            </div>

            <ul className="grid gap-2.5 self-center">
              {sources.map((source) => (
                <li
                  key={source.id}
                  className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-background px-3.5 py-3 text-sm"
                >
                  <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="font-medium">{source.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {source.publisher}
                      {source.license
                        ? ` · ${source.license.split("—")[0].trim()}`
                        : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Roadmap — reflects the actual state of the repo. */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Stand & Roadmap</h2>
        <ol className="grid gap-3 text-sm sm:grid-cols-2">
          {[
            {
              state: "live" as const,
              text: `${stats.bezirke} Bezirke und ${stats.ortsteile} Ortsteile als PostGIS-Geometrien`,
            },
            {
              state: "live" as const,
              text: `Heatmap und Trend-Charts aus dem IBB Wohnungsmarktbericht (${stats.yearFrom}–${stats.yearTo})`,
            },
            {
              state: "live" as const,
              text: `Mietspiegel 2024: ${NUM.format(stats.mietspiegelRows)} Tabellenzeilen, ${NUM.format(stats.wohnlagenAddresses)} adressgenaue Wohnlagen`,
            },
            {
              state: "live" as const,
              text: "Fairness-Check mit Mietpreisbremsen-Hinweis",
            },
            {
              state: "live" as const,
              text: "Bezirks-Seiten, Quellen-Transparenz, monatliche Auto-Ingestion",
            },
            {
              state: "als Nächstes" as const,
              text: "Adress-Autovervollständigung im Fairness-Check",
            },
            {
              state: "geplant" as const,
              text: "München, Hamburg und Köln",
            },
          ].map((item) => (
            <li
              key={item.text}
              className="flex items-baseline gap-3 rounded-lg border border-border/50 px-3.5 py-3"
            >
              <Badge
                variant={
                  item.state === "live"
                    ? "default"
                    : item.state === "als Nächstes"
                      ? "secondary"
                      : "outline"
                }
                className="shrink-0"
              >
                {item.state}
              </Badge>
              <span className="text-pretty">{item.text}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-sm sm:grid-cols-[1fr_auto]">
          {/* Berliner Bezirke — internal links, helps SEO + accessibility. */}
          <div>
            <p className="mb-3 font-medium">Mieten nach Berliner Bezirk</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-muted-foreground sm:grid-cols-3">
              {BERLIN_BEZIRKE.map(({ slug, name }) => (
                <li key={slug}>
                  <Link
                    href={`/bezirk/${slug}`}
                    className="transition-colors hover:text-foreground"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 text-muted-foreground sm:text-right">
            <p>MietCheck Map · Open-Source-Projekt · {new Date().getFullYear()}</p>
            <div className="flex gap-4 sm:justify-end">
              <Link href="/quellen" className="hover:text-foreground">
                Quellen
              </Link>
              <a
                href="https://github.com/Hendrik-srs/mietcheck-map"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Code2 className="size-4" /> Source-Code
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
