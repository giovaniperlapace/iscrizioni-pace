-- Milestone P5: privacy-safe public panel programme and availability state.

create or replace function public.get_public_panel_program()
returns table (
  panel_id uuid,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  location_address text,
  availability text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with individual_capacity as (
    select
      section.panel_id,
      coalesce(sum(section.capacity), 0)::bigint as capacity
    from public.panel_seat_sections section
    join public.panel_audience_types audience
      on audience.id = section.audience_type_id
      and audience.event_id = section.event_id
    where audience.booking_channel = 'individual'
      and audience.is_active
    group by section.panel_id
  ),
  individual_occupancy as (
    select
      choice.moment_id as panel_id,
      coalesce(sum(
        1 + (
          select count(*)
          from public.registration_children child
          where child.registration_id = registration.id
        )
      ), 0)::bigint as occupied
    from public.moment_attendance_choices choice
    join public.registrations registration
      on registration.id = choice.registration_id
    where choice.choice = 'yes'
      and registration.status <> 'cancelled'
    group by choice.moment_id
  )
  select
    panel.id,
    panel.title,
    panel.description,
    panel.starts_at,
    panel.ends_at,
    location.name,
    location.address,
    case
      when coalesce(capacity.capacity, 0) = 0 then 'unavailable'
      when coalesce(occupancy.occupied, 0) >= capacity.capacity then 'full'
      else 'available'
    end
  from public.event_moments panel
  join public.events event
    on event.id = panel.event_id
  join public.event_locations location
    on location.id = panel.location_id
    and location.event_id = panel.event_id
  left join individual_capacity capacity on capacity.panel_id = panel.id
  left join individual_occupancy occupancy on occupancy.panel_id = panel.id
  where event.is_current
    and event.status = 'published'
    and panel.moment_type = 'panel'
    and panel.publication_status = 'published'
    and panel.is_public
    and panel.starts_at is not null
    and panel.ends_at is not null
  order by panel.starts_at, panel.title, panel.id;
$$;

revoke all on function public.get_public_panel_program() from public;
grant execute on function public.get_public_panel_program() to anon, authenticated;

comment on function public.get_public_panel_program() is
  'Returns published panels for the current public event with only an aggregate individual availability state; capacities and occupancy counts are not exposed.';
