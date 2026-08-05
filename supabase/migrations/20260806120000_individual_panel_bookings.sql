-- Milestone P6: atomic self-service bookings for individual panel sections.

alter table public.moment_attendance_choices
  add column seat_section_id uuid
    references public.panel_seat_sections(id) on delete restrict;

create index moment_attendance_choices_section_confirmed_idx
  on public.moment_attendance_choices(seat_section_id, registration_id)
  where choice = 'yes' and seat_section_id is not null;

-- A pre-P6 panel choice can be migrated only when its panel has one unambiguous
-- individual section. Staging currently has no such choices, but this keeps the
-- migration safe if synthetic data is added before rollout.
update public.moment_attendance_choices choice
set seat_section_id = candidate.section_id
from (
  select
    choice_to_backfill.id as choice_id,
    (array_agg(section.id order by section.id))[1] as section_id
  from public.moment_attendance_choices choice_to_backfill
  join public.event_moments panel
    on panel.id = choice_to_backfill.moment_id
   and panel.moment_type = 'panel'
  join public.panel_seat_sections section
    on section.panel_id = panel.id
  join public.panel_audience_types audience
    on audience.id = section.audience_type_id
   and audience.booking_channel = 'individual'
  where choice_to_backfill.choice = 'yes'
    and choice_to_backfill.seat_section_id is null
  group by choice_to_backfill.id
  having count(*) = 1
) candidate
where choice.id = candidate.choice_id;

do $$
begin
  if exists (
    select 1
    from public.moment_attendance_choices choice
    join public.event_moments panel on panel.id = choice.moment_id
    where panel.moment_type = 'panel'
      and choice.choice = 'yes'
      and choice.seat_section_id is null
  ) then
    raise exception
      'cannot migrate panel choices without one unambiguous individual section';
  end if;
end $$;

create or replace function app.ensure_moment_choice_event_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  registration_event_id uuid;
  moment_event_id uuid;
  moment_kind public.event_moment_type;
  section_event_id uuid;
  section_panel_id uuid;
  section_channel public.panel_booking_channel;
begin
  select event_id into registration_event_id
  from public.registrations
  where id = new.registration_id;

  select event_id, moment_type into moment_event_id, moment_kind
  from public.event_moments
  where id = new.moment_id;

  if registration_event_id is null
    or moment_event_id is null
    or registration_event_id is distinct from moment_event_id then
    raise exception 'moment attendance event scope mismatch';
  end if;

  if new.seat_section_id is not null then
    select section.event_id, section.panel_id, audience.booking_channel
    into section_event_id, section_panel_id, section_channel
    from public.panel_seat_sections section
    join public.panel_audience_types audience
      on audience.id = section.audience_type_id
    where section.id = new.seat_section_id;

    if section_event_id is distinct from registration_event_id
      or section_panel_id is distinct from new.moment_id then
      raise exception 'panel choice section scope mismatch';
    end if;

    if section_channel <> 'individual' then
      raise exception 'participant choices require an individual panel section';
    end if;
  end if;

  if moment_kind = 'panel' and new.choice = 'yes' and new.seat_section_id is null then
    raise exception 'confirmed panel choices require a seat section';
  end if;

  if moment_kind <> 'panel' and new.seat_section_id is not null then
    raise exception 'non-panel choices cannot reference a seat section';
  end if;

  if new.choice <> 'yes' then
    new.seat_section_id := null;
  end if;

  return new;
end;
$$;

