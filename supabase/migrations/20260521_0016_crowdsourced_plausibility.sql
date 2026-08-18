-- =====================================================================
-- MietCheck Map — Plausibilitätsband für Crowdsourced-Mieten
-- =====================================================================
-- Bisher nahm submit_crowdsourced_rent jeden Wert an: 0,10 €/m² ebenso wie
-- 999 999 €/m². Die Karte verzerrt das nicht, weil Einträge erst nach
-- Freigabe sichtbar werden — aber die Moderation muss den Unsinn per Hand
-- aussortieren, und je mehr Einträge kommen, desto weniger trägt das.
--
-- Wir prüfen deshalb den Quadratmeterpreis gegen ein realistisches Band.
-- 3 €/m² liegt unter jeder Berliner Bestandsmiete (der Mietspiegel 2024
-- beginnt bei 4,79 €/m²), 60 €/m² weit über der teuersten Neubau-Lage.
-- Alles dazwischen bleibt möglich, auch Ausreißer — abgewiesen wird nur,
-- was physisch keine Miete sein kann.
--
-- Die Server-Action prüft dasselbe Band für sofortiges Feedback im
-- Formular; diese Prüfung hier ist die Ebene, die auch dann greift, wenn
-- jemand die RPC direkt aufruft.
-- =====================================================================

create or replace function public.submit_crowdsourced_rent(
  p_district_id           uuid,
  p_size_sqm              numeric,
  p_monthly_rent_eur      numeric,
  p_building_age_bracket  text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id             uuid;
  v_eur_per_sqm    numeric;
  c_min_per_sqm    constant numeric := 3;
  c_max_per_sqm    constant numeric := 60;
begin
  if p_size_sqm is null or p_size_sqm <= 0 then
    raise exception 'size_sqm must be greater than zero';
  end if;
  if p_monthly_rent_eur is null or p_monthly_rent_eur <= 0 then
    raise exception 'monthly_rent_eur must be greater than zero';
  end if;

  v_eur_per_sqm := p_monthly_rent_eur / p_size_sqm;

  if v_eur_per_sqm < c_min_per_sqm or v_eur_per_sqm > c_max_per_sqm then
    raise exception
      'implausible rent: % EUR/sqm is outside the accepted range of %-% EUR/sqm',
      round(v_eur_per_sqm, 2), c_min_per_sqm, c_max_per_sqm
      using errcode = 'check_violation';
  end if;

  insert into public.crowdsourced_rents (
    district_id, size_sqm, monthly_rent_eur, building_age_bracket, status
  )
  values (
    p_district_id, p_size_sqm, p_monthly_rent_eur, p_building_age_bracket, 'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.submit_crowdsourced_rent is
  'Service-role-only insert of an anonymous rent submission as pending. Rejects rents outside 3-60 EUR/sqm so obvious junk never reaches moderation.';

-- Bestehende Einträge außerhalb des Bandes zur Sicherheit markieren, damit
-- sie nicht versehentlich freigegeben werden.
update public.crowdsourced_rents
set status = 'rejected'
where status = 'pending'
  and size_sqm > 0
  and (monthly_rent_eur / size_sqm < 3 or monthly_rent_eur / size_sqm > 60);
