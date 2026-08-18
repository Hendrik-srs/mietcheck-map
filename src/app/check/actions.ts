"use server";

import { z } from "zod";

import { findDistrictByPoint, assessFairness } from "@/lib/data/fairness";
import {
  submitCrowdsourcedRent,
  buildingYearToBracket,
  isPlausibleRentPerSqm,
  PLAUSIBLE_RENT_PER_SQM,
} from "@/lib/data/crowdsourced";
import {
  findMietspiegelRow,
  assessMietspiegel,
  inferWestOstFromBezirk,
} from "@/lib/data/mietspiegel";
import { geocodeAddressInBerlin } from "@/lib/geocoding";
import type { FairnessAssessment, DistrictRentLookup } from "@/lib/data/fairness";
import type { MietspiegelAssessment } from "@/lib/data/mietspiegel";

const schema = z.object({
  address: z.string().trim().min(5, "Bitte vollständige Adresse eingeben."),
  sizeSqm: z.coerce
    .number()
    .gt(5, "Wohnfläche zu klein.")
    .lt(1000, "Wohnfläche zu groß."),
  monthlyRent: z.coerce
    .number()
    .gt(50, "Miete zu niedrig.")
    .lt(20000, "Miete zu hoch."),
  buildingYear: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1800).max(2099).optional(),
  ),
});


/** Berlin's bounding box, used to sanity-check client-supplied coordinates. */
const BERLIN_BOUNDS = { minLon: 13.0, minLat: 52.3, maxLon: 13.8, maxLat: 52.7 };

function coordinatesFromForm(
  formData: FormData,
): { lat: number; lon: number } | null {
  const lat = Number(formData.get("lat"));
  const lon = Number(formData.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < BERLIN_BOUNDS.minLat || lat > BERLIN_BOUNDS.maxLat) return null;
  if (lon < BERLIN_BOUNDS.minLon || lon > BERLIN_BOUNDS.maxLon) return null;
  return { lat, lon };
}

type FormValues = {
  address: string;
  sizeSqm: string;
  monthlyRent: string;
  buildingYear: string;
  share: boolean;
};

export interface CheckFormState {
  status: "idle" | "error" | "success";
  errors?: Partial<
    Record<
      "address" | "sizeSqm" | "monthlyRent" | "buildingYear" | "share" | "_form",
      string
    >
  >;
  // Echo back what the user typed so the form keeps its values after a failed submit.
  values?: FormValues;
  result?: {
    address: string;
    displayName: string;
    sizeSqm: number;
    monthlyRent: number;
    buildingYear: number | null;
    district: DistrictRentLookup;
    assessment: FairnessAssessment;
    mietspiegel: MietspiegelAssessment | null;
    shared: boolean;
  };
}

