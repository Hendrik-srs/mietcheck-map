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
  Scale,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  const style = verdictStyle[assessment.verdict];

  return (
    <div className="grid gap-6">
      {shared && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <Heart className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Danke für deinen Beitrag.</strong> Deine Miete wurde anonym zur
            Sichtprüfung gespeichert und erscheint nach Freigabe in der Datenbasis.
          </span>
        </div>
      )}

      {/* Verdict */}
      <Card className={`w-full ring-2 ${style.ring}`}>
        <CardHeader>
          <div className={`flex items-center gap-2 ${style.text}`}>
            <style.Icon className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {assessment.verdictLabel}
            </span>
          </div>
          <CardTitle className="text-3xl sm:text-4xl">
            Du zahlst{" "}
            <span className={style.text}>{pct(assessment.deviationPct)}</span>
            <br className="sm:hidden" /> gegenüber dem Markt-Median.
          </CardTitle>
          <CardDescription className="text-base">
            {assessment.verdictDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`rounded-lg ${style.bg} px-4 py-3 text-sm`}>
            <strong>{eur2(assessment.pricePerSqm)} / m²</strong> deine Miete{" "}
            vs. <strong>{eur2(assessment.comparisonMedian)} / m²</strong> Bezirks-Median in{" "}
            <strong>{district.parentDistrictName}</strong>.
            {assessment.monthlyOverpay > 0 && (
              <>
                <br />
                Differenz: ca. <strong>{eur(assessment.monthlyOverpay)}</strong> pro Monat /{" "}
                <strong>{eur(assessment.yearlyOverpay)}</strong> pro Jahr über dem Median.
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mietspiegel-Vergleich (rechtssicher) */}
      {mietspiegel && (
        <MietspiegelCard
          mietspiegel={mietspiegel}
          districtName={district.parentDistrictName}
          buildingYear={buildingYear}
        />
      )}

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details deiner Eingabe</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Adresse" value={address} note={displayName} />
          <Row label="Bezirk" value={district.parentDistrictName} />
          {district.districtLevel === "ortsteil" && (
            <Row label="Ortsteil" value={district.districtName} />
          )}
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
          {buildingYear != null && <Row label="Baujahr" value={String(buildingYear)} />}
          <Row label="Wohnfläche" value={`${sizeSqm.toLocaleString("de-DE")} m²`} />
          <Row label="Kaltmiete" value={eur(monthlyRent)} />
          <Row label="Preis pro m²" value={eur2(assessment.pricePerSqm)} />
        </CardContent>
      </Card>

      {/* Source */}
      {district.rentSourceUrl && district.rentSourceName && (
        <Card>
          <CardHeader>
            <Badge variant="secondary" className="w-fit text-xs">
              Quelle
            </Badge>
            <CardTitle className="text-base">{district.rentSourceName}</CardTitle>
            <CardDescription>
              {district.rentSourcePublisher}
              {district.rentPeriodEnd && (
                <> · Stand {new Date(district.rentPeriodEnd).getFullYear()}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href={district.rentSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Originalquelle ansehen <ExternalLink className="size-3.5" />
            </a>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Disclaimer:</strong> Diese Bewertung kombiniert
        zwei offizielle Quellen — den IBB-Angebotsmieten-Median (Marktvergleich) und ggf.
        den Berliner Mietspiegel 2024 (rechtssichere Vergleichsmiete) — aber sie ersetzt
        keine Rechtsberatung. Mietpreisbremsen-Bewertungen hängen zusätzlich von
        Sondermerkmalen (Ausstattung, energetischer Zustand, Modernisierungs-Stand) ab,
        die wir hier nicht erfassen. Wende dich für eine rechtssichere Prüfung an den
        Berliner Mieterverein, eine Mietrechtsberatung oder eine:n Fachanwält:in für
        Mietrecht.
      </div>

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

function MietspiegelCard({
  mietspiegel,
  districtName,
  buildingYear,
}: {
  mietspiegel: NonNullable<NonNullable<CheckFormState["result"]>["mietspiegel"]>;
  districtName: string;
  buildingYear: number | null;
}) {
  const s = mietspiegelStyle[mietspiegel.verdict];
  const r = mietspiegel.row;
  const lower = r.valueLowerEurPerSqm;
  const median = r.valueMedianEurPerSqm;
  const upper = r.valueUpperEurPerSqm;
  const userPrice = mietspiegel.pricePerSqm;
  const limit = mietspiegel.mietpreisbremseLimitEurPerSqm;

  // Position 0..100 % auf der unter-bis-oberen-Spanne
  const range = upper - lower;
  const userPosition =
    range > 0 ? Math.max(0, Math.min(100, ((userPrice - lower) / range) * 100)) : 50;
  const medianPosition =
    range > 0 ? Math.max(0, Math.min(100, ((median - lower) / range) * 100)) : 50;
  const limitPosition =
    range > 0 ? Math.max(0, Math.min(100, ((limit - lower) / range) * 100)) : 60;

  return (
    <Card className={`w-full ring-2 ${s.ring}`}>
      <CardHeader>
        <div className={`flex items-center gap-2 ${s.text}`}>
          <Scale className="size-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Mietspiegel-Vergleich · {mietspiegel.verdictLabel}
          </span>
        </div>
        <CardTitle className="text-xl">
          {mietspiegel.verdictDescription}
        </CardTitle>
        <CardDescription>
          Berliner Mietspiegel 2024, Wohnlage {wohnlageLabels[r.wohnlage]} ·{" "}
          {r.baualterLabel}
          {r.westOst ? ` (${r.westOst === "ost" ? "Ost" : "West"})` : ""} ·{" "}
          {r.sizeSqmLabel} · Bezirk {districtName}
          {buildingYear != null ? ` · Baujahr ${buildingYear}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* Spannen-Visualisierung */}
        <div className="grid gap-2">
          <div className="relative h-3 rounded-full bg-gradient-to-r from-emerald-500/30 via-sky-500/30 to-destructive/30">
            {/* Mittelwert-Marker */}
            <div
              className="absolute top-0 h-3 w-px bg-foreground/60"
              style={{ left: `${medianPosition}%` }}
              aria-hidden
            />
            {/* Mietpreisbremse-Schwelle (Mittel + 10%) */}
            <div
              className="absolute top-0 h-3 w-px bg-amber-600/80"
              style={{ left: `${limitPosition}%` }}
              aria-hidden
            />
            {/* User-Marker */}
            <div
              className="absolute -top-1 -ml-2 size-5 rounded-full border-2 border-background shadow ring-1 ring-foreground/20"
              style={{
                left: `${userPosition}%`,
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
            <span>{eur2(lower)} (untere Spanne)</span>
            <span>{eur2(median)} Mittel</span>
            <span>{eur2(upper)} (obere Spanne)</span>
          </div>
        </div>

        <div className={`rounded-lg ${s.bg} px-4 py-3 text-sm`}>
          <strong>{eur2(userPrice)} / m²</strong> deine Miete vs.{" "}
          <strong>{eur2(median)} / m²</strong> Mietspiegel-Mittelwert.
          {mietspiegel.deviationFromMedianEurPerSqm > 0 ? (
            <>
              <br />
              Differenz: <strong>+{eur2(mietspiegel.deviationFromMedianEurPerSqm)} / m²</strong> über
              dem Mittelwert (+{eur(mietspiegel.monthlyDeviationFromMedian)} pro Monat / +
              {eur(mietspiegel.yearlyDeviationFromMedian)} pro Jahr).
            </>
          ) : (
            <>
              <br />
              Differenz: <strong>{eur2(Math.abs(mietspiegel.deviationFromMedianEurPerSqm))} / m²</strong> unter
              dem Mittelwert.
            </>
          )}
        </div>

        {mietspiegel.potentialMietpreisbremseViolation && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
            <strong className="text-amber-700 dark:text-amber-400">
              Mietpreisbremse-Hinweis:
            </strong>{" "}
            Deine Miete liegt über Mittelwert + 10 % ({eur2(limit)} / m²). Berlin ist
            Mietpreisbremsen-Gebiet — abhängig von Ausstattung und Energieeffizienz
            kann das ein Verstoß sein. Eine Beratung beim Berliner Mieterverein oder
            einer Fachanwaltskanzlei für Mietrecht wird empfohlen.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
