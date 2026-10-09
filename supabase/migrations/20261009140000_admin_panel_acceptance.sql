-- First production acceptance: operational panel access is reserved to admins.
-- Keep the public release boundary independent. A later explicit migration can
-- enable manager/viewer access through this helper after user acceptance.
create or replace function app.panel_management_allowed(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select app.is_admin(); $$;
revoke all on function app.panel_management_allowed(uuid) from public;
grant execute on function app.panel_management_allowed(uuid) to anon, authenticated, service_role;

create or replace function public.save_panel_draft(
  p_event_id uuid,
  p_panel_id uuid,
  p_title text,
  p_description text,
  p_location_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_sections jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_panel_id uuid;
  v_action text;
  v_event_start date;
  v_event_end date;
  v_section_count integer;
  v_distinct_audience_count integer;
  v_section_capacity integer;
begin
  if not (app.panel_management_allowed(p_event_id)) then
    raise exception 'panel management is reserved to administrators' using errcode = '42501';
  end if;
  if not app.has_event_role(p_event_id, array['manager']::public.app_role[]) then
    raise exception 'panel draft management forbidden' using errcode = '42501';
  end if;

  if p_title is null or length(btrim(p_title)) not between 1 and 160 then
    raise exception 'panel title is required and must not exceed 160 characters'
      using errcode = '22023';
  end if;

  if p_description is not null and length(p_description) > 2000 then
    raise exception 'panel description must not exceed 2000 characters'
      using errcode = '22023';
  end if;

  if p_location_id is null or not exists (
    select 1
    from public.event_locations location
    where location.id = p_location_id
      and location.event_id = p_event_id
      and location.is_active
      and location.max_capacity is not null
  ) then
    raise exception 'panel requires an active location with a maximum capacity'
      using errcode = '22023';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'panel requires a valid time range' using errcode = '22023';
  end if;

  select starts_on, ends_on
  into v_event_start, v_event_end
  from public.events
  where id = p_event_id;

  if not found
    or v_event_start is null
    or v_event_end is null
    or (p_starts_at at time zone 'Europe/Rome')::date < v_event_start
    or (p_ends_at at time zone 'Europe/Rome')::date > v_event_end then
    raise exception 'panel time range must be inside the event dates'
      using errcode = '22023';
  end if;

  if p_sections is null or jsonb_typeof(p_sections) <> 'array' then
    raise exception 'panel sections must be a JSON array' using errcode = '22023';
  end if;

  select
    count(*)::integer,
    count(distinct section.audience_type_id)::integer,
    coalesce(sum(section.capacity), 0)::integer
  into v_section_count, v_distinct_audience_count, v_section_capacity
  from jsonb_to_recordset(p_sections) as section(
    audience_type_id uuid,
    capacity integer
  );

  if v_section_count > 20 then
    raise exception 'a panel cannot contain more than 20 seat sections'
      using errcode = '22023';
  end if;

  if v_section_count <> v_distinct_audience_count then
    raise exception 'panel audience types cannot be duplicated'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_sections) as section(
      audience_type_id uuid,
      capacity integer
    )
    where section.audience_type_id is null
      or section.capacity is null
      or section.capacity < 0
      or not exists (
        select 1
        from public.panel_audience_types audience
        where audience.id = section.audience_type_id
          and audience.event_id = p_event_id
          and audience.is_active
      )
  ) then
    raise exception 'panel sections must use active audience types and non-negative capacities'
      using errcode = '22023';
  end if;

  if p_panel_id is null then
    insert into public.event_moments (
      event_id,
      location_id,
      title,
      description,
      starts_at,
      ends_at,
      capacity,
      is_public,
      moment_type,
      publication_status
    ) values (
      p_event_id,
      p_location_id,
      btrim(p_title),
      nullif(btrim(p_description), ''),
      p_starts_at,
      p_ends_at,
      v_section_capacity,
      false,
      'panel',
      'draft'
    )
    returning id into v_panel_id;
    v_action := 'panel.draft_created';
  else
    update public.event_moments
    set
      location_id = p_location_id,
      title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      capacity = v_section_capacity
    where id = p_panel_id
      and event_id = p_event_id
      and moment_type = 'panel'
      and publication_status = 'draft'
    returning id into v_panel_id;

    if v_panel_id is null then
      raise exception 'panel draft not found or no longer editable'
        using errcode = 'P0002';
    end if;

    delete from public.panel_seat_sections
    where panel_id = v_panel_id;
    v_action := 'panel.draft_updated';
  end if;

  insert into public.panel_seat_sections (
    event_id,
    panel_id,
    audience_type_id,
    capacity
  )
  select
    p_event_id,
    v_panel_id,
    section.audience_type_id,
    section.capacity
  from jsonb_to_recordset(p_sections) as section(
    audience_type_id uuid,
    capacity integer
  );

  insert into public.audit_logs (
    event_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_event_id,
    auth.uid(),
    v_action,
    'event_moments',
    v_panel_id,
    jsonb_build_object(
      'location_id', p_location_id,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'section_count', v_section_count,
      'assigned_capacity', v_section_capacity
    )
  );

  return v_panel_id;