export async function runFairnessCheck(
  _prev: CheckFormState,
  formData: FormData,
): Promise<CheckFormState> {
  const rawShare = formData.get("share");
  const rawBuildingYear = formData.get("buildingYear");
  const raw = {
    address: String(formData.get("address") ?? ""),
    sizeSqm: String(formData.get("sizeSqm") ?? ""),
    monthlyRent: String(formData.get("monthlyRent") ?? ""),
    buildingYear: typeof rawBuildingYear === "string" ? rawBuildingYear : "",
    share: rawShare === "on" || rawShare === "true",
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    return {
      status: "error",
      values: raw,
      errors: {
        address: flat.address?.[0],
        sizeSqm: flat.sizeSqm?.[0],
        monthlyRent: flat.monthlyRent?.[0],
        buildingYear: flat.buildingYear?.[0],
      },
    };
  }

  const { address, sizeSqm, monthlyRent } = parsed.data;
  const buildingYear: number | null = parsed.data.buildingYear ?? null;

  // The autocomplete submits the coordinates of the entry the user picked,
  // which saves a geocoding round-trip and rules out the typos that made
  // free-text lookups fail. Client-supplied, so it is range-checked against
  // Berlin before use — a bad value only ever misleads the sender, but
  // falling back to the geocoder is both safer and more helpful.
  const picked = coordinatesFromForm(formData);

  let geocoded: { lat: number; lon: number; displayName: string } | null = picked
    ? { ...picked, displayName: address }
    : null;

  if (!geocoded) {
    try {
      geocoded = await geocodeAddressInBerlin(address);
    } catch (e) {
      console.error("[check] geocoding error", e);
      return {
        status: "error",
        values: raw,
        errors: { _form: "Geocoding-Dienst gerade nicht erreichbar. Bitte später erneut versuchen." },
      };
    }
  }

  if (!geocoded) {
    return {
      status: "error",
      values: raw,
      errors: { address: "Adresse nicht gefunden. Bitte Straße, Hausnummer und PLZ prüfen." },
    };
  }

  let district;
  try {
    district = await findDistrictByPoint("berlin", geocoded.lon, geocoded.lat);
  } catch (e) {
    console.error("[check] district lookup error", e);
    return {
      status: "error",
      values: raw,
      errors: { _form: "Bezirks-Lookup fehlgeschlagen. Bitte später erneut versuchen." },
    };
  }

  if (!district) {
    return {
      status: "error",
      values: raw,
      errors: {
        address:
          "Diese Adresse liegt außerhalb von Berlin. Andere Städte folgen — siehe Roadmap.",
      },
    };
  }

  if (district.rentMedian == null) {
    return {
      status: "error",
      values: raw,
      errors: {
        _form: `Für ${district.parentDistrictName} liegen aktuell keine Vergleichsmieten vor.`,
      },
    };
  }

  const assessment = assessFairness(monthlyRent, sizeSqm, district.rentMedian);

  // Mietspiegel-Vergleich nur möglich, wenn (a) wir die Wohnlage haben und
  // (b) der User ein Baujahr angegeben hat. Bei Lookup-Fehlern fallen wir
  // still auf null zurück — das verändert das IBB-Verdict nicht.
  // West/Ost-Inferenz braucht den Bezirks-Namen (nicht den Ortsteil).
  let mietspiegel: MietspiegelAssessment | null = null;
  if (district.wohnlage && buildingYear != null) {
    try {
      const westOst = inferWestOstFromBezirk(district.parentDistrictName);
      const row = await findMietspiegelRow(
        district.wohnlage,
        buildingYear,
        sizeSqm,
        westOst,
      );
      if (row) {
        mietspiegel = assessMietspiegel(monthlyRent, sizeSqm, row);
      }
    } catch (e) {
      console.error("[check] mietspiegel lookup failed", e);
    }
  }

  let shared = false;
  if (raw.share) {
    // Checked before writing: the map only shows approved rows, but junk
    // still costs a human the time to reject it.
    const pricePerSqm = monthlyRent / sizeSqm;
    if (!isPlausibleRentPerSqm(pricePerSqm)) {
      return {
        status: "error",
        values: raw,
        errors: {
          share: `Das ergibt ${pricePerSqm.toLocaleString("de-DE", {
            maximumFractionDigits: 2,
          })} € pro m². Für einen Beitrag zur Karte erwarten wir ${
            PLAUSIBLE_RENT_PER_SQM.min
          }–${PLAUSIBLE_RENT_PER_SQM.max} € pro m². Bitte Wohnfläche und Kaltmiete prüfen — oder das Häkchen entfernen, dann rechnen wir dir das Ergebnis trotzdem aus.`,
        },
      };
    }
    try {
      // crowdsourced_rents speichert auf Bezirks-Ebene — IBB-Vergleiche
      // existieren nur dort.
      await submitCrowdsourcedRent({
        districtId: district.parentDistrictId,
        sizeSqm,
        monthlyRentEur: monthlyRent,
        buildingAgeBracket:
          buildingYear == null ? null : buildingYearToBracket(buildingYear),
      });
      shared = true;
    } catch (e) {
      // Submission is opt-in and best-effort. A failure here must not break
      // the user's verdict, so we log and surface a silent shared=false.
      console.error("[check] crowdsourced submission failed", e);
    }
  }

  return {
    status: "success",
    result: {
      address,
      displayName: geocoded.displayName,
      sizeSqm,
      monthlyRent,
      buildingYear,
      district,
      assessment,
      mietspiegel,
      shared,
    },
  };
}
