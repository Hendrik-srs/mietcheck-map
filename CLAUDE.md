Workflow-Guide → docs/WORKFLOW.md

@AGENTS.md

# MietCheck Map — Projekt-Kontext für Claude

## Worum es geht

Open-Source-Mietpreis-Karte für Deutschland mit Fairness-Check. USP: **ausschließlich
offizielle, frei zugängliche Quellen** (Mietspiegel, IBB, Destatis, BBSR, BORIS-D,
Open Data der Länder). Kein Scraping. Jeder Datenpunkt mit Quelle verlinkt.
Ziel: portfolio-tauglich, später potenziell monetarisierbar.

Live: https://mietcheck-map.vercel.app · Repo: https://github.com/Hendrik-srs/mietcheck-map

## Aktueller Stand

**Live (✅):** Phase 1 (Setup) · 2.1 (12 Bezirks-Geometrien)
· 2.1b (96 Ortsteil-Geometrien, feinerer Adress-Lookup)
· 2.2 (IBB-Mietdaten 2012–25) · 2.2b (Berliner Mietspiegel 2024 + 401k Wohnlagen-Adressen)
· 2.4 (Auto-Ingestion via GitHub Actions, monatlich + täglicher Drift-Check)
· 3.1–3.4 (`/karte` mit Heatmap + Detail-Sheet) · 5.1 (Historie) · 5.2 (Trend-Chart)
· 5.3 (SEO-Seiten `/bezirk/[slug]` für alle 12 Bezirke + OG-Image + JSON-LD)
· 5.4 (Öffentliche Quellen-Übersicht `/quellen`)
· 4.1–4.4 MVP + 4.5 (`/check` mit IBB-Markt-Vergleich + Mietspiegel-Vergleich +
anonymem Opt-in-Beitrag) · Keep-Alive (Cron + Heartbeat)

**Was als nächstes ansteht** (in Prioritätsreihenfolge):
1. **Phase 6** — München/Hamburg/Köln
2. **Phase 3.5** — Stadt-Wechsel-UI (sobald Phase 6 läuft)
3. **Phase 4.5+** — Crowdsourced-Mieten in Karte/Verdict einbinden, sobald Volumen da
4. **Phase 4.6 (optional)** — Sondermerkmale-/Spanneneinordnung-Slider im Mietspiegel-Vergleich
5. **Phase 7** — Monetarisierung (Premium-PDF-Report, Affiliate, API-Access)

**Operative Notizen**
- **Crowdsourced-Submissions** liegen als `status='pending'` in `crowdsourced_rents`.
  Review im Supabase-Studio: Status auf `approved` setzen → Eintrag wird public.
- **GitHub-Repo-Secrets** für `auto-ingest.yml` einmalig setzen:
  `NEXT_PUBLIC_SUPABASE_URL` und `SUPABASE_SECRET_KEY` (Settings → Secrets and
  variables → Actions). Workflow läuft sonst automatisch monatlich.

**Bekannte Caveats / TODOs**
- **MapLibre-Tiles laden in der Preview-Umgebung unzuverlässig**: mal
  rendern Basemap und Glyphen, mal bleibt die Fläche leer — unabhängig vom
  Code. Eigene GeoJSON-Layer (Bezirke, Bundesländer) zeichnen trotzdem.
  Heißt: `berlin-map-inner.tsx` nach Deploy auf der Live-URL gegenchecken,
  besonders Basemap-Wechsel (positron/dark) und Label-Layer.
- **MapLibre beschriftet pro Polygon-*Teil***: Ein Symbol-Layer auf einer
  Polygon-Quelle rendert den Namen für jeden Teil eines MultiPolygons —
  Schleswig-Holstein achtmal (Inseln), Pankow zweimal (Vermessungs-Splitter).
  Beschriftungen laufen deshalb über eigene **Punkt-Quellen** mit je einem
  Anker pro Gebiet (`label_lon/lat` aus PostGIS bzw. `labelLon/labelLat` im
  Bundesland-JSON). Bei neuen Layern gleich so anlegen.
