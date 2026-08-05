-- Synthetic P1 fixture for staging only. Never apply this file to production.
-- Requires 20260805160000_panel_foundation.sql.

do $$
declare
  target_event_id uuid;
  blue_location_id uuid;
  green_location_id uuid;
  individual_audience_id uuid;
  school_audience_id uuid;
  guest_audience_id uuid;
  youth_panel_id uuid;
  generations_panel_id uuid;
  cities_panel_id uuid;
begin
  select id into target_event_id
  from public.events
  where slug = 'assisi-2026-test';

  if target_event_id is null then
    raise exception 'staging fixture requires event assisi-2026-test';
  end if;

  if exists (
    select 1
    from public.event_moments moment
    where moment.event_id = target_event_id
      and moment.moment_type = 'panel'
  ) or exists (
    select 1
    from public.panel_audience_types audience
    where audience.event_id = target_event_id
  ) then
    raise exception 'staging panel fixture is already present';
  end if;

  insert into public.event_locations (
    event_id,
    name,
    address,
    city,
    country,
    max_capacity,
    is_active
  ) values (
    target_event_id,
    'Sala Blu',
    'Via di Test 1',
    'Assisi',
    'Italia',
    120,
    true
  )
  returning id into blue_location_id;

  insert into public.event_locations (
    event_id,
    name,
    address,
    city,
    country,
    max_capacity,
    is_active
  ) values (
    target_event_id,
    'Sala Verde',
    'Via di Test 2',
    'Assisi',
    'Italia',
    80,
    true
  )
  returning id into green_location_id;

  insert into public.panel_audience_types (
    event_id,
    code,
    name,
    booking_channel,
    sort_order
  ) values
    (target_event_id, 'registered', 'Iscritti', 'individual', 10),
    (target_event_id, 'schools', 'Scuole', 'school_booking', 20),
    (target_event_id, 'guests', 'Ospiti', 'internal_assignment', 30);

  select id into individual_audience_id
  from public.panel_audience_types
  where event_id = target_event_id and code = 'registered';

  select id into school_audience_id
  from public.panel_audience_types
  where event_id = target_event_id and code = 'schools';

  select id into guest_audience_id
  from public.panel_audience_types
  where event_id = target_event_id and code = 'guests';

  insert into public.event_moments (
    event_id,
    location_id,
    title,
    description,
    starts_at,
    ends_at,
    moment_type,
    publication_status,
    check_in_enabled
  ) values (
    target_event_id,
    blue_location_id,
    'Pace e giovani',
    'Panel sintetico per verificare il flusso individuale e scuole.',
    '2026-10-25 09:00:00 Europe/Rome',
    '2026-10-25 10:30:00 Europe/Rome',
    'panel',
    'draft',
    true
  )
  returning id into youth_panel_id;

  insert into public.event_moments (
    event_id,
    location_id,
    title,
    description,
    starts_at,
    ends_at,
    moment_type,
    publication_status,
    check_in_enabled
  ) values (
    target_event_id,
    green_location_id,
    'Dialogo tra generazioni',
    'Panel sintetico contemporaneo in una location diversa.',
    '2026-10-25 09:00:00 Europe/Rome',
    '2026-10-25 10:30:00 Europe/Rome',
    'panel',
    'draft',
    true
  )
  returning id into generations_panel_id;

  insert into public.event_moments (
    event_id,
    location_id,
    title,
    description,
    starts_at,
    ends_at,
    moment_type,
    publication_status,
    check_in_enabled
  ) values (
    target_event_id,
    blue_location_id,
    'Citta'' disarmate',
    'Panel sintetico che riutilizza Sala Blu in una fascia non sovrapposta.',
    '2026-10-25 11:00:00 Europe/Rome',
    '2026-10-25 12:30:00 Europe/Rome',
    'panel',
    'draft',
    true
  )
  returning id into cities_panel_id;

  insert into public.panel_seat_sections (
    event_id,
    panel_id,
    audience_type_id,
    capacity
  ) values
    (target_event_id, youth_panel_id, individual_audience_id, 70),
    (target_event_id, youth_panel_id, school_audience_id, 30),
    (target_event_id, youth_panel_id, guest_audience_id, 20),
    (target_event_id, generations_panel_id, individual_audience_id, 50),
    (target_event_id, generations_panel_id, school_audience_id, 20),
    (target_event_id, generations_panel_id, guest_audience_id, 10),
    (target_event_id, cities_panel_id, individual_audience_id, 60),
    (target_event_id, cities_panel_id, school_audience_id, 40),
    (target_event_id, cities_panel_id, guest_audience_id, 20);

  update public.event_moments
  set publication_status = 'published'
  where id in (youth_panel_id, generations_panel_id, cities_panel_id);
end;
$$;
