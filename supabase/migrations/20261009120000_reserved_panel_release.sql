-- Reserved P0-P10 rollout. Existing publication validates a panel for internal use.
-- Public exposure and bookings are separate, closed by default in every environment.
alter table public.events add column panel_access_mode text not null default 'internal'
  check (panel_access_mode in ('internal', 'catalog', 'open'));

create or replace function public.get_panel_release_mode()
returns text language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select panel_access_mode from public.events
    where is_current and status = 'published'), 'internal');
$$;
revoke all on function public.get_panel_release_mode() from public;
grant execute on function public.get_panel_release_mode() to anon, authenticated, service_role;

create or replace function app.require_panel_bookings_open(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_mode text;
begin
  select panel_access_mode into v_mode from public.events
  where id = p_event_id and is_current and status = 'published' for share;
  if v_mode is distinct from 'open' then
    raise exception 'panel bookings are not available' using errcode = '42501';
  end if;
end;
$$;
revoke all on function app.require_panel_bookings_open(uuid) from public, anon, authenticated;

create or replace function app.is_published_panel(target_panel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.event_moments moment
    join public.events event on event.id = moment.event_id
    where moment.id = target_panel_id
      and moment.moment_type = 'panel'
      and moment.publication_status = 'published'
      and moment.is_public
      and event.status = 'published'
      and event.is_current and event.panel_access_mode in ('catalog', 'open')
  );
$$;

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
  with individual_sections as (
    select
      section.panel_id,
      bool_or(app.panel_section_occupancy(section.id) < section.capacity) as has_space
    from public.panel_seat_sections section
    join public.panel_audience_types audience
      on audience.id = section.audience_type_id
      and audience.event_id = section.event_id
    where audience.booking_channel = 'individual'
      and audience.is_active
    group by section.panel_id
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
      when sections.panel_id is null then 'unavailable'
      when sections.has_space then 'available'
      else 'full'
    end
  from public.event_moments panel
  join public.events event on event.id = panel.event_id
  join public.event_locations location
    on location.id = panel.location_id
    and location.event_id = panel.event_id
  left join individual_sections sections on sections.panel_id = panel.id
  where event.is_current and event.panel_access_mode in ('catalog', 'open')
    and event.status = 'published'
    and panel.moment_type = 'panel'
    and panel.publication_status = 'published'
    and panel.is_public
    and panel.starts_at is not null
    and panel.ends_at is not null
  order by panel.starts_at, panel.title, panel.id;
$$;

create or replace function public.get_public_school_booking_options()
returns table (
  event_id uuid,
  event_title text,
  panel_id uuid,
  section_id uuid,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    event.id,
    event.title,
    panel.id,
    section.id,
    panel.title,
    panel.description,
    panel.starts_at,
    panel.ends_at,
    location.name
  from public.events event
  join public.event_moments panel
    on panel.event_id = event.id
   and panel.moment_type = 'panel'
   and panel.publication_status = 'published'
   and panel.is_public
  join public.event_locations location
    on location.id = panel.location_id
   and location.event_id = event.id
   and location.is_active
  join public.panel_seat_sections section
    on section.panel_id = panel.id
   and section.event_id = event.id
  join public.panel_audience_types audience
    on audience.id = section.audience_type_id
   and audience.event_id = event.id
   and audience.booking_channel = 'school_booking'
   and audience.is_active
  where event.is_current and event.panel_access_mode = 'open'
    and event.status = 'published'
    and (event.registration_opens_at is null or event.registration_opens_at <= now())
    and (event.registration_closes_at is null or event.registration_closes_at >= now())
    and panel.starts_at is not null
    and panel.ends_at is not null
  order by panel.starts_at, panel.title, section.id;
$$;

create or replace function public.get_participant_panel_catalog(p_registration_id uuid)
returns table (
  panel_id uuid,
  section_id uuid,
  audience_name text,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  location_address text,
  booking_status text,
  party_size integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with owned_registration as (
    select registration.id, registration.event_id
    from public.registrations registration
    where registration.id = p_registration_id
      and exists (select 1 from public.events e where e.id = registration.event_id and e.is_current and e.panel_access_mode = 'open')
      and registration.status in ('submitted', 'confirmed')
      and app.owns_registration(registration.id)
  ),
  selected as (
    select choice.moment_id, choice.seat_section_id
    from public.moment_attendance_choices choice
    join owned_registration registration on registration.id = choice.registration_id
    where choice.choice = 'yes'
      and choice.seat_section_id is not null
  )
  select
    panel.id,
    section.id,
    audience.name,
    panel.title,
    panel.description,
    panel.starts_at,
    panel.ends_at,
    location.name,
    location.address,
    case
      when selected.seat_section_id = section.id then 'selected'
      when exists (
        select 1
        from selected other_choice
        join public.event_moments other_panel on other_panel.id = other_choice.moment_id
        where other_choice.moment_id <> panel.id
          and tstzrange(other_panel.starts_at, other_panel.ends_at, '[)')
            && tstzrange(panel.starts_at, panel.ends_at, '[)')
      ) then 'conflict'
      when app.panel_section_occupancy(section.id)
        + app.registration_panel_party_size(registration.id) > section.capacity then 'full'
      else 'available'
    end,
    app.registration_panel_party_size(registration.id)
  from owned_registration registration
  join public.event_moments panel
    on panel.event_id = registration.event_id
   and panel.moment_type = 'panel'
   and panel.publication_status = 'published'
   and panel.is_public
  join public.events event
    on event.id = panel.event_id
   and event.status = 'published'
  join public.event_locations location
    on location.id = panel.location_id
   and location.event_id = panel.event_id
   and location.is_active
  join public.panel_seat_sections section
    on section.panel_id = panel.id
   and section.event_id = panel.event_id
  left join selected on selected.moment_id = panel.id
  join public.panel_audience_types audience
    on audience.id = section.audience_type_id
   and audience.event_id = section.event_id
   and audience.booking_channel = 'individual'
   and (audience.is_active or selected.seat_section_id = section.id)
  order by panel.starts_at, panel.title, audience.sort_order, audience.name;
$$;

create or replace function public.get_group_panel_booking_view(p_event_id uuid, p_section_id uuid default null)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_groups uuid[];
  v_panels jsonb;
  v_people jsonb;
  v_panel public.event_moments%rowtype;
  v_remaining integer;
begin
  perform app.require_panel_bookings_open(p_event_id);
  select array_agg(id) into v_groups from app.leader_panel_group_scope(p_event_id) id;
  if auth.uid() is null or coalesce(cardinality(v_groups), 0) = 0 then
    raise exception 'group panel access forbidden' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'panelId', p.id, 'sectionId', s.id, 'title', p.title, 'audience', a.name,
    'startsAt', p.starts_at, 'endsAt', p.ends_at, 'location', l.name,
    'remaining', greatest(0, s.capacity - app.panel_section_occupancy(s.id))
  ) order by p.starts_at, p.title, a.name), '[]'::jsonb) into v_panels
  from public.event_moments p
  join public.panel_seat_sections s on s.panel_id = p.id
  join public.panel_audience_types a on a.id = s.audience_type_id
  join public.event_locations l on l.id = p.location_id
  join public.events e on e.id = p.event_id
  where p.event_id = p_event_id and p.moment_type = 'panel'
    and p.publication_status = 'published' and p.is_public and e.status = 'published'
    and a.booking_channel = 'individual' and a.is_active;

  if p_section_id is not null then
    select p.* into v_panel from public.event_moments p
    join public.panel_seat_sections s on s.panel_id = p.id
    where s.id = p_section_id and exists (
      select 1 from jsonb_array_elements(v_panels) item
      where item->>'sectionId' = p_section_id::text
    );
    if not found then raise exception 'panel is not available' using errcode = '22023'; end if;
    select capacity - app.panel_section_occupancy(id) into v_remaining
    from public.panel_seat_sections where id = p_section_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'registrationId', r.id, 'name', concat_ws(' ', p.first_name, p.last_name),
    'code', p.public_code, 'groupId', g.id, 'groupName', g.name,
    'seats', app.registration_panel_party_size(r.id),
    'status', case
      when exists (select 1 from public.moment_attendance_choices c
        where c.registration_id = r.id and c.moment_id = v_panel.id and c.choice = 'yes') then 'selected'
      when exists (select 1 from public.moment_attendance_choices c
        join public.event_moments other on other.id = c.moment_id
        where c.registration_id = r.id and c.choice = 'yes' and c.seat_section_id is not null
          and c.moment_id <> v_panel.id
          and tstzrange(other.starts_at, other.ends_at, '[)') && tstzrange(v_panel.starts_at, v_panel.ends_at, '[)')) then 'conflict'
      when app.registration_panel_party_size(r.id) > v_remaining then 'full'
      else 'available' end
  ) order by p.last_name, p.first_name, r.id), '[]'::jsonb) into v_people
  from public.registrations r
  join public.participants p on p.id = r.participant_id
  join public.participant_group_assignments assignment on assignment.registration_id = r.id
    and assignment.is_current and assignment.status = 'confirmed'
  join public.groups g on g.id = assignment.group_id
  where r.event_id = p_event_id and r.status in ('submitted', 'confirmed') and r.deleted_at is null
    and g.id = any(v_groups);
  return jsonb_build_object('panels', v_panels, 'participants', v_people);
