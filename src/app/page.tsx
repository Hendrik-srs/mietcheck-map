import Link from "next/link";
import {
  ArrowRight,
  Code2,
  Database,
  Map,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { BerlinHeroMap } from "@/components/map/berlin-hero-map";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    icon: Map,
    href: "/karte",
    title: "Interaktive Mietkarte",
    description:
      "Heatmap der Median-Angebotsmieten pro Bezirk, mit Detail-Ansicht und Trend-Chart je Bezirk.",
  },
  {
    icon: Scale,
    href: "/check",
    title: "Fairness-Check",
    description:
      "Adresse, Wohnfläche und Kaltmiete eintragen. Vergleich gegen Marktmedian und den amtlichen Mietspiegel 2024 — inklusive Mietpreisbremsen-Hinweis.",
  },
  {
    icon: TrendingUp,
    href: "/quellen",
    title: "Nachvollziehbar",
    description:
      "Jeder Wert verlinkt auf seine Originalquelle mit Lizenz und Bezugsdatum. Nichts davon ist geschätzt oder gescrapet.",
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
      label: stats.yearFrom
        ? `Miethistorie seit ${stats.yearFrom}`
        : "Miethistorie",
    },
    {
      value: `${stats.sources} / 0`,
      label: "offizielle Quellen / gescrapte Werte",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader width="6xl" />

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-10">
        <Badge variant="outline" className="mb-6">
          Berlin · weitere Städte folgen
        </Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Wohnst du <span className="text-primary">fair</span>?
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Die transparente Mietkarte für Berlin: Vergleichsmieten aus dem amtlichen
          Mietspiegel, ein Fairness-Check für deine eigene Wohnung und
          Markt-Trends seit {stats.yearFrom ?? 2012} — ausschließlich aus
          offiziellen Quellen.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/check"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Scale className="size-4" />
            Miete prüfen
          </Link>
          <Link
            href="/karte"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border px-6 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Map className="size-4" />
            Karte ansehen
          </Link>
        </div>
      </section>

      {/* Choropleth — server-rendered SVG, no map library on this page. */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-8">
        <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Median-Angebotsmiete je Bezirk
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Nettokalt in € / m², Stand {stats.yearTo ?? "2025"} · Quelle: IBB
                Wohnungsmarktbericht
              </p>
            </div>
            <div className="w-44">
              <div
                className="h-2 w-full rounded-sm"
                style={{ background: rentGradientCss() }}
                aria-hidden
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>{NUM.format(RENT_STOPS[0][0])} €</span>
                <span>{NUM.format(RENT_STOPS[RENT_STOPS.length - 1][0])} €</span>
              </div>
            </div>
          </div>

          <BerlinHeroMap districts={districts} />

          <p className="mt-6 text-xs text-muted-foreground">
            Bezirk anklicken für Details, Historie und Quellenangabe.
          </p>
        </div>
      </section>

      {/* Key figures — every number is a live count from the database. */}
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
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
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, description, href }) => (
            <Link key={title} href={href} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardHeader>
                  <Icon className="mb-2 size-6 text-primary" />
                  <CardTitle className="flex items-center gap-1.5">
                    {title}
                    <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-60" />
                  </CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Trust — sources come from the database, so this list can't drift
          away from what we actually ingested. */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Vollständig offizielle Datenherkunft
            </span>
          </div>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">
            Jeder Wert quellen-belegt. Kein Scraping, keine Schätzungen.
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Diese {stats.sources} Quellen sind alles, worauf die Seite basiert —
            direkt aus der Datenbank gelistet, nicht aus einer Marketing-Liste.
            Alle sind frei zugänglich und lizenzkonform nutzbar.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {sources.map((source) => (
              <li
                key={source.id}
                className="flex items-start gap-2.5 rounded-md border border-border/60 bg-background px-3.5 py-3 text-sm"
              >
                <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">{source.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {source.publisher}
                    {source.license ? ` · ${source.license.split("—")[0].trim()}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
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
      </section>

      {/* Roadmap — reflects the actual state of the repo. */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Stand & Roadmap</h2>
        <ol className="space-y-3 text-sm">
          {[
            {
              state: "live" as const,
              text: `Interaktive Karte: ${stats.bezirke} Bezirke, ${stats.ortsteile} Ortsteile als PostGIS-Geometrien`,
            },
            {
              state: "live" as const,
              text: `Mietpreis-Heatmap und Trend-Charts aus dem IBB Wohnungsmarktbericht (${stats.yearFrom}–${stats.yearTo})`,
            },
            {
              state: "live" as const,
              text: `Berliner Mietspiegel 2024 mit ${NUM.format(stats.mietspiegelRows)} Tabellenzeilen und ${NUM.format(stats.wohnlagenAddresses)} adressgenauen Wohnlagen`,
            },
            {
              state: "live" as const,
              text: "Fairness-Check mit Mietpreisbremsen-Hinweis auf Basis der ortsüblichen Vergleichsmiete",
            },
            {
              state: "live" as const,
              text: "Bezirks-Seiten, Quellen-Transparenz und monatliche Auto-Ingestion",
            },
            {
              state: "als Nächstes" as const,
              text: "Adress-Autovervollständigung im Fairness-Check",
            },
            {
              state: "geplant" as const,
              text: "Erweiterung auf München, Hamburg und Köln",
            },
          ].map((item) => (
            <li key={item.text} className="flex items-baseline gap-3">
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
              <span>{item.text}</span>
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
