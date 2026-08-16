-- =====================================================================
-- MietCheck Map — get_districts_overview() für die Landing-Page
-- =====================================================================
-- Die Landing-Page soll das Produkt sofort zeigen: eine kleine Berlin-
-- Heatmap, server-gerendert als reines SVG. Kein MapLibre, keine Tiles,
-- kein Client-JS — die Karte ist da, sobald das HTML da ist.
--
-- Dafür brauchen wir dieselben 12 Bezirke wie get_districts_geojson,
-- aber mit zwei Unterschieden:
--   1. ST_Simplify (Douglas-Peucker) reduziert die Stützpunkte drastisch.
--      Toleranz 0.0005° ≈ 40 m — bei einer ~400 px breiten Hero-Grafik
--      weit unterhalb eines Pixels, also visuell verlustfrei.
--   2. Kein rent_history, keine Source-Felder. Die Landing zeigt nur
--      Name + Median; alles Weitere lebt auf /karte.
--
-- Ergebnis: ~30 KB statt ~1,2 MB GeoJSON.
-- =====================================================================

create or replace function public.get_districts_overview(
  p_city_id   text,
  p_tolerance double precision default 0.0005
)
returns jsonb
language sql
stable
as $$
  with latest_rent as (
    select distinct on (rdp.district_id)
      rdp.district_id,
      rdp.value_median
    from public.rent_data_points rdp
    where rdp.metric = 'angebotsmiete_median_eur_per_sqm'
    order by rdp.district_id, rdp.period_end desc, rdp.created_at desc
  )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'id', d.id,
          'properties', jsonb_build_object(
            'id',          d.id,
            'name',        d.name,
            'rent_median', lr.value_median
          ),
          -- ST_SimplifyPreserveTopology statt ST_Simplify: verhindert,
          -- dass kleine Polygone (z.B. Exklaven) bei hoher Toleranz
          -- kollabieren und als ungültige Geometrie rausfallen.
          'geometry', st_asgeojson(
            st_simplifypreservetopology(d.geometry::geometry, p_tolerance)
          )::jsonb
        )
        order by d.name
      ),
      '[]'::jsonb
    )
  )
  from public.districts d
  left join latest_rent lr on lr.district_id = d.id
  where d.city_id = p_city_id
    and d.level   = 'bezirk';
$$;

comment on function public.get_districts_overview is
  'Lightweight GeoJSON (simplified geometry + name + latest median only) for the server-rendered landing-page heatmap. ~30 KB vs ~1.2 MB for get_districts_geojson.';