end;
$$;

create or replace function public.book_group_panel(
  p_event_id uuid, p_section_id uuid, p_registration_ids uuid[]
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_ids uuid[];
  v_groups uuid[];
  v_panel public.event_moments%rowtype;
  v_capacity integer;
  v_needed integer;
  v_count integer;
  v_id uuid;
  v_changed integer := 0;
begin
  perform app.require_panel_bookings_open(p_event_id);
  select array_agg(distinct id order by id) into v_ids from unnest(p_registration_ids) id;
  if coalesce(cardinality(v_ids), 0) = 0 or array_position(v_ids, null) is not null then
    raise exception 'empty or invalid selection' using errcode = '22023';
  end if;
  select array_agg(id) into v_groups from app.leader_panel_group_scope(p_event_id) id;
  if auth.uid() is null or coalesce(cardinality(v_groups), 0) = 0 then
    raise exception 'group panel access forbidden' using errcode = '42501';
  end if;

  -- Same lock order as individual bookings: registration -> panel -> section.
  perform 1 from public.registrations where id = any(v_ids) order by id for update;
  perform 1 from public.participant_group_assignments
    where registration_id = any(v_ids) and is_current order by id for update;
  select count(distinct r.id) into v_count from public.registrations r
  join public.participant_group_assignments a on a.registration_id = r.id
    and a.is_current and a.status = 'confirmed' and a.group_id = any(v_groups)
  where r.id = any(v_ids) and r.event_id = p_event_id
    and r.status in ('submitted', 'confirmed') and r.deleted_at is null;
  if v_count <> cardinality(v_ids) then
    raise exception 'registration outside leader scope or inactive' using errcode = '42501';
  end if;
  select p.* into v_panel from public.event_moments p
  join public.panel_seat_sections s on s.panel_id = p.id
  where s.id = p_section_id and p.event_id = p_event_id and p.moment_type = 'panel'
  for update of p;
  if not found then raise exception 'panel not found' using errcode = 'P0002'; end if;
  select s.capacity into v_capacity from public.panel_seat_sections s
  join public.panel_audience_types a on a.id = s.audience_type_id
  where s.id = p_section_id and s.event_id = p_event_id
    and a.booking_channel = 'individual' and a.is_active
  for update of s;
  if not found or v_panel.publication_status <> 'published' or not v_panel.is_public
    or not exists (select 1 from public.events where id = p_event_id and status = 'published') then
    raise exception 'panel is not available' using errcode = '22023';
  end if;
  -- Already booked participants are idempotent, even if in another individual section.
  select array_agg(selected.reg_id order by selected.reg_id) into v_ids from unnest(v_ids) selected(reg_id) where not exists (
    select 1 from public.moment_attendance_choices c
    where c.registration_id = selected.reg_id and c.moment_id = v_panel.id and c.choice = 'yes'
  );
  if coalesce(cardinality(v_ids), 0) = 0 then
    return jsonb_build_object('count', 0, 'seats', 0);
  end if;
  if exists (
    select 1 from public.moment_attendance_choices c
    join public.event_moments p on p.id = c.moment_id
    where c.registration_id = any(v_ids) and c.choice = 'yes' and c.seat_section_id is not null
      and tstzrange(p.starts_at, p.ends_at, '[)') && tstzrange(v_panel.starts_at, v_panel.ends_at, '[)')
  ) then raise exception 'panel overlap' using errcode = '23P01'; end if;
  select sum(app.registration_panel_party_size(id)) into v_needed from unnest(v_ids) id;
  if app.panel_section_occupancy(p_section_id) + v_needed > v_capacity then
    raise exception 'panel section is full' using errcode = 'P0001';
  end if;
  foreach v_id in array v_ids loop
    insert into public.moment_attendance_choices(registration_id, moment_id, choice, seat_section_id)
    values (v_id, v_panel.id, 'yes', p_section_id)
    on conflict (registration_id, moment_id) do update set choice = 'yes', seat_section_id = excluded.seat_section_id;
    insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
    values (p_event_id, auth.uid(), 'panel.group_booking_confirmed', 'registrations', v_id,
      jsonb_build_object('panel_id', v_panel.id, 'section_id', p_section_id,
        'party_size', app.registration_panel_party_size(v_id)));
    v_changed := v_changed + 1;
  end loop;
  return jsonb_build_object('count', v_changed, 'seats', v_needed);
end;
$$;

create or replace function public.set_group_panel_booking(
  p_event_id uuid, p_section_id uuid, p_registration_id uuid, p_booked boolean
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_groups uuid[];
  v_panel_id uuid;
  v_current_section uuid;
  v_seats integer;
begin
  perform app.require_panel_bookings_open(p_event_id);
  if p_booked is null or p_registration_id is null or p_section_id is null then
    raise exception 'invalid booking request' using errcode = '22023';
  end if;
  if p_booked then
    return public.book_group_panel(p_event_id, p_section_id, array[p_registration_id]);
  end if;
  select array_agg(id) into v_groups from app.leader_panel_group_scope(p_event_id) id;
  if auth.uid() is null or coalesce(cardinality(v_groups), 0) = 0 then
    raise exception 'group panel access forbidden' using errcode = '42501';
  end if;
  perform 1 from public.registrations where id = p_registration_id for update;
  perform 1 from public.participant_group_assignments
    where registration_id = p_registration_id and is_current order by id for update;
  if not exists (
    select 1 from public.registrations r
    join public.participant_group_assignments a on a.registration_id = r.id
      and a.is_current and a.status = 'confirmed' and a.group_id = any(v_groups)
    where r.id = p_registration_id and r.event_id = p_event_id
      and r.status in ('submitted', 'confirmed') and r.deleted_at is null
  ) then
    raise exception 'registration outside leader scope or inactive' using errcode = '42501';
  end if;
  select p.id into v_panel_id from public.event_moments p
  join public.panel_seat_sections s on s.panel_id = p.id and s.event_id = p.event_id
  join public.panel_audience_types a on a.id = s.audience_type_id and a.event_id = s.event_id
  where s.id = p_section_id and p.event_id = p_event_id
    and p.moment_type = 'panel' and a.booking_channel = 'individual'
  for update of p;
  if not found then raise exception 'panel not found' using errcode = 'P0002'; end if;
  select seat_section_id into v_current_section from public.moment_attendance_choices
    where registration_id = p_registration_id and moment_id = v_panel_id and choice = 'yes';
  if v_current_section is null then return jsonb_build_object('count',0,'seats',0); end if;
  -- Release the actual booked section, even when another section of this panel is displayed.
  perform 1 from public.panel_seat_sections
    where id = v_current_section for update;
  v_seats := app.registration_panel_party_size(p_registration_id);
  update public.moment_attendance_choices set choice = 'no', seat_section_id = null
    where registration_id = p_registration_id and moment_id = v_panel_id and choice = 'yes';
  insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
    values(p_event_id, auth.uid(), 'panel.group_booking_cancelled', 'registrations', p_registration_id,
      jsonb_build_object('panel_id',v_panel_id,'section_id',v_current_section,'party_size',v_seats));
  return jsonb_build_object('count',1,'seats',v_seats);
end;
$$;

create or replace function public.set_individual_panel_booking(
  p_registration_id uuid,
  p_panel_id uuid,
  p_section_id uuid,
  p_booked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_registration public.registrations%rowtype;
  v_panel public.event_moments%rowtype;
  v_current_section_id uuid;
  v_capacity integer;
  v_occupied integer;
  v_party_size integer;
  v_changed boolean := false;
begin
  perform app.require_panel_bookings_open((select event_id from public.registrations where id = p_registration_id));
  select * into v_registration
  from public.registrations registration
  where registration.id = p_registration_id
  for update;

  if not found or not app.owns_registration(p_registration_id) then
    raise exception 'registration not found for this participant' using errcode = '42501';
  end if;

  if v_registration.status not in ('submitted', 'confirmed') then
    raise exception 'registration status does not allow panel bookings' using errcode = '22023';
  end if;

  select choice.seat_section_id into v_current_section_id
  from public.moment_attendance_choices choice
  where choice.registration_id = p_registration_id
    and choice.moment_id = p_panel_id
    and choice.choice = 'yes'
  for update;

  select * into v_panel
  from public.event_moments panel
  where panel.id = p_panel_id
    and panel.event_id = v_registration.event_id
    and panel.moment_type = 'panel'
  for update;

  if not found then
    raise exception 'panel not found for this event' using errcode = 'P0002';
  end if;

  perform 1
  from public.panel_seat_sections section
  where section.id = any(array_remove(array[p_section_id, v_current_section_id], null))
  order by section.id
  for update;

  if not p_booked then
    if v_current_section_id is null then
      return jsonb_build_object('booked', false, 'changed', false);
    end if;

    update public.moment_attendance_choices
    set choice = 'no', seat_section_id = null
    where registration_id = p_registration_id
      and moment_id = p_panel_id
      and choice = 'yes';
    v_changed := found;

    if v_changed then
      insert into public.audit_logs (
        event_id, actor_user_id, action, entity_table, entity_id, metadata
      ) values (
        v_registration.event_id,
        auth.uid(),
        'panel.individual_booking_cancelled',
        'registrations',
        p_registration_id,
        jsonb_build_object('panel_id', p_panel_id, 'section_id', v_current_section_id)
      );
    end if;

    return jsonb_build_object('booked', false, 'changed', v_changed);
  end if;

  if v_panel.publication_status <> 'published' or not v_panel.is_public then
    raise exception 'panel is not available for booking' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.events event
    where event.id = v_registration.event_id
      and event.status = 'published'
  ) then
    raise exception 'event is not available for panel bookings' using errcode = '22023';
  end if;

  select section.capacity into v_capacity
  from public.panel_seat_sections section
  join public.panel_audience_types audience
    on audience.id = section.audience_type_id
   and audience.event_id = section.event_id
  where section.id = p_section_id
    and section.panel_id = p_panel_id
    and section.event_id = v_registration.event_id
    and audience.booking_channel = 'individual'
    and audience.is_active;

  if not found then
    raise exception 'individual panel section is not available' using errcode = '22023';
  end if;

  if v_current_section_id = p_section_id then
    return jsonb_build_object('booked', true, 'changed', false);
  end if;

  if exists (
    select 1
    from public.moment_attendance_choices choice
    join public.event_moments selected_panel on selected_panel.id = choice.moment_id
    where choice.registration_id = p_registration_id
      and choice.choice = 'yes'
      and choice.seat_section_id is not null
      and choice.moment_id <> p_panel_id
      and tstzrange(selected_panel.starts_at, selected_panel.ends_at, '[)')
        && tstzrange(v_panel.starts_at, v_panel.ends_at, '[)')
  ) then
    raise exception 'panel booking overlaps another selected panel' using errcode = '23P01';
  end if;

  v_party_size := app.registration_panel_party_size(p_registration_id);
  select coalesce(sum(app.registration_panel_party_size(choice.registration_id)), 0)::integer
  into v_occupied
  from public.moment_attendance_choices choice
  join public.registrations registration on registration.id = choice.registration_id
  where choice.seat_section_id = p_section_id
    and choice.choice = 'yes'
    and choice.registration_id <> p_registration_id
    and registration.status <> 'cancelled';

  if v_occupied + v_party_size > v_capacity then
    raise exception 'panel section is full' using errcode = 'P0001';
  end if;

  insert into public.moment_attendance_choices (
    registration_id, moment_id, choice, seat_section_id
  ) values (
    p_registration_id, p_panel_id, 'yes', p_section_id
  )
  on conflict (registration_id, moment_id) do update
  set choice = 'yes', seat_section_id = excluded.seat_section_id;

  insert into public.audit_logs (
    event_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    v_registration.event_id,
    auth.uid(),
    'panel.individual_booking_confirmed',
    'registrations',
    p_registration_id,
    jsonb_build_object(
      'panel_id', p_panel_id,
      'section_id', p_section_id,
      'party_size', v_party_size
    )
  );

  return jsonb_build_object('booked', true, 'changed', true, 'party_size', v_party_size);
end;
$$;

create or replace function public.create_public_school_booking(
  p_event_id uuid,
  p_teacher_email text,
  p_teacher_first_name text,
  p_teacher_last_name text,
  p_teacher_phone text,
  p_school_name text,
  p_school_city text,
  p_class_description text,
  p_student_count integer,
  p_companion_count integer,
  p_privacy_version text,
  p_panel_reservations jsonb,
  p_qr_token_hash text,
  p_qr_token_encrypted text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking_id uuid;
  v_teacher_id uuid;
  v_reservation record;
  v_reservation_count integer;
begin
  perform app.require_panel_bookings_open(p_event_id);
  if not exists (
    select 1 from public.events event
    where event.id = p_event_id
      and event.is_current
      and event.status = 'published'
      and (event.registration_opens_at is null or event.registration_opens_at <= now())
      and (event.registration_closes_at is null or event.registration_closes_at >= now())
  ) then
    raise exception 'school bookings are not open' using errcode = '42501';
  end if;

  if p_teacher_email is null or p_teacher_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(btrim(p_teacher_email)) > 320
    or length(btrim(p_teacher_first_name)) not between 1 and 120
    or length(btrim(p_teacher_last_name)) not between 1 and 120
    or length(btrim(p_teacher_phone)) not between 3 and 40
    or length(btrim(p_school_name)) not between 1 and 180
    or length(btrim(p_school_city)) not between 1 and 120
    or length(btrim(p_class_description)) not between 1 and 180
    or p_student_count not between 1 and 1000
    or p_companion_count not between 1 and 100
    or length(btrim(p_privacy_version)) not between 1 and 80
    or p_panel_reservations is null
    or jsonb_typeof(p_panel_reservations) <> 'array'
    or p_qr_token_hash is null
    or length(p_qr_token_hash) < 32
    or p_qr_token_encrypted is null
    or length(p_qr_token_encrypted) < 20 then
    raise exception 'invalid public school booking data' using errcode = '22023';
  end if;

  select count(*)::integer into v_reservation_count
  from jsonb_array_elements(p_panel_reservations);
  if v_reservation_count not between 1 and 50 then
    raise exception 'school booking requires between 1 and 50 panels' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    )
    where row_data.panel_id is null or row_data.seat_section_id is null
      or row_data.student_count not between 1 and p_student_count
      or row_data.companion_count not between 1 and p_companion_count
  ) or (
    select count(distinct row_data.panel_id)
    from jsonb_to_recordset(p_panel_reservations) row_data(panel_id uuid)
  ) <> v_reservation_count then
    raise exception 'invalid or duplicate school panel reservation' using errcode = '22023';
  end if;

  perform 1 from public.event_moments panel
  where panel.id in (
    select row_data.panel_id
    from jsonb_to_recordset(p_panel_reservations) row_data(panel_id uuid)
  ) order by panel.id for update;
  perform 1 from public.panel_seat_sections section
  where section.id in (
    select row_data.seat_section_id
    from jsonb_to_recordset(p_panel_reservations) row_data(seat_section_id uuid)
  ) order by section.id for update;

  if exists (
    select 1
    from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    )
    left join public.event_moments panel
      on panel.id = row_data.panel_id and panel.event_id = p_event_id
      and panel.moment_type = 'panel' and panel.publication_status = 'published'
      and panel.is_public
    left join public.panel_seat_sections section
      on section.id = row_data.seat_section_id and section.panel_id = panel.id
      and section.event_id = p_event_id
    left join public.panel_audience_types audience
      on audience.id = section.audience_type_id and audience.is_active
      and audience.booking_channel = 'school_booking'
    where panel.id is null or section.id is null or audience.id is null
  ) then
    raise exception 'school panel section is not available' using errcode = '22023';
  end if;

  insert into public.school_booking_teachers (
    event_id, email, first_name, last_name, phone
  ) values (
    p_event_id, lower(btrim(p_teacher_email))::extensions.citext,
    btrim(p_teacher_first_name), btrim(p_teacher_last_name), btrim(p_teacher_phone)
  ) on conflict (event_id, email) do nothing;

  select id into v_teacher_id
  from public.school_booking_teachers
  where event_id = p_event_id
    and email = lower(btrim(p_teacher_email))::extensions.citext
  for update;

  insert into public.school_bookings (
    event_id, teacher_id, school_name, school_city, class_description,
    student_count, companion_count, status, privacy_version,
    privacy_accepted_at, internal_notes, created_by
  ) values (
    p_event_id, v_teacher_id, btrim(p_school_name), btrim(p_school_city),
    btrim(p_class_description), p_student_count, p_companion_count,
    'submitted', btrim(p_privacy_version), now(), null, null
  ) returning id into v_booking_id;

  for v_reservation in
    select * from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    ) order by panel_id
  loop
    insert into public.school_panel_reservations (
      event_id, booking_id, panel_id, seat_section_id,
      student_count, companion_count, status
    ) values (
      p_event_id, v_booking_id, v_reservation.panel_id,
      v_reservation.seat_section_id, v_reservation.student_count,
      v_reservation.companion_count, 'reserved'
    );
  end loop;

  perform app.validate_school_booking_overlaps(v_booking_id);
  for v_reservation in
    select distinct seat_section_id from public.school_panel_reservations
    where booking_id = v_booking_id and status = 'reserved'
    order by seat_section_id
  loop
    perform app.validate_panel_section_booking_capacity(v_reservation.seat_section_id);
  end loop;

  insert into public.school_booking_qr_tokens (
    booking_id, token_hash, token_encrypted, created_by
  ) values (v_booking_id, p_qr_token_hash, p_qr_token_encrypted, null);

  insert into public.audit_logs (
    event_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_event_id, null, 'school_booking.public_submitted',
    'school_bookings', v_booking_id,
    jsonb_build_object(
      'status', 'submitted',
      'panel_count', v_reservation_count,
      'student_count', p_student_count,
      'companion_count', p_companion_count,
      'actor_kind', 'public_teacher'
    )
  );
  return v_booking_id;
