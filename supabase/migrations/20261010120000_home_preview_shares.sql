begin;
-- Capability links grant only a programme preview, never an operational role.
create table public.home_preview_shares (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  label text not null check (length(label) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz
);
alter table public.home_preview_shares enable row level security;
revoke all on public.home_preview_shares from public, anon, authenticated;
grant select, insert, update on public.home_preview_shares to service_role;

create function public.get_shared_home_preview(p_token_hash text)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_event_id uuid; v_result jsonb;
begin
  select share.event_id into v_event_id
  from public.home_preview_shares share join public.events e on e.id = share.event_id
  where share.token_hash = p_token_hash and share.revoked_at is null
    and share.expires_at > now() and e.is_current;
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
revoke all on function public.get_shared_home_preview(text) from public, anon, authenticated;
grant execute on function public.get_shared_home_preview(text) to service_role;
commit;
