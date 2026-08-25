-- =====================================================================
-- MietCheck Map — Mikro-Splitter aus Bezirks-Geometrien entfernen
-- =====================================================================
-- Pankow kommt aus dem amtlichen Datensatz als MultiPolygon mit vier
-- Teilen: dem echten Bezirk (103 km²) und drei Vermessungs-Artefakten von
-- rund 200 m², 20 m² und 4 m². Alle anderen Bezirke haben genau einen Teil.
--
-- Diese Splitter verursachen zwei sichtbare Fehler auf /karte:
--   1. MapLibre setzt Labels pro Polygon-Teil, nicht pro Feature — Pankow
--      wurde deshalb je nach Zoomstufe doppelt beschriftet.
--   2. Beim Vereinfachen für eine Kachel kollabieren derart kleine Ringe zu
--      entarteten Geometrien; die Triangulierung des gesamten Features
--      schlägt dann fehl und die Fläche bleibt ungefüllt. Das erklärt, warum
--      Pankow nur bei bestimmten Zoomstufen farblos war.
--
-- Wir filtern deshalb beim Schreiben: Teile unter 10.000 m² (1 ha) sind
-- keine realen Bezirksflächen. Zum Vergleich: ein Fußballfeld hat ~0,7 ha,
-- die kleinste echte Berliner Exklave liegt um Größenordnungen darüber.
-- Die Schwelle steckt in upsert_district, damit die monatliche
-- Auto-Ingestion die Artefakte nicht wieder einträgt.
-- =====================================================================

create or replace function public.clean_district_geometry(
  p_geom            geography,
  p_min_part_sqm    double precision default 10000
) returns geography
language sql
immutable
as $$
  -- ST_Dump zerlegt das MultiPolygon in seine Teile, wir behalten nur die
  -- flächenrelevanten und setzen sie wieder zusammen. ST_Multi garantiert
  -- den MULTIPOLYGON-Typ, den die Spalte verlangt, auch wenn am Ende genau
  -- ein Teil übrig bleibt.
  select st_multi(st_collect(part))::geography
  from (
    select (st_dump(p_geom::geometry)).geom as part
  ) parts
  where st_area(part::geography) >= p_min_part_sqm;
$$;

comment on function public.clean_district_geometry is
  'Drops MultiPolygon parts below a minimum area. Removes surveying slivers that break MapLibre fill rendering and duplicate its per-part labels.';


create or replace function public.upsert_district(
  p_city_id           text,
  p_name              text,
  p_level             text,
  p_geometry_geojson  text,
  p_parent_id         uuid default null
) returns uuid
language plpgsql
as $$
declare
  v_id       uuid;
  v_geometry geography;
begin
  -- ST_Multi promotes Polygon -> MultiPolygon to match the column type.
  v_geometry := st_multi(
    st_setsrid(st_geomfromgeojson(p_geometry_geojson), 4326)
  )::geography;

  -- Strip sliver parts before storing, so re-ingestion can't reintroduce
  -- the rendering bug they cause.
  v_geometry := public.clean_district_geometry(v_geometry);

  insert into public.districts (city_id, name, level, geometry, parent_id)
  values (p_city_id, p_name, p_level, v_geometry, p_parent_id)
  on conflict (city_id, name, level) do update
    set geometry  = excluded.geometry,
        parent_id = excluded.parent_id
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.upsert_district is
  'Idempotent upsert for districts, accepting geometry as GeoJSON text. Sliver parts below 1 ha are removed on write.';


-- Bestehende Zeilen einmalig nachziehen.
update public.districts
set geometry = public.clean_district_geometry(geometry)
where st_numgeometries(geometry::geometry) > 1;


-- =====================================================================
-- Label-Anker pro Bezirk
-- =====================================================================
-- Auch nach dem Splitter-Fix bleibt MapLibres Verhalten bestehen, Symbole
-- pro Polygon-Teil zu setzen — sobald eine Stadt echte Exklaven hat (bei
-- München/Hamburg wahrscheinlich), wären Doppel-Labels zurück. Wir liefern
-- deshalb einen expliziten Ankerpunkt mit und rendern die Beschriftung aus
-- einer eigenen Punkt-Quelle.
--
-- ST_PointOnSurface statt ST_Centroid: der Centroid eines u-förmigen oder
-- mehrteiligen Polygons kann außerhalb der Fläche liegen — genau der Grund,
-- warum Pankows Label früher neben dem Bezirk saß. PointOnSurface liegt
-- garantiert innerhalb. Angewandt auf den größten Teil, damit das Label
-- nicht an einer Exklave klebt.
-- =====================================================================

create or replace function public.get_districts_geojson(p_city_id text)
returns jsonb
language sql
stable
as $$
  with rents as (
    select
      rdp.district_id,
      rdp.value_median,
      rdp.sample_size,
      rdp.period_start,
      rdp.period_end,
      rdp.metric,
      rdp.source_id,
      ds.name      as source_name,
      ds.publisher as source_publisher,
      ds.source_url
    from public.rent_data_points rdp
    join public.data_sources ds on ds.id = rdp.source_id
    where rdp.metric = 'angebotsmiete_median_eur_per_sqm'
  ),
  latest_rent as (
    select distinct on (district_id) *
    from rents
    order by district_id, period_end desc
  ),
  rent_history as (
    select
      district_id,
      jsonb_agg(
        jsonb_build_object(
          'period_end', period_end,
          'value_median', value_median,
          'sample_size', sample_size
        ) order by period_end
      ) as history
    from rents
    group by district_id
  ),
  label_points as (
    select
      d.id,
      st_pointonsurface(largest.geom) as pt
    from public.districts d
    cross join lateral (
      select (st_dump(d.geometry::geometry)).geom as geom
      order by st_area((st_dump(d.geometry::geometry)).geom) desc
      limit 1
    ) largest
    where d.city_id = p_city_id and d.level = 'bezirk'
  )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'id', d.id,
          'properties', jsonb_build_object(
            'id',                    d.id,
            'name',                  d.name,
            'level',                 d.level,
            'label_lon',             st_x(lp.pt),
            'label_lat',             st_y(lp.pt),
            'rent_median',           lr.value_median,
            'rent_sample_size',      lr.sample_size,
            'rent_period_start',     lr.period_start,
            'rent_period_end',       lr.period_end,
            'rent_metric',           lr.metric,
            'rent_source_id',        lr.source_id,
            'rent_source_name',      lr.source_name,
            'rent_source_publisher', lr.source_publisher,
            'rent_source_url',       lr.source_url,
            'rent_history',          coalesce(rh.history, '[]'::jsonb)
          ),
          'geometry', st_asgeojson(d.geometry::geometry)::jsonb
        )
      ),
      '[]'::jsonb
    )
  )
  from public.districts d
  left join latest_rent  lr on lr.district_id = d.id
  left join rent_history rh on rh.district_id = d.id
  left join label_points lp on lp.id = d.id
  where d.city_id = p_city_id
    and d.level   = 'bezirk';
$$;

comment on function public.get_districts_geojson is
  'GeoJSON FeatureCollection of BEZIRK-level districts with latest median, rent history and an explicit label anchor (ST_PointOnSurface of the largest part).';
