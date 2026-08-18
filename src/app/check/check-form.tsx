"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ExternalLink,
  Heart,
  RotateCcw,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressInput } from "./address-input";
import { runFairnessCheck, type CheckFormState } from "./actions";
import type { Verdict } from "@/lib/data/fairness";
import type { MietspiegelVerdict } from "@/lib/data/mietspiegel";

const initialState: CheckFormState = { status: "idle" };

const eur = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

const eur2 = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);

const pct = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", {
    maximumFractionDigits: 1,
  })} %`;

const verdictStyle: Record<
  Verdict,
  { ring: string; bg: string; text: string; Icon: typeof CheckCircle2 }
> = {
  guenstig: {
    ring: "ring-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  marktueblich: {
    ring: "ring-sky-500/40",
    bg: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-400",
    Icon: Info,
  },
  ueber_markt: {
    ring: "ring-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  weit_ueber_markt: {
    ring: "ring-destructive/40",
    bg: "bg-destructive/10",
    text: "text-destructive",
    Icon: AlertCircle,
  },
};

export function CheckForm() {
  const [state, formAction, pending] = useActionState(runFairnessCheck, initialState);

  if (state.status === "success" && state.result) {
    return <ResultPanel state={state} />;
  }

  const v =
    state.values ?? {
      address: "",
      sizeSqm: "",
      monthlyRent: "",
      buildingYear: "",
      share: false,
    };
  const e = state.errors ?? {};

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Fairness-Check</CardTitle>
        <CardDescription>
          Adresse, Wohnfläche und Kaltmiete eintragen. Wir vergleichen mit dem aktuellen
          Angebotsmieten-Median deines Bezirks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="address">Adresse in Berlin</Label>
            <AddressInput defaultValue={v.address} invalid={Boolean(e.address)} />
            {e.address ? (
              <p className="text-sm text-destructive">{e.address}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tippen und aus den Vorschlägen wählen. Wir verarbeiten die
                Adresse nur für den Vergleich und speichern sie nicht.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sizeSqm">Wohnfläche (m²)</Label>
              <Input
                id="sizeSqm"
                name="sizeSqm"
                type="number"
                min="6"
                max="999"
                step="0.5"
                required
                placeholder="62"
                defaultValue={v.sizeSqm}
                aria-invalid={Boolean(e.sizeSqm) || undefined}
              />
              {e.sizeSqm && <p className="text-sm text-destructive">{e.sizeSqm}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="monthlyRent">Kaltmiete (€/Monat)</Label>
              <Input
                id="monthlyRent"
                name="monthlyRent"
                type="number"
                min="51"
                max="19999"
                step="1"
                required
                placeholder="850"
                defaultValue={v.monthlyRent}
                aria-invalid={Boolean(e.monthlyRent) || undefined}
              />
              {e.monthlyRent && <p className="text-sm text-destructive">{e.monthlyRent}</p>}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="buildingYear">
              Baujahr <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="buildingYear"
              name="buildingYear"
              type="number"
              min="1800"
              max="2099"
              step="1"
              placeholder="1965"
              defaultValue={v.buildingYear}
              aria-invalid={Boolean(e.buildingYear) || undefined}
            />
            {e.buildingYear ? (
              <p className="text-sm text-destructive">{e.buildingYear}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Mit Baujahr vergleichen wir zusätzlich gegen den Berliner
                Mietspiegel 2024 (rechtssichere Vergleichsmiete).
              </p>
            )}
          </div>

          <div
            className={`rounded-lg border bg-muted/30 p-3 ${
              e.share ? "border-destructive/50" : "border-border/60"
            }`}
          >
            <label
              htmlFor="share"
              className="flex cursor-pointer items-start gap-3 text-sm"
            >
              <input
                type="checkbox"
                id="share"
                name="share"
                defaultChecked={v.share}
                className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
              />
              <span>
                <span className="font-medium">
                  Anonym zur Karte beitragen
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Wir speichern nur Bezirk, Wohnfläche, Kaltmiete und ggf. das
                  Baualter — <strong>keine</strong> Adresse, keine E-Mail, keine
                  IP. Hilft, die Datenlage über offizielle Quellen hinaus zu
                  ergänzen. Anzeige erst nach Sichtprüfung.
                </span>
              </span>
            </label>
            {e.share && (
              <p className="mt-2.5 border-t border-destructive/20 pt-2.5 text-sm text-destructive">
                {e.share}
              </p>
            )}
          </div>

          {e._form && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {e._form}
            </div>
          )}

          <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-fit">
            {pending ? "Prüfe…" : "Miete prüfen"}
            <ArrowRight />
          </Button>

          <p className="text-xs text-muted-foreground">
            Hinweis: Dieser Vergleich nutzt den IBB-Angebotsmieten-Median. Er ersetzt keine
            Rechtsberatung und keine Mietspiegel-konforme Mietpreisbremsen-Berechnung.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Result view.
 *
 * The check produces two judgements that routinely disagree: the market
 * median says what landlords currently ask, the Mietspiegel says what the
 * law considers reasonable. A flat can sit below the market and still be
 * over the legal limit — showing both as equals read as a contradiction,
 * so the legally relevant one leads and the market figure follows as
 * context, with the reason for the gap stated once in plain words.
 */
function ResultPanel({ state }: { state: CheckFormState }) {
  if (!state.result) return null;
  const {
    address,
    displayName,
    sizeSqm,
    monthlyRent,
    buildingYear,
    district,
    assessment,
    mietspiegel,
    shared,
  } = state.result;

  const marketStyle = verdictStyle[assessment.verdict];
  const legalStyle = mietspiegel ? mietspiegelStyle[mietspiegel.verdict] : null;
  // The Mietspiegel answers "may they charge this?", which is the question
  // worth acting on. Without a building year we only have the market view.
  const lead = mietspiegel && legalStyle ? legalStyle : marketStyle;
  const leadLabel = mietspiegel ? mietspiegel.verdictLabel : assessment.verdictLabel;
  const leadText = mietspiegel
    ? mietspiegel.verdictDescription
    : assessment.verdictDescription;

  return (
    <div className="grid gap-5">
      {shared && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <Heart className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Danke für deinen Beitrag.</strong> Deine Miete wurde anonym zur
            Sichtprüfung gespeichert und erscheint nach Freigabe in der Datenbasis.
          </span>
        </div>
      )}

      {/* 1 — The answer, with the number it rests on. */}
      <Card className={`w-full ring-2 ${lead.ring}`}>
        <CardHeader>
          <div className={`flex items-center gap-2 ${lead.text}`}>
            <lead.Icon className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {mietspiegel ? "Mietspiegel 2024" : "Marktvergleich"} · {leadLabel}
            </span>
          </div>
          <CardTitle className="text-3xl sm:text-4xl">
            {eur2(assessment.pricePerSqm)}
            <span className="text-xl font-normal text-muted-foreground"> / m²</span>
          </CardTitle>
          <CardDescription className="text-base text-pretty">{leadText}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {mietspiegel && (
            <MietspiegelScale mietspiegel={mietspiegel} style={lead} />
          )}

          {mietspiegel?.potentialMietpreisbremseViolation && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
              <strong className="text-amber-700 dark:text-amber-400">
                Mietpreisbremse:
              </strong>{" "}
              Deine Miete liegt über dem Mittelwert + 10 % (
              {eur2(mietspiegel.mietpreisbremseLimitEurPerSqm)} / m²). Berlin ist
              Mietpreisbremsen-Gebiet — je nach Ausstattung und Energieeffizienz
              kann das ein Verstoß sein. Das prüft am besten der{" "}
              <a
                href="https://www.berliner-mieterverein.de/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Berliner Mieterverein
              </a>{" "}
              oder eine Fachanwaltskanzlei für Mietrecht.
            </div>
          )}

          {!mietspiegel && (
            <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Mit dem <strong className="text-foreground">Baujahr</strong> vergleichen
              wir zusätzlich gegen den Berliner Mietspiegel 2024 — das ist der
              rechtlich maßgebliche Wert und die Grundlage jeder
              Mietpreisbremsen-Prüfung.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2 — Both yardsticks side by side, and why they differ. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zwei Maßstäbe</CardTitle>
          <CardDescription>
            {mietspiegel
              ? "Was verlangt wird und was zulässig ist, sind zwei verschiedene Zahlen — genau daran setzt die Mietpreisbremse an."
              : "Angebotsmieten zeigen, was aktuell verlangt wird — nicht, was rechtlich zulässig ist."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Yardstick
            label="Markt heute"
            sub={`Angebotsmieten ${district.parentDistrictName}`}
            value={eur2(assessment.comparisonMedian)}
            delta={pct(assessment.deviationPct)}
            deltaTone={assessment.deviationPct > 0 ? "over" : "under"}
          />
          {mietspiegel ? (
            <Yardstick
              label="Rechtlich üblich"
              sub={`Mietspiegel 2024 · ${mietspiegel.row.baualterLabel}`}
              value={eur2(mietspiegel.row.valueMedianEurPerSqm)}
              delta={`${
                mietspiegel.deviationFromMedianEurPerSqm > 0 ? "+" : "−"
              }${eur2(Math.abs(mietspiegel.deviationFromMedianEurPerSqm))} / m²`}
              deltaTone={
                mietspiegel.deviationFromMedianEurPerSqm > 0 ? "over" : "under"
              }
            />
          ) : (
            <div className="flex items-center rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
              Baujahr angeben, um den Mietspiegel-Wert zu sehen.
            </div>
          )}

          {assessment.monthlyOverpay > 0 && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Gegenüber dem Marktmedian zahlst du{" "}
              <strong className="text-foreground">
                {eur(assessment.monthlyOverpay)}
              </strong>{" "}
              mehr im Monat, {eur(assessment.yearlyOverpay)} im Jahr.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3 — What the answer was computed from, sources included. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grundlage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row
            label="Adresse"
            value={address}
            // Only when it adds something: picking a suggestion makes the
            // two identical, and the raw geocoder string ("Simon
            // Textildruck, 42, Boxhagener Straße, …") is noise next to a
            // clean address the user already recognises.
            note={displayName !== address ? displayName : undefined}
          />
          <Row
            label="Bezirk"
            value={district.parentDistrictName}
            note={
              district.districtLevel === "ortsteil"
                ? `Ortsteil ${district.districtName}`
                : undefined
            }
          />
          {district.wohnlage && (
            <Row
              label="Wohnlage"
              value={wohnlageLabels[district.wohnlage]}
              note={
                district.wohnlageDistanceM != null && district.wohnlageDistanceM > 50
                  ? `nächste klassifizierte Adresse ${Math.round(district.wohnlageDistanceM)} m entfernt`
                  : undefined
              }
            />
          )}
          <Row
            label="Wohnung"
            value={`${sizeSqm.toLocaleString("de-DE")} m² · ${eur(monthlyRent)} kalt`}
            note={buildingYear != null ? `Baujahr ${buildingYear}` : undefined}
          />

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>Quellen:</span>
            {district.rentSourceUrl && district.rentSourceName && (
              <a
                href={district.rentSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                {district.rentSourceName}
                {district.rentPeriodEnd &&
                  ` (${new Date(district.rentPeriodEnd).getFullYear()})`}
                <ExternalLink className="size-3" />
              </a>
            )}
            {mietspiegel && <span>Berliner Mietspiegel 2024</span>}
            <Link href="/quellen" className="hover:text-foreground">
              alle Quellen
            </Link>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Diese Bewertung ersetzt keine Rechtsberatung. Ob eine Miete zulässig ist,
        hängt zusätzlich von Sondermerkmalen ab — Ausstattung, energetischer
        Zustand, Modernisierungen —, die hier nicht erfasst werden.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link href="/check" className={buttonVariants({ variant: "outline", size: "lg" })}>
          <RotateCcw />
          Neue Prüfung
        </Link>
        <Link href="/karte" className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Zur Karte
          <ArrowRight />
        </Link>
      </div>
    </div>
  );
}

/** One of the two comparison figures, shown as a compact stat. */
function Yardstick({
  label,
  sub,
  value,
  delta,
  deltaTone,
}: {
  label: string;
  sub: string;
  value: string;
  delta: string;
  deltaTone: "over" | "under";
}) {
  return (
    <div className="rounded-lg border border-border/60 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={`text-xs font-medium tabular-nums ${
            deltaTone === "over"
              ? "text-amber-700 dark:text-amber-400"
              : "text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {delta}
        </span>
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 sm:grid-cols-[160px_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span>
        <span className="font-medium">{value}</span>
        {note && <span className="block text-xs text-muted-foreground mt-0.5">{note}</span>}
      </span>
    </div>
  );
}