end;
$$;

create or replace function public.publish_panels(
  p_event_id uuid,
  p_panel_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requested_count integer;
  v_found_count integer;
  v_published_count integer;
  v_panel_id uuid;
begin
  if not (app.panel_management_allowed(p_event_id)) then
    raise exception 'panel management is reserved to administrators' using errcode = '42501';
  end if;
  if not app.has_event_role(p_event_id, array['manager']::public.app_role[]) then
    raise exception 'panel publication forbidden' using errcode = '42501';
  end if;

  select count(distinct panel_id)::integer
  into v_requested_count
  from unnest(coalesce(p_panel_ids, array[]::uuid[])) panel_id
  where panel_id is not null;

  if v_requested_count = 0 or v_requested_count > 200 then
    raise exception 'select between 1 and 200 panels' using errcode = '22023';
  end if;

  perform 1
  from public.event_moments moment
  where moment.id = any(p_panel_ids)
  order by moment.id
  for update;

  perform 1
  from public.panel_seat_sections section
  where section.panel_id = any(p_panel_ids)
  order by section.id
  for update;

  select count(*)::integer
  into v_found_count
  from public.event_moments moment
  where moment.id = any(p_panel_ids)
    and moment.event_id = p_event_id
    and moment.moment_type = 'panel';

  if v_found_count <> v_requested_count then
    raise exception 'one or more panels were not found in this event'
      using errcode = 'P0002';
  end if;

  for v_panel_id in
    select moment.id
    from public.event_moments moment
    where moment.id = any(p_panel_ids)
      and moment.event_id = p_event_id
      and moment.moment_type = 'panel'
      and moment.publication_status = 'draft'
    order by moment.id
  loop
    if not exists (
      select 1
      from public.event_moments moment
      join public.event_locations location
        on location.id = moment.location_id
       and location.event_id = moment.event_id
       and location.is_active
       and location.max_capacity is not null
      join public.events event on event.id = moment.event_id
      where moment.id = v_panel_id
        and moment.starts_at is not null
        and moment.ends_at is not null
        and moment.ends_at > moment.starts_at
        and event.starts_on is not null
        and event.ends_on is not null
        and (moment.starts_at at time zone 'Europe/Rome')::date >= event.starts_on
        and (moment.ends_at at time zone 'Europe/Rome')::date <= event.ends_on
        and exists (
          select 1
          from public.panel_seat_sections section
          where section.panel_id = moment.id
        )
        and (
          select coalesce(sum(section.capacity), 0)
          from public.panel_seat_sections section
          where section.panel_id = moment.id
        ) <= location.max_capacity
    ) then
      raise exception 'panel % is incomplete or exceeds the location capacity limit', v_panel_id
        using errcode = '23514';
    end if;
  end loop;

  update public.event_moments moment
  set publication_status = 'published'
  where moment.id = any(p_panel_ids)
    and moment.event_id = p_event_id
    and moment.moment_type = 'panel'
    and moment.publication_status = 'draft';

  get diagnostics v_published_count = row_count;

  if v_published_count > 1 then
    insert into public.audit_logs (
      event_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      metadata
    ) values (
      p_event_id,
      auth.uid(),
      'panel.batch_published',
      'event_moments',
      null,
      jsonb_build_object(
        'panel_count', v_published_count,
        'panel_ids', to_jsonb(p_panel_ids)
      )
    );
  end if;

  return jsonb_build_object(
    'requested_count', v_requested_count,
    'published_count', v_published_count
  );
end;
$$;

create or replace function public.save_published_panel(
  p_event_id uuid,
  p_panel_id uuid,
  p_title text,
  p_description text,
  p_location_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_sections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.event_moments%rowtype;
  v_event_start date;
  v_event_end date;
  v_location_capacity integer;
  v_section_count integer;
  v_distinct_audience_count integer;
  v_section_capacity integer;
  v_confirmed_count integer;
  v_individual_capacity integer;
  v_sections_changed boolean;
begin
  if not (app.panel_management_allowed((select event_id from public.event_moments where id=p_panel_id))) then
    raise exception 'panel management is reserved to administrators' using errcode = '42501';
  end if;
  if not app.has_event_role(p_event_id, array['manager']::public.app_role[]) then
    raise exception 'published panel management forbidden' using errcode = '42501';
  end if;

  select *
  into v_existing
  from public.event_moments moment
  where moment.id = p_panel_id
    and moment.event_id = p_event_id
    and moment.moment_type = 'panel'
    and moment.publication_status = 'published'
  for update;

  if not found then
    raise exception 'published panel not found' using errcode = 'P0002';
  end if;

  if p_title is null or length(btrim(p_title)) not between 1 and 160 then
    raise exception 'panel title is required and must not exceed 160 characters'
      using errcode = '22023';
  end if;

  if p_description is not null and length(p_description) > 2000 then
    raise exception 'panel description must not exceed 2000 characters'
      using errcode = '22023';
  end if;

  select location.max_capacity
  into v_location_capacity
  from public.event_locations location
  where location.id = p_location_id
    and location.event_id = p_event_id
    and location.is_active;

  if v_location_capacity is null then
    raise exception 'published panel requires an active location with a maximum capacity'
      using errcode = '22023';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'panel requires a valid time range' using errcode = '22023';
  end if;

  select starts_on, ends_on
  into v_event_start, v_event_end
  from public.events
  where id = p_event_id;

  if not found
    or v_event_start is null
    or v_event_end is null
    or (p_starts_at at time zone 'Europe/Rome')::date < v_event_start
    or (p_ends_at at time zone 'Europe/Rome')::date > v_event_end then
    raise exception 'panel time range must be inside the event dates'
      using errcode = '22023';
  end if;

  if p_sections is null or jsonb_typeof(p_sections) <> 'array' then
    raise exception 'panel sections must be a JSON array' using errcode = '22023';
  end if;

  select
    count(*)::integer,
    count(distinct section.audience_type_id)::integer,
    coalesce(sum(section.capacity), 0)::integer
  into v_section_count, v_distinct_audience_count, v_section_capacity
  from jsonb_to_recordset(p_sections) as section(
    audience_type_id uuid,
    capacity integer
  );

  if v_section_count = 0 or v_section_count > 20 then
    raise exception 'a published panel requires between 1 and 20 seat sections'
      using errcode = '22023';
  end if;

  if v_section_count <> v_distinct_audience_count then
    raise exception 'panel audience types cannot be duplicated'
      using errcode = '23505';
  end if;

  if v_section_capacity > v_location_capacity then
    raise exception 'panel section capacity total exceeds location capacity limit'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_sections) as section(
      audience_type_id uuid,
      capacity integer
    )
    where section.audience_type_id is null
      or section.capacity is null
      or section.capacity < 0
      or not exists (
        select 1
        from public.panel_audience_types audience
        where audience.id = section.audience_type_id
          and audience.event_id = p_event_id
          and (
            audience.is_active
            or exists (
              select 1
              from public.panel_seat_sections existing_section
              where existing_section.panel_id = p_panel_id
                and existing_section.audience_type_id = audience.id
            )
          )
      )
  ) then
    raise exception 'panel sections contain an invalid audience or capacity'
      using errcode = '22023';
  end if;

  select count(distinct choice.registration_id)::integer
  into v_confirmed_count
  from public.moment_attendance_choices choice
  join public.registrations registration on registration.id = choice.registration_id
  where choice.moment_id = p_panel_id
    and choice.choice = 'yes'
    and registration.status <> 'cancelled';

  select coalesce(sum(section.capacity), 0)::integer
  into v_individual_capacity
  from jsonb_to_recordset(p_sections) as section(
    audience_type_id uuid,
    capacity integer
  )
  join public.panel_audience_types audience
    on audience.id = section.audience_type_id
   and audience.event_id = p_event_id
   and audience.booking_channel = 'individual';

  if v_individual_capacity < v_confirmed_count then
    raise exception 'individual capacity cannot be lower than confirmed registrations'
      using errcode = '23514';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'audience_type_id', section.audience_type_id,
          'capacity', section.capacity
        ) order by section.audience_type_id
      ),
      '[]'::jsonb
    ) is distinct from (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'audience_type_id', requested.audience_type_id,
            'capacity', requested.capacity
          ) order by requested.audience_type_id
        ),
        '[]'::jsonb
      )
      from jsonb_to_recordset(p_sections) requested(
        audience_type_id uuid,
        capacity integer
      )
    )
  into v_sections_changed
  from public.panel_seat_sections section
  where section.panel_id = p_panel_id;

  update public.event_moments
  set
    location_id = p_location_id,
    title = btrim(p_title),
    description = nullif(btrim(p_description), ''),
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    capacity = v_section_capacity
  where id = p_panel_id;

  update public.panel_seat_sections existing_section
  set capacity = requested.capacity
  from jsonb_to_recordset(p_sections) requested(
    audience_type_id uuid,
    capacity integer
  )
  where existing_section.panel_id = p_panel_id
    and existing_section.audience_type_id = requested.audience_type_id;

  delete from public.panel_seat_sections existing_section
  where existing_section.panel_id = p_panel_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_sections) requested(
        audience_type_id uuid,
        capacity integer
      )
      where requested.audience_type_id = existing_section.audience_type_id
    );

  insert into public.panel_seat_sections (
    event_id,
    panel_id,
    audience_type_id,
    capacity
  )
  select
    p_event_id,
    p_panel_id,
    section.audience_type_id,
    section.capacity
  from jsonb_to_recordset(p_sections) as section(
    audience_type_id uuid,
    capacity integer
  )
  where not exists (
    select 1
    from public.panel_seat_sections existing_section
    where existing_section.panel_id = p_panel_id
      and existing_section.audience_type_id = section.audience_type_id
  );

  insert into public.audit_logs (
    event_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_event_id,
    auth.uid(),
    'panel.published_updated',
    'event_moments',
    p_panel_id,
    jsonb_build_object(
      'affected_registration_count', v_confirmed_count,
      'title_changed', v_existing.title is distinct from btrim(p_title),
      'description_changed', v_existing.description is distinct from nullif(btrim(p_description), ''),
      'schedule_changed', v_existing.starts_at is distinct from p_starts_at
        or v_existing.ends_at is distinct from p_ends_at,
      'location_changed', v_existing.location_id is distinct from p_location_id,
      'sections_changed', v_sections_changed,
      'previous_location_id', v_existing.location_id,
      'location_id', p_location_id,
      'previous_starts_at', v_existing.starts_at,
      'starts_at', p_starts_at,
      'previous_ends_at', v_existing.ends_at,
      'ends_at', p_ends_at
    )
  );

  return jsonb_build_object(
    'panel_id', p_panel_id,
    'affected_registration_count', v_confirmed_count
  );
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
  if not (app.panel_management_allowed(p_event_id) or app.owns_school_booking(p_booking_id)) then
    raise exception 'panel management is reserved to administrators' using errcode = '42501';
  end if;
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
  if not (app.panel_management_allowed((select event_id from public.school_bookings where id=p_booking_id)) or app.owns_school_booking(p_booking_id)) then
    raise exception 'panel management is reserved to administrators' using errcode = '42501';
  end if;
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