end;
$$;

create or replace function public.save_school_booking(
  p_event_id uuid,
  p_booking_id uuid,
  p_teacher_email text,
  p_teacher_first_name text,
  p_teacher_last_name text,
  p_teacher_phone text,
  p_school_name text,
  p_school_city text,
  p_class_description text,
  p_student_count integer,
  p_companion_count integer,
  p_privacy_version text,
  p_internal_notes text,
  p_status public.school_booking_status,
  p_panel_reservations jsonb,
  p_qr_token_hash text default null,
  p_qr_token_encrypted text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking public.school_bookings%rowtype;
  v_teacher_id uuid;
  reservation record;
  reservation_count integer;
  can_manage boolean;
  is_owner boolean;
  target_status public.school_booking_status;
  action_name text;
begin
  if not app.has_event_role(p_event_id, array['manager']::public.app_role[]) then
    perform app.require_panel_bookings_open(p_event_id);
  end if;
  can_manage := app.has_event_role(p_event_id, array['manager']::public.app_role[]);
  is_owner := p_booking_id is not null and app.owns_school_booking(p_booking_id);
  if not can_manage and not is_owner then
    raise exception 'school booking forbidden' using errcode = '42501';
  end if;
  if p_booking_id is null and not can_manage then
    raise exception 'only event managers can create backoffice school bookings' using errcode = '42501';
  end if;
  if p_teacher_email is null or p_teacher_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(btrim(p_teacher_email)) > 320
    or length(btrim(p_teacher_first_name)) not between 1 and 120
    or length(btrim(p_teacher_last_name)) not between 1 and 120
    or length(btrim(p_teacher_phone)) not between 3 and 40
    or length(btrim(p_school_name)) not between 1 and 180
    or length(btrim(p_school_city)) not between 1 and 120
    or length(btrim(p_class_description)) not between 1 and 180
    or p_student_count not between 1 and 1000
    or p_companion_count not between 1 and 100
    or length(btrim(p_privacy_version)) not between 1 and 80
    or length(coalesce(p_internal_notes, '')) > 2000
    or p_panel_reservations is null
    or jsonb_typeof(p_panel_reservations) <> 'array' then
    raise exception 'invalid school booking data' using errcode = '22023';
  end if;

  select count(*)::integer into reservation_count
  from jsonb_array_elements(p_panel_reservations);
  if reservation_count < 1 or reservation_count > 50 then
    raise exception 'school booking requires between 1 and 50 panels' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    )
    where row_data.panel_id is null or row_data.seat_section_id is null
      or row_data.student_count not between 1 and p_student_count
      or row_data.companion_count not between 1 and p_companion_count
  ) or (
    select count(distinct row_data.panel_id)
    from jsonb_to_recordset(p_panel_reservations) row_data(panel_id uuid)
  ) <> reservation_count then
    raise exception 'invalid or duplicate school panel reservation' using errcode = '22023';
  end if;

  if p_booking_id is not null then
    select * into booking from public.school_bookings
    where id = p_booking_id and event_id = p_event_id for update;
    if not found then
      raise exception 'school booking not found' using errcode = 'P0002';
    end if;
    if is_owner and booking.status = 'cancelled' then
      raise exception 'cancelled school booking cannot be reopened by teacher' using errcode = '42501';
    end if;
    if is_owner and not can_manage
      and lower(btrim(p_teacher_email)) <> lower(auth.jwt() ->> 'email') then
      raise exception 'teacher email must match the verified session' using errcode = '42501';
    end if;
  end if;

  perform 1 from public.event_moments panel
  where panel.id in (
    select row_data.panel_id
    from jsonb_to_recordset(p_panel_reservations) row_data(panel_id uuid)
  ) order by panel.id for update;
  perform 1 from public.panel_seat_sections section
  where section.id in (
    select row_data.seat_section_id
    from jsonb_to_recordset(p_panel_reservations) row_data(seat_section_id uuid)
  ) order by section.id for update;

  if exists (
    select 1
    from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    )
    left join public.event_moments panel
      on panel.id = row_data.panel_id and panel.event_id = p_event_id
      and panel.moment_type = 'panel' and panel.publication_status = 'published'
    left join public.panel_seat_sections section
      on section.id = row_data.seat_section_id and section.panel_id = panel.id
      and section.event_id = p_event_id
    left join public.panel_audience_types audience
      on audience.id = section.audience_type_id
      and audience.booking_channel = 'school_booking'
    where panel.id is null or section.id is null or audience.id is null
  ) then
    raise exception 'school panel section is not available' using errcode = '22023';
  end if;

  insert into public.school_booking_teachers (
    event_id, auth_user_id, email, first_name, last_name, phone
  ) values (
    p_event_id,
    case when lower(auth.jwt() ->> 'email') = lower(btrim(p_teacher_email)) then auth.uid() else null end,
    lower(btrim(p_teacher_email))::extensions.citext,
    btrim(p_teacher_first_name), btrim(p_teacher_last_name), btrim(p_teacher_phone)
  )
  on conflict (event_id, email) do update set
    auth_user_id = coalesce(school_booking_teachers.auth_user_id, excluded.auth_user_id),
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone
  returning id into v_teacher_id;

  target_status := case
    when not can_manage then booking.status
    when p_status = 'cancelled' then 'confirmed'::public.school_booking_status
    else p_status
  end;
  if target_status not in ('submitted', 'confirmed') then
    raise exception 'invalid active school booking status' using errcode = '22023';
  end if;

  if p_booking_id is null then
    insert into public.school_bookings (
      event_id, teacher_id, school_name, school_city, class_description,
      student_count, companion_count, status, privacy_version,
      privacy_accepted_at, internal_notes, created_by
    ) values (
      p_event_id, v_teacher_id, btrim(p_school_name), btrim(p_school_city),
      btrim(p_class_description), p_student_count, p_companion_count,
      target_status, btrim(p_privacy_version), now(), nullif(btrim(p_internal_notes), ''), auth.uid()
    ) returning * into booking;
    action_name := 'school_booking.created';
  else
    update public.school_bookings set
      teacher_id = v_teacher_id,
      school_name = btrim(p_school_name),
      school_city = btrim(p_school_city),
      class_description = btrim(p_class_description),
      student_count = p_student_count,
      companion_count = p_companion_count,
      status = target_status,
      internal_notes = case when can_manage then nullif(btrim(p_internal_notes), '') else internal_notes end,
      cancelled_at = null
    where id = p_booking_id
    returning * into booking;
    action_name := 'school_booking.updated';
  end if;

  update public.school_panel_reservations set status = 'cancelled'
  where booking_id = booking.id and status = 'reserved';
  for reservation in
    select * from jsonb_to_recordset(p_panel_reservations) row_data(
      panel_id uuid, seat_section_id uuid, student_count integer, companion_count integer
    ) order by panel_id
  loop
    insert into public.school_panel_reservations (
      event_id, booking_id, panel_id, seat_section_id,
      student_count, companion_count, status
    ) values (
      p_event_id, booking.id, reservation.panel_id, reservation.seat_section_id,
      reservation.student_count, reservation.companion_count, 'reserved'
    ) on conflict (booking_id, panel_id) do update set
      seat_section_id = excluded.seat_section_id,
      student_count = excluded.student_count,
      companion_count = excluded.companion_count,
      status = 'reserved';
  end loop;

  perform app.validate_school_booking_overlaps(booking.id);
  for reservation in
    select distinct seat_section_id from public.school_panel_reservations
    where booking_id = booking.id and status = 'reserved' order by seat_section_id
  loop
    perform app.validate_panel_section_booking_capacity(reservation.seat_section_id);
  end loop;

  if p_qr_token_hash is not null or p_qr_token_encrypted is not null then
    if p_qr_token_hash is null or p_qr_token_encrypted is null or p_booking_id is not null then
      raise exception 'invalid school booking QR token payload' using errcode = '22023';
    end if;
    insert into public.school_booking_qr_tokens (
      booking_id, token_hash, token_encrypted, created_by
    ) values (booking.id, p_qr_token_hash, p_qr_token_encrypted, auth.uid());
  end if;

  insert into public.audit_logs (
    event_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_event_id, auth.uid(), action_name, 'school_bookings', booking.id,
    jsonb_build_object(
      'status', target_status,
      'panel_count', reservation_count,
      'student_count', p_student_count,
      'companion_count', p_companion_count,
      'actor_kind', case when can_manage then 'manager' else 'teacher' end
    )
  );
  return booking.id;