const wohnlageLabels: Record<"einfach" | "mittel" | "gut", string> = {
  einfach: "einfach",
  mittel: "mittel",
  gut: "gut",
};

const mietspiegelStyle: Record<
  MietspiegelVerdict,
  { ring: string; bg: string; text: string; Icon: typeof CheckCircle2 }
> = {
  unter_spanne: {
    ring: "ring-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  in_spanne_unten: {
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  in_spanne_mitte: {
    ring: "ring-sky-500/40",
    bg: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-400",
    Icon: Info,
  },
  in_spanne_oben: {
    ring: "ring-sky-500/40",
    bg: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-400",
    Icon: Info,
  },
  ueber_mietpreisbremse: {
    ring: "ring-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  ueber_spanne: {
    ring: "ring-destructive/40",
    bg: "bg-destructive/10",
    text: "text-destructive",
    Icon: AlertCircle,
  },
};

/**
 * The Mietspiegel range as a bar: lower bound, mean, the +10 % line the
 * Mietpreisbremse hangs on, and where this flat sits. It replaces a
 * paragraph of numbers with one glance.
 */
function MietspiegelScale({
  mietspiegel,
  style,
}: {
  mietspiegel: NonNullable<NonNullable<CheckFormState["result"]>["mietspiegel"]>;
  style: { bg: string };
}) {
  const r = mietspiegel.row;
  const lower = r.valueLowerEurPerSqm;
  const median = r.valueMedianEurPerSqm;
  const upper = r.valueUpperEurPerSqm;
  const userPrice = mietspiegel.pricePerSqm;
  const limit = mietspiegel.mietpreisbremseLimitEurPerSqm;

  const range = upper - lower;
  const position = (value: number) =>
    range > 0 ? Math.max(0, Math.min(100, ((value - lower) / range) * 100)) : 50;

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div className="relative h-3 rounded-full bg-gradient-to-r from-emerald-500/30 via-sky-500/30 to-destructive/30">
          <div
            className="absolute top-0 h-3 w-px bg-foreground/60"
            style={{ left: `${position(median)}%` }}
            aria-hidden
          />
          <div
            className="absolute top-0 h-3 w-px bg-amber-600/80"
            style={{ left: `${position(limit)}%` }}
            aria-hidden
          />
          <div
            className="absolute -top-1 -ml-2 size-5 rounded-full border-2 border-background shadow ring-1 ring-foreground/20 transition-[left] duration-500 ease-out"
            style={{
              left: `${position(userPrice)}%`,
              background:
                mietspiegel.verdict === "ueber_spanne"
                  ? "var(--destructive)"
                  : mietspiegel.verdict === "ueber_mietpreisbremse"
                    ? "rgb(245 158 11)"
                    : "rgb(14 165 233)",
            }}
            aria-label={`Deine Miete: ${eur2(userPrice)} pro m²`}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{eur2(lower)} untere Spanne</span>
          <span>{eur2(median)} Mittel</span>
          <span>{eur2(upper)} obere Spanne</span>
        </div>
      </div>

      <p className={`rounded-lg ${style.bg} px-4 py-2.5 text-sm`}>
        Vergleichsmiete für {r.sizeSqmLabel}, Baujahr {r.baualterLabel}
        {r.westOst ? ` (${r.westOst === "ost" ? "Ost" : "West"})` : ""}, Wohnlage{" "}
        {wohnlageLabels[r.wohnlage]}:{" "}
        <strong>{eur2(median)} / m²</strong>
        {mietspiegel.deviationFromMedianEurPerSqm > 0 ? (
          <>
            {" "}— du zahlst{" "}
            <strong>+{eur2(mietspiegel.deviationFromMedianEurPerSqm)} / m²</strong>{" "}
            darüber, also {eur(mietspiegel.monthlyDeviationFromMedian)} im Monat.
          </>
        ) : (
          <>
            {" "}— du zahlst{" "}
            <strong>
              {eur2(Math.abs(mietspiegel.deviationFromMedianEurPerSqm))} / m²
            </strong>{" "}
            darunter.
          </>
        )}
      </p>
    </div>
  );
}