create or replace function app.registration_panel_party_size(target_registration_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 1 + count(*)::integer
  from public.registration_children child
  where child.registration_id = target_registration_id;
$$;

create or replace function app.panel_section_occupancy(target_section_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(app.registration_panel_party_size(choice.registration_id)), 0)::integer
  from public.moment_attendance_choices choice
  join public.registrations registration
    on registration.id = choice.registration_id
  where choice.seat_section_id = target_section_id
    and choice.choice = 'yes'
    and registration.status <> 'cancelled';
$$;

create or replace function app.validate_panel_section_booking_capacity(target_section_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_capacity integer;
  v_occupied integer;
begin
  if target_section_id is null then
    return;
  end if;

  select capacity into v_capacity
  from public.panel_seat_sections
  where id = target_section_id
  for update;

  if not found then
    raise exception 'panel seat section not found' using errcode = 'P0002';
  end if;

  v_occupied := app.panel_section_occupancy(target_section_id);

  if v_occupied > v_capacity then
    raise exception 'panel section capacity exceeded' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function app.validate_panel_booking_after_choice_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT' and old.seat_section_id is not null then
    perform app.validate_panel_section_booking_capacity(old.seat_section_id);
  end if;

  if tg_op <> 'DELETE' and new.seat_section_id is not null
    and (tg_op = 'INSERT' or new.seat_section_id is distinct from old.seat_section_id) then
    perform app.validate_panel_section_booking_capacity(new.seat_section_id);
  elsif tg_op = 'UPDATE' and new.seat_section_id is not null then
    perform app.validate_panel_section_booking_capacity(new.seat_section_id);
  end if;

  return null;
end;
$$;

create constraint trigger moment_choices_validate_panel_capacity
  after insert or update or delete on public.moment_attendance_choices
  deferrable initially deferred
  for each row execute function app.validate_panel_booking_after_choice_change();

create or replace function app.validate_registration_panel_overlaps(target_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.moment_attendance_choices first_choice
    join public.event_moments first_panel on first_panel.id = first_choice.moment_id
    join public.moment_attendance_choices second_choice
      on second_choice.registration_id = first_choice.registration_id
     and second_choice.id > first_choice.id
     and second_choice.choice = 'yes'
     and second_choice.seat_section_id is not null
    join public.event_moments second_panel on second_panel.id = second_choice.moment_id
    where first_choice.registration_id = target_registration_id
      and first_choice.choice = 'yes'
      and first_choice.seat_section_id is not null
      and tstzrange(first_panel.starts_at, first_panel.ends_at, '[)')
        && tstzrange(second_panel.starts_at, second_panel.ends_at, '[)')
  ) then
    raise exception 'panel booking overlaps another selected panel' using errcode = '23P01';
  end if;
end;
$$;

create or replace function app.validate_panel_overlaps_after_choice_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT' then
    perform app.validate_registration_panel_overlaps(old.registration_id);
  end if;
  if tg_op <> 'DELETE'
    and (tg_op = 'INSERT' or new.registration_id is distinct from old.registration_id) then
    perform app.validate_registration_panel_overlaps(new.registration_id);
  elsif tg_op = 'UPDATE' then
    perform app.validate_registration_panel_overlaps(new.registration_id);
  end if;
  return null;
end;
$$;

create constraint trigger moment_choices_validate_panel_overlaps
  after insert or update or delete on public.moment_attendance_choices
  deferrable initially deferred
  for each row execute function app.validate_panel_overlaps_after_choice_change();

create or replace function app.validate_bookings_after_panel_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_registration_id uuid;
begin
  if new.moment_type <> 'panel'
    or (
      new.starts_at is not distinct from old.starts_at
      and new.ends_at is not distinct from old.ends_at
    ) then
    return null;
  end if;

  for v_registration_id in
    select choice.registration_id
    from public.moment_attendance_choices choice
    where choice.moment_id = new.id
      and choice.choice = 'yes'
      and choice.seat_section_id is not null
    order by choice.registration_id
  loop
    perform app.validate_registration_panel_overlaps(v_registration_id);
  end loop;
  return null;
end;
$$;

create constraint trigger event_moments_validate_participant_panel_overlaps
  after update of starts_at, ends_at on public.event_moments
  deferrable initially deferred
  for each row execute function app.validate_bookings_after_panel_schedule_change();

create or replace function app.validate_panel_bookings_after_section_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'DELETE' then
    perform app.validate_panel_section_booking_capacity(new.id);
  end if;
  return null;
end;
$$;

create constraint trigger panel_sections_validate_booked_capacity
  after insert or update of capacity on public.panel_seat_sections
  deferrable initially deferred
  for each row execute function app.validate_panel_bookings_after_section_change();

create or replace function app.validate_registration_panel_bookings(target_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_section_id uuid;
begin
  for v_section_id in
    select distinct choice.seat_section_id
    from public.moment_attendance_choices choice
    where choice.registration_id = target_registration_id
      and choice.choice = 'yes'
      and choice.seat_section_id is not null
    order by choice.seat_section_id
  loop
    perform app.validate_panel_section_booking_capacity(v_section_id);
  end loop;
end;
$$;

create or replace function app.validate_panel_bookings_after_child_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT' then
    perform app.validate_registration_panel_bookings(old.registration_id);
  end if;
  if tg_op <> 'DELETE'
    and (tg_op = 'INSERT' or new.registration_id is distinct from old.registration_id) then
    perform app.validate_registration_panel_bookings(new.registration_id);
  elsif tg_op = 'UPDATE' then
    perform app.validate_registration_panel_bookings(new.registration_id);
  end if;
  return null;
end;
$$;

create constraint trigger registration_children_validate_panel_capacity
  after insert or update or delete on public.registration_children
  deferrable initially deferred
  for each row execute function app.validate_panel_bookings_after_child_change();

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

create or replace function public.replace_owned_registration_children(
  p_registration_id uuid,
  p_children jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not app.owns_registration(p_registration_id) then
    raise exception 'registration not found for this participant' using errcode = '42501';
  end if;

  if p_children is null or jsonb_typeof(p_children) <> 'array' then
    raise exception 'children must be a JSON array' using errcode = '22023';
  end if;

  select count(*)::integer into v_count from jsonb_array_elements(p_children);
  if v_count > 10 then
    raise exception 'at most 10 children are allowed' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_children) child(
      first_name text, last_name text, birth_date date, position integer
    )
    where child.position is null
      or child.position not between 1 and 10
      or child.first_name is null
      or length(btrim(child.first_name)) not between 1 and 120
      or child.last_name is null
      or length(btrim(child.last_name)) not between 1 and 120
      or child.birth_date is null
      or child.birth_date > current_date
  ) then
    raise exception 'invalid accompanying child data' using errcode = '22023';
  end if;

  if (
    select count(distinct child.position)
    from jsonb_to_recordset(p_children) child(position integer)
  ) <> v_count then
    raise exception 'child positions must be unique' using errcode = '23505';
  end if;

  perform 1
  from public.panel_seat_sections section
  where section.id in (
    select choice.seat_section_id
    from public.moment_attendance_choices choice
    where choice.registration_id = p_registration_id
      and choice.choice = 'yes'
      and choice.seat_section_id is not null
  )
  order by section.id
  for update;

  delete from public.registration_children where registration_id = p_registration_id;

  insert into public.registration_children (
    registration_id, position, first_name, last_name, birth_date
  )
  select
    p_registration_id,
    child.position,
    btrim(child.first_name),
    btrim(child.last_name),
    child.birth_date
  from jsonb_to_recordset(p_children) child(
    first_name text, last_name text, birth_date date, position integer
  );

  perform app.validate_registration_panel_bookings(p_registration_id);
  return v_count;
end;
$$;

-- Participant panel choices must go through the atomic booking function. Managers
-- retain direct writes for operational corrections; all writes still hit the
-- deferred capacity and scope constraints above.
drop policy "moment attendance write owner or manager"
  on public.moment_attendance_choices;

create policy "moment attendance write managers or owner non-panel"
  on public.moment_attendance_choices for all
  using (
    app.can_manage_registration(registration_id)
    or (
      app.owns_registration(registration_id)
      and exists (
        select 1 from public.event_moments moment
        where moment.id = moment_attendance_choices.moment_id
          and moment.moment_type <> 'panel'
      )
    )
  )
  with check (
    app.can_manage_registration(registration_id)
    or (
      app.owns_registration(registration_id)
      and exists (
        select 1 from public.event_moments moment
        where moment.id = moment_attendance_choices.moment_id
          and moment.moment_type <> 'panel'
      )
    )
  );

revoke all on function app.registration_panel_party_size(uuid) from public, anon, authenticated;
revoke all on function app.panel_section_occupancy(uuid) from public, anon, authenticated;
revoke all on function app.validate_panel_section_booking_capacity(uuid) from public, anon, authenticated;
revoke all on function app.validate_panel_booking_after_choice_change() from public, anon, authenticated;
revoke all on function app.validate_registration_panel_overlaps(uuid) from public, anon, authenticated;
revoke all on function app.validate_panel_overlaps_after_choice_change() from public, anon, authenticated;
revoke all on function app.validate_bookings_after_panel_schedule_change() from public, anon, authenticated;
revoke all on function app.validate_panel_bookings_after_section_change() from public, anon, authenticated;
revoke all on function app.validate_registration_panel_bookings(uuid) from public, anon, authenticated;
revoke all on function app.validate_panel_bookings_after_child_change() from public, anon, authenticated;

revoke all on function public.set_individual_panel_booking(uuid, uuid, uuid, boolean) from public;
grant execute on function public.set_individual_panel_booking(uuid, uuid, uuid, boolean) to authenticated;
revoke all on function public.get_participant_panel_catalog(uuid) from public;
grant execute on function public.get_participant_panel_catalog(uuid) to authenticated;
revoke all on function public.replace_owned_registration_children(uuid, jsonb) from public;
grant execute on function public.replace_owned_registration_children(uuid, jsonb) to authenticated;

comment on function public.set_individual_panel_booking(uuid, uuid, uuid, boolean) is
  'Atomically books or cancels an owned registration in one individual panel section, enforcing party size, capacity and overlap.';

comment on function public.get_participant_panel_catalog(uuid) is
  'Returns the bookable published panel sections and current real booking state for one owned registration without exposing capacity counts.';

-- Replace the P5 aggregate with section-aware occupancy.
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
  where event.is_current
    and event.status = 'published'
    and panel.moment_type = 'panel'
    and panel.publication_status = 'published'
    and panel.is_public
    and panel.starts_at is not null
    and panel.ends_at is not null
  order by panel.starts_at, panel.title, panel.id;
$$;