create or replace function public.get_panel_seat_availability(p_event_id uuid)
returns table (section_id uuid, occupied integer)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not (app.panel_management_allowed(p_event_id)) then
    raise exception 'panel management is reserved to administrators' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events where id = p_event_id and is_current)
    or not app.has_event_role(p_event_id, array['manager', 'manager_viewer']::public.app_role[]) then
    raise exception 'panel availability forbidden' using errcode = '42501';
  end if;
  return query select s.id, app.panel_section_occupancy(s.id)
    from public.panel_seat_sections s where s.event_id = p_event_id order by s.id;
end;
$$;

create policy "panel acceptance read" on public.event_moments as restrictive for select using (moment_type <> 'panel' or app.panel_management_allowed(event_id) or app.is_published_panel(id));
create policy "panel acceptance read" on public.event_locations as restrictive for select using (app.panel_management_allowed(event_id) or exists (select 1 from public.event_moments m where m.location_id=event_locations.id and m.is_public and (m.moment_type<>'panel' or app.is_published_panel(m.id))));
create policy "panel acceptance read" on public.panel_seat_sections as restrictive for select using (app.panel_management_allowed(event_id) or app.is_published_panel(panel_id));
create policy "panel acceptance read" on public.panel_audience_types as restrictive for select using (app.panel_management_allowed(event_id) or exists (select 1 from public.panel_seat_sections s where s.audience_type_id=panel_audience_types.id and app.is_published_panel(s.panel_id)));
create policy "panel acceptance read" on public.school_bookings as restrictive for select using (app.panel_management_allowed(event_id) or app.owns_school_booking(id));
create policy "panel acceptance read" on public.school_booking_teachers as restrictive for select using (app.panel_management_allowed(event_id) or exists (select 1 from public.events e where e.id=school_booking_teachers.event_id and e.is_current and e.panel_access_mode='open'));
create policy "panel acceptance read" on public.school_panel_reservations as restrictive for select using (app.panel_management_allowed(event_id) or app.owns_school_booking(booking_id));
create policy "panel acceptance read" on public.school_booking_qr_tokens as restrictive for select using (app.is_admin() or app.owns_school_booking(booking_id));
create policy "panel acceptance read" on public.moment_attendance_choices as restrictive for select using (app.is_admin() or exists (select 1 from public.event_moments m where m.id=moment_attendance_choices.moment_id and (m.moment_type<>'panel' or app.is_published_panel(m.id))));
create policy "panel acceptance insert" on public.event_moments as restrictive for insert with check (moment_type <> 'panel' or app.panel_management_allowed(event_id));
create policy "panel acceptance update" on public.event_moments as restrictive for update using (moment_type <> 'panel' or app.panel_management_allowed(event_id)) with check (moment_type <> 'panel' or app.panel_management_allowed(event_id));
create policy "panel acceptance delete" on public.event_moments as restrictive for delete using (moment_type <> 'panel' or app.panel_management_allowed(event_id));
create policy "panel acceptance insert" on public.event_locations as restrictive for insert with check (app.panel_management_allowed(event_id));
create policy "panel acceptance update" on public.event_locations as restrictive for update using (app.panel_management_allowed(event_id)) with check (app.panel_management_allowed(event_id));
create policy "panel acceptance delete" on public.event_locations as restrictive for delete using (app.panel_management_allowed(event_id));
create policy "panel acceptance insert" on public.panel_seat_sections as restrictive for insert with check (app.panel_management_allowed(event_id));
create policy "panel acceptance update" on public.panel_seat_sections as restrictive for update using (app.panel_management_allowed(event_id)) with check (app.panel_management_allowed(event_id));
create policy "panel acceptance delete" on public.panel_seat_sections as restrictive for delete using (app.panel_management_allowed(event_id));
create policy "panel acceptance insert" on public.panel_audience_types as restrictive for insert with check (app.panel_management_allowed(event_id));
create policy "panel acceptance update" on public.panel_audience_types as restrictive for update using (app.panel_management_allowed(event_id)) with check (app.panel_management_allowed(event_id));
create policy "panel acceptance delete" on public.panel_audience_types as restrictive for delete using (app.panel_management_allowed(event_id));
create policy "panel acceptance insert" on public.moment_attendance_choices as restrictive for insert with check (app.is_admin() or exists (select 1 from public.event_moments m where m.id=moment_attendance_choices.moment_id and m.moment_type<>'panel'));
create policy "panel acceptance update" on public.moment_attendance_choices as restrictive for update using (app.is_admin() or exists (select 1 from public.event_moments m where m.id=moment_attendance_choices.moment_id and m.moment_type<>'panel')) with check (app.is_admin() or exists (select 1 from public.event_moments m where m.id=moment_attendance_choices.moment_id and m.moment_type<>'panel'));
create policy "panel acceptance delete" on public.moment_attendance_choices as restrictive for delete using (app.is_admin() or exists (select 1 from public.event_moments m where m.id=moment_attendance_choices.moment_id and m.moment_type<>'panel'));

-- Existing general campaigns remain usable; new panel/school audiences are private.
create or replace function app.is_panel_campaign(p_campaign_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
 select exists (select 1 from public.email_campaigns c where c.id=p_campaign_id and (
   (c.subject_template || ' ' || c.body_template) ~* '\{\{[[:space:]]*(panel|scuola)[[:space:]]*\}\}'
   or c.filters_snapshot->>'audience'='teachers'
   or nullif(c.filters_snapshot->>'panelId','') is not null
   or nullif(c.filters_snapshot->>'schoolName','') is not null
   or exists (select 1 from public.email_campaign_recipients r where r.campaign_id=c.id and r.recipient_type='teacher')
 ));
$$;
revoke all on function app.is_panel_campaign(uuid) from public;
grant execute on function app.is_panel_campaign(uuid) to authenticated;
create policy "panel campaigns acceptance read" on public.email_campaigns as restrictive for select
using (app.is_admin() or not app.is_panel_campaign(id));
create policy "panel recipients acceptance read" on public.email_campaign_recipients as restrictive for select
using (app.is_admin() or (recipient_type<>'teacher' and not app.is_panel_campaign(campaign_id)));