- **React 19 hoisted `<title>`**: In SVGs darf kein `<title>`-Kind stehen —
  React behandelt es als Document-Metadata und verschiebt es in den `<head>`,
  was die Hydration bricht (React-Error #418). Für SVG-Tooltips/a11y
  stattdessen `aria-label` nutzen. Kostete in dieser Session eine
  Debug-Runde, siehe `germany-preview.tsx`.
- **West/Ost-Sonderfall im Mietspiegel** (Bj. 1973–1990): konservativ pro Bezirk
  inferiert, weil das offizielle Straßenverzeichnis nur als PDF im Amtsblatt
  existiert. Ungenauigkeit ~5 % der Wohnungen mit diesem Baujahr. Fix wäre
  Phase 4.6 oder ein eigenes Straßenverzeichnis-Ingest.
- **Sondermerkmale im Mietspiegel-Verdict** (Aufzug, EBK, energetisch …) werden
  aktuell nicht berücksichtigt. Verdict prüft nur Spannenposition + Mittel+10 %.
  Phase 4.6 würde einen Spanneneinordnungs-Slider einführen.
- **Keep-alive Runner-Allocation**: am 06.05.2026 einmal cancelled (GitHub-Runner-
  Pool-Glitch, kein Code-Bug). Gehärtet mit zweitem Slot um 18:17 UTC. Wenn
  beides an einem Tag failt → Supabase erst nach 7 Tagen ohne Ping pausiert.
- **`/karte` nutzt nicht SiteHeader**: absichtlich, weil die Map ein eigenes
  Overlay-Pattern (pointer-events) hat. Bei künftigen Header-Änderungen
  Map-Header separat anfassen.
- **Wohnlagen-Ingest dauert ~10 Min** wegen 401 095 Adressen × 2 000 pro Batch
  über den WFS. Idempotent — Re-Run überschreibt in place. Auto-Ingest läuft
  monatlich um 02:30 UTC, kein User-Impact.

→ **Details aller offenen Phasen:** [docs/ROADMAP.md](docs/ROADMAP.md)
→ **Was/Wie/Warum bei fertigen Phasen:** [docs/BUILD_EXPLANATION.md](docs/BUILD_EXPLANATION.md)

## Architektur-Überblick

**Stack:** Next.js 16 (App Router) + TS · Tailwind v4 + shadcn/ui (base-ui-Variante)
· Supabase Postgres+PostGIS (Frankfurt) · MapLibre GL JS · Recharts · Vercel
· OpenFreeMap-Tiles · Nominatim-Geocoder · GitHub Actions (Keep-Alive).

```
src/
├── app/
│   ├── page.tsx                  # Landing
│   ├── karte/page.tsx            # Karte (Server, lädt districts via rpc)
│   ├── check/                    # Fairness-Check
│   │   ├── page.tsx              # Server Component
│   │   ├── check-form.tsx        # Client (useActionState + Verdict)
│   │   └── actions.ts            # "use server" + Zod
│   ├── bezirk/[slug]/
│   │   ├── page.tsx              # SEO-Bezirks-Seite (JSON-LD Place)
│   │   └── opengraph-image.tsx   # next/og PNG pro Bezirk
│   ├── quellen/page.tsx          # Datenquellen-Transparenz
│   │                             # Landing: page.tsx zieht Stats/Quellen live
│   │                             # aus der DB (keine hartkodierten Claims)
│   ├── sitemap.ts                # Sitemap (16 URLs)
│   └── robots.ts
├── components/
│   ├── site-header.tsx           # Shared Nav (Logo + Karte/Check/Quellen)
│   ├── ui/                       # shadcn Komponenten
│   └── map/                      # berlin-map(-inner).tsx + rent-history-chart.tsx
└── lib/
    ├── slugs.ts                  # Berlin-Bezirks-Slugs (build-time-known)
    ├── geocoding.ts              # Nominatim-Wrapper
    ├── rent-color.ts             # geteilte Choropleth-Skala (MapLibre + SVG)
    ├── geo-projection.ts         # Mercator + SVG-Pfade für die Hand-SVG-Karten
    ├── data/germany-states.json  # 16 Bundesländer, vereinfacht (Eurostat NUTS)
    ├── data/{districts,overview,fairness,crowdsourced,mietspiegel,sources}.ts
    └── supabase/{browser,server,static,admin}.ts

components/
├── theme-toggle.tsx              # Hell/Dunkel; Klasse setzt Inline-Script im Layout
└── map/germany-preview.tsx       # Landing: statisches SVG, verlinkt auf /karte

scripts/ingest/                   # berlin-districts.ts, berlin-ortsteile.ts,
                                  # berlin-ibb.ts, berlin-wohnlagen.ts,
                                  # berlin-mietspiegel-2024.ts
                                  # data/berlin-mietspiegel-2024.json (eingecheckt)
supabase/migrations/              # 0001..0016 (manuell im SQL Editor anwenden)
scripts/build-germany-geometry.ts # einmalig: Eurostat NUTS → germany-states.json
.github/workflows/keep-alive.yml  # Daily Ping + Heartbeat-Commit alle 30 Tage
.github/workflows/auto-ingest.yml # Monatliche Re-Ingestion + täglicher Drift-Check
```

**Tabellen:** `cities` · `districts` (MULTIPOLYGON, hierarchisch: 12 Bezirke +
96 Ortsteile mit `parent_id` → Bezirk) · `data_sources` · `rent_data_points`
(Long-Format pro source × district × period × metric, ausschließlich auf
Bezirks-Granularität) · `crowdsourced_rents` (anonyme Opt-in-Submissions, RLS
public-read nur für `status='approved'`) · `berlin_wohnlagen` (≈401k
Adress-Punkte + Wohnlage, GiST-Index für KNN-Lookup) · `berlin_mietspiegel_2024`
(163 Zeilen aus dem offiziellen Mietspiegel-PDF).
RLS aktiviert, public-read, Writes nur via admin-Client.

**RPCs:** `upsert_city/district/rent_data_point` · `get_districts_geojson(city_id)`
(GeoJSON, gefiltert auf `level='bezirk'` damit Heatmap die 12 Polygone behält
+ `rent_history`) · `find_district_by_point(city_id, lon, lat)` (`ST_Covers`
bevorzugt Ortsteil-Treffer, liefert zusätzlich `parent_district_*`; Rent-Join
läuft über den Parent-Bezirk) · `find_mietspiegel_2024_row(wohnlage, baujahr,
sqm, west_ost)` (passende Tabellenzeile) · `get_districts_overview(city_id,
tolerance)` (ST_Simplify-Geometrien + Median, ~30 KB statt ~1,2 MB — speist
die server-gerenderte SVG-Heatmap auf der Landing) · `submit_crowdsourced_rent`
(Service-Role-only, insert als pending) · `upsert_berlin_wohnlagen_batch`/
`upsert_berlin_mietspiegel_2024_batch` (Bulk-Ingest via JSONB).

**Rendering-Strategie:** Alle öffentlichen Seiten (`/`, `/karte`, `/quellen`,
`/bezirk/[slug]`) sind statisch prerendert mit ISR (`revalidate` 1 h – 1 d).
Voraussetzung dafür ist `lib/supabase/static.ts` — ein Client **ohne**
`cookies()`, denn `cookies()` zwingt eine Route in dynamisches Rendering.
Für Server Actions und alles Auth-abhängige weiterhin `lib/supabase/server.ts`.

**Eine Karte, zwei Detailstufen.** `/karte` ist die einzige interaktive
Karte und startet in der Deutschlandansicht — genau dem Bild, das die
Landing-Vorschau zeigt, aus der man kommt. Die Übergabe zwischen den Ebenen
passiert in einem schmalen Zoomband, damit sie als *eine* Geste lesbar ist:
die farbige Landesfläche teilt sich in ihre Bezirke.

| Zoom | Bundesländer | Bezirke | Beschriftung |
|---|---|---|---|
| < 6 | Fläche, klickbar | unsichtbar | keine |
| 6 – 8.0 | Fläche, klickbar | unsichtbar | Bundesländer |
| 8.0 – 8.4 | blenden aus | blenden ein | Übergang |
| > 8.4 | weg | Heatmap, klickbar | Bezirke |

Konstanten: `STATE_LABEL_ZOOM`, `SPLIT_START`, `SPLIT_END`. Berlin trägt den
Durchschnitt seiner Bezirks-Mediane in derselben Farbskala; Länder ohne
Daten bleiben neutral grau und sagen das beim Klick auch.
`interactiveLayerIds` schaltet mit: anklickbar ist immer nur, was man sehen
und treffen kann.

**Adress-Eingabe mit Vorschlägen.** `/check` nutzt Photon (Komoot,
OSM-basiert, für Type-ahead gebaut — Nominatim bittet ausdrücklich darum,
nicht dafür verwendet zu werden) über den eigenen Route Handler
`/api/adress-vorschlaege`. Der Proxy sorgt dafür, dass IP und halbfertige
Adresse nicht zu einem Dritten gehen. Zweistufig: Straßen-Treffer füllen den
Namen und lassen die Hausnummer folgen, Adress-Treffer schließen ab und
liefern `lat`/`lon` als Hidden Fields mit — der Server spart den
Geocode-Roundtrip und Tippfehler sind ausgeschlossen. Die Koordinaten kommen
vom Client, werden also gegen Berlins Bounding-Box geprüft, sonst
Fallback auf Nominatim.

**Plausibilitätsband für Beiträge.** `PLAUSIBLE_RENT_PER_SQM` (3–60 €/m²)
in `lib/data/crowdsourced.ts` und dieselbe Prüfung in
`submit_crowdsourced_rent` (Migration 0016). Nicht um ungewöhnliche Mieten
zu filtern — die sind der Sinn von Crowdsourcing — sondern um Werte
abzuweisen, die keine Miete sein können, bevor sie Moderationszeit kosten.

**Ergebnisseite: eine Antwort, dann der Kontext.** `/check` liefert zwei
Urteile, die sich regelmäßig widersprechen — der Marktmedian sagt, was
verlangt wird, der Mietspiegel, was zulässig ist. Eine Wohnung kann unter
dem Markt und trotzdem über der Mietpreisbremse liegen. Gleichwertig
nebeneinander gestellt liest sich das als Widerspruch, deshalb führt die
rechtlich relevante Aussage (Mietspiegel, sofern Baujahr angegeben), der
Marktwert folgt als Einordnung, und der Grund für die Lücke steht einmal in
Klartext im Block „Zwei Maßstäbe". Drei Karten statt vorher sechs, ohne dass
Information wegfällt.

**Beschriftung gehört uns.** `hideBasemapStateLabels()` schaltet die
Bundesland-Labels der Basemap ab (`label_state` in positron, `place_state`
in dark — deshalb Muster statt fester ID, und erneut bei jedem
`onStyleData`, weil ein Stilwechsel alle Layer neu aufbaut). Sonst stehen
zwei Beschriftungen übereinander: graue der Basemap, weiße von uns.
Die Landing zeigt nur `GermanyPreview`: ein statisches, server-gerendertes
SVG, das als **Link** auf `/karte` dient. Der Hero hat genau einen
Call-to-Action ("Miete prüfen") — ein "Karte ansehen"-Button direkt neben
einer anklickbaren Karte teilt dieselbe Entscheidung nur in zwei.

**Theming:** Hell/Dunkel über eine `.dark`-Klasse auf `<html>`. Gesetzt wird
sie von einem Inline-Script im Root-Layout **vor dem ersten Paint** (sonst
Flash), `theme-toggle.tsx` spiegelt und kippt sie nur. Wer den Zustand
braucht, liest ihn synchron aus dem DOM — ein Effect, der erst nach dem
ersten Render korrigiert, lässt MapLibre mitten im Style-Laden umschalten.

## Konventionen & Regeln

1. **Migrations**: chronologisch in `supabase/migrations/`. Nach `Write` einer
   Migration auf User-Bestätigung warten ("Success. No rows returned"), dann erst
   weitermachen. Supabase CLI ist absichtlich noch nicht eingerichtet.
2. **Env-Vars**: `NEXT_PUBLIC_*` öffentlich ok, `SUPABASE_SECRET_KEY` server-only.
   Worktree braucht Symlink: `ln -s ../../../.env.local .env.local` vom
   Worktree-Root aus, danach Server-Restart.
3. **Daten-Quellen-Regel**: Nichts scrapen. Wenn nur per Scraping verfügbar —
   andere Quelle suchen oder Datenpunkt weglassen. UI zeigt immer Quelle + Lizenz.
4. **Push-Workflow**: User arbeitet auf Worktree-Branch, Push direkt nach main via
   `git push origin HEAD:main`. Kein PR-Step. Vercel deployt automatisch.
5. **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
   Pro Roadmap-Schritt: `feat(phase-X.Y): kurze Zusammenfassung`.
6. **Sprache**: Deutsch in UI-Texten und mit User. English in Code-Kommentaren
   und Commit-Messages.
7. **Komponenten**: Server Components default, `"use client"` nur bei Bedarf.
   Functional, mit TypeScript-Props.
8. **Icons**: lucide-react. `Github`-Icon existiert nicht (Markenrecht raus) —
   stattdessen `Code2` oder Inline-SVG.
9. **Ingestion-Scripts sind idempotent**: Re-runs überschreiben in place.

→ **Bug-Lessons & Gotchas** (MapLibre-Property-Flattening, base-ui Button+Link,
Layout-Kollaps, Next.js-16-Caching): in meinem persistenten Memory gespeichert,
ich konsultiere sie wenn relevant.

## Befehle

```bash
npm run dev                       # Dev-Server (Turbopack), http://localhost:3000
npm run build                     # Production-Build (lokal vor Push verifizieren)
npm run lint                      # ESLint
npm run start                     # Production-Server (lokal nach build)

# Ingestion (idempotent, brauchen .env.local mit SUPABASE_SECRET_KEY)
npm run ingest:berlin-districts          # Geoportal Berlin → 12 Bezirke
npm run ingest:berlin-ortsteile          # Geoportal Berlin → 96 Ortsteile (parent_id = Bezirk)
npm run ingest:berlin-ibb                # IBB Wohnungsmarktbericht → 168 rent points
npm run ingest:berlin-wohnlagen          # WFS → ≈401k Adressen mit Wohnlage (~min)
npm run ingest:berlin-mietspiegel-2024   # JSON-Datei → 163 Mietspiegel-Zeilen
npm run ingest:all                       # alle 5 nacheinander (auto-ingest-Workflow)
```

## Was beim Session-Start zu tun ist

1. `git status` + `git log -5` zur Orientierung
2. Status-Sektion oben zeigt was live ist und was als nächstes ansteht.
   Letzter Commit gibt zusätzlichen Hinweis.
3. User fragen, ob die Top-Priorität angegangen wird oder Sprung an andere Stelle
4. Konkreten Schritt aus [ROADMAP](docs/ROADMAP.md) nehmen, eigene Task-Liste
   bauen (`TaskCreate`/`TaskUpdate`), abarbeiten
5. Pro Schritt: Commit + `git push origin HEAD:main` + visuelle Verifikation
6. Vor Migrations-Anwendung auf User-Bestätigung warten

→ **Tiefe Recherche zu fertigen Features** (warum X gewählt, wie zusammengesetzt):
[docs/BUILD_EXPLANATION.md](docs/BUILD_EXPLANATION.md) — nur lesen wenn die
aktuelle Aufgabe etwas Gebautes erweitert oder anfasst.
