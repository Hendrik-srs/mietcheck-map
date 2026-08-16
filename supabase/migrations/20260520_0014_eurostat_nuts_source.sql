-- =====================================================================
-- MietCheck Map — Eurostat NUTS als Quelle registrieren
-- =====================================================================
-- Die Landing-Karte zeigt die 16 Bundesländer als Kontext (wo liegen
-- Daten vor, wo noch nicht). Die Geometrien stammen aus den amtlichen
-- NUTS-Grenzen von Eurostat (Level 1 = Bundesländer) und liegen als
-- vereinfachtes GeoJSON im Repo unter src/lib/data/germany-states.json.
--
-- Sie werden nicht ingestiert, sondern zur Build-Zeit erzeugt
-- (scripts/build-germany-geometry.ts). Trotzdem gehören sie in die
-- Quellen-Registry: Die Seite behauptet, jeder angezeigte Wert sei
-- quellen-belegt, und die Quellenliste auf Landing und /quellen wird
-- direkt aus dieser Tabelle gerendert. Eine benutzte, aber nicht
-- gelistete Quelle wäre genau die Lücke, die das Projekt vermeiden will.
-- =====================================================================

insert into public.data_sources (
  id, name, publisher, source_url, license, source_type, reference_date, notes
) values (
  'eurostat_nuts_2024_level1',
  'NUTS 2024 — Bundesländer-Geometrien (Level 1)',
  'Eurostat (Europäische Kommission)',
  'https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics',
  'Eurostat GISCO, freie Nachnutzung mit Quellenangabe — Verwaltungsgrenzen © EuroGeographics',
  'open_data',
  '2024-01-01',
  'Amtliche NUTS-Grenzen, Level 1 entspricht für Deutschland den 16 Bundesländern. Nur als geografischer Kontext auf der Startseite verwendet — es hängen keine Mietwerte daran. Vereinfacht (Douglas-Peucker) und als statisches GeoJSON im Repo abgelegt.'
)
on conflict (id) do update
  set name           = excluded.name,
      publisher      = excluded.publisher,
      source_url     = excluded.source_url,
      license        = excluded.license,
      source_type    = excluded.source_type,
      reference_date = excluded.reference_date,
      notes          = excluded.notes;
