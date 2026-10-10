begin;
-- Minimal service-only programme projection. Access and expiry checked by the route.
create function public.get_home_approval_preview()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_event_id uuid; v_result jsonb;
begin
  select id into v_event_id from public.events where is_current;
  if v_event_id is null then return null; end if;
  with programme as (
    select m.id, m.title, m.description, m.starts_at, m.ends_at,
      l.name as location_name, l.address as location_address, m.publication_status,
      m.starts_at is not null and m.ends_at is not null and l.id is not null as complete,
      seats.remaining, seats.has_sections
    from public.event_moments m
    left join public.event_locations l on l.id = m.location_id and l.event_id = v_event_id
    left join lateral (
      select coalesce(sum(greatest(0, s.capacity - app.panel_section_occupancy(s.id))), 0) as remaining,
        count(*) > 0 as has_sections
      from public.panel_seat_sections s
      join public.panel_audience_types a on a.id = s.audience_type_id and a.event_id = v_event_id
      where s.panel_id = m.id and s.event_id = v_event_id and a.booking_channel = 'individual'
    ) seats on true
    where m.event_id = v_event_id and m.moment_type = 'panel'
  ) select jsonb_build_object(
    'panels', coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'title', title, 'description', description, 'startsAt', starts_at, 'endsAt', ends_at,
      'locationName', location_name, 'locationAddress', location_address,
      'publicationStatus', publication_status, 'remainingSeats', remaining,
      'availability', case when not has_sections then 'unavailable' when remaining > 0 then 'available' else 'full' end
    ) order by starts_at, title, id) filter (where complete), '[]'::jsonb),
    'incomplete', coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title) order by title, id)
      filter (where not complete), '[]'::jsonb)
  ) into v_result from programme;
  return v_result;
end;
$$;
revoke all on function public.get_home_approval_preview() from public, anon, authenticated;
grant execute on function public.get_home_approval_preview() to service_role;
commit;