end;
$$;

create or replace function public.cancel_school_booking(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking public.school_bookings%rowtype;
begin
  if not app.has_event_role((select event_id from public.school_bookings where id = p_booking_id), array['manager']::public.app_role[]) then
    perform app.require_panel_bookings_open((select event_id from public.school_bookings where id = p_booking_id));
  end if;
  select * into booking from public.school_bookings where id = p_booking_id for update;
  if not found then raise exception 'school booking not found' using errcode = 'P0002'; end if;
  if not app.has_event_role(booking.event_id, array['manager']::public.app_role[])
    and not app.owns_school_booking(booking.id) then
    raise exception 'school booking forbidden' using errcode = '42501';
  end if;
  if booking.status = 'cancelled' then return false; end if;
  perform 1 from public.panel_seat_sections section
  where section.id in (
    select seat_section_id from public.school_panel_reservations
    where booking_id = booking.id and status = 'reserved'
  ) order by section.id for update;
  update public.school_panel_reservations set status = 'cancelled'
  where booking_id = booking.id and status = 'reserved';
  update public.school_bookings set status = 'cancelled', cancelled_at = now()
  where id = booking.id;
  update public.school_booking_qr_tokens set status = 'revoked', revoked_at = now()
  where booking_id = booking.id and status = 'active';
  insert into public.audit_logs (
    event_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    booking.event_id, auth.uid(), 'school_booking.cancelled',
    'school_bookings', booking.id, '{}'::jsonb
  );
  return true;
end;
$$;

create or replace function app.owns_school_booking(target_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.school_bookings booking
    join public.school_booking_teachers teacher on teacher.id = booking.teacher_id
    where booking.id = target_booking_id
      and exists (select 1 from public.events e where e.id = booking.event_id and e.is_current and e.panel_access_mode = 'open')
      and (
        teacher.auth_user_id = auth.uid()
        or (
          auth.uid() is not null
          and nullif(auth.jwt() ->> 'email', '') is not null
          and teacher.email = (auth.jwt() ->> 'email')::extensions.citext
        )
      )
  );
$$;

-- Direct REST reads obey the same release boundary as the public RPCs.
drop policy "event moments published or operational read" on public.event_moments;
create policy "event moments published or operational read" on public.event_moments for select
using (
  app.has_event_role(event_id, array['manager', 'manager_viewer']::public.app_role[])
  or (moment_type = 'panel' and app.is_published_panel(id))
  or (moment_type <> 'panel' and is_public and exists (
    select 1 from public.events e where e.id = event_id and e.status = 'published'))
);

create policy "school teachers release boundary" on public.school_booking_teachers
as restrictive for select to authenticated
using (app.has_event_role(event_id, array['manager', 'manager_viewer']::public.app_role[])
  or exists (select 1 from public.events e where e.id = event_id and e.is_current and e.panel_access_mode = 'open'));

-- Canonical occupancy: includes accompanied children and school quantities.
-- Caller keeps RLS identity; the manager catalog must not call this with service_role.
create or replace function public.get_panel_seat_availability(p_event_id uuid)
returns table (section_id uuid, occupied integer)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.events where id = p_event_id and is_current)
    or not app.has_event_role(p_event_id, array['manager', 'manager_viewer']::public.app_role[]) then
    raise exception 'panel availability forbidden' using errcode = '42501';
  end if;
  return query select s.id, app.panel_section_occupancy(s.id)
    from public.panel_seat_sections s where s.event_id = p_event_id order by s.id;
end;
$$;
revoke all on function public.get_panel_seat_availability(uuid) from public, anon;
grant execute on function public.get_panel_seat_availability(uuid) to authenticated;

-- Internal locations are not a secondary public catalog via direct table reads.
create policy "location release boundary" on public.event_locations
as restrictive for select to anon, authenticated
using (
  app.has_event_role(event_id, array['manager', 'manager_viewer', 'accoglienza']::public.app_role[])
  or exists (select 1 from public.event_moments m where m.location_id = event_locations.id and m.is_public)
);

create or replace function app.audit_panel_access_mode()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if old.panel_access_mode is distinct from new.panel_access_mode then
    insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(new.id,auth.uid(),'panel.access_mode_changed','events',new.id,
      jsonb_build_object('from',old.panel_access_mode,'to',new.panel_access_mode));
  end if;
  return new;
end;
$$;
revoke all on function app.audit_panel_access_mode() from public, anon, authenticated;
create trigger events_audit_panel_access_mode after update of panel_access_mode on public.events
for each row execute function app.audit_panel_access_mode();
