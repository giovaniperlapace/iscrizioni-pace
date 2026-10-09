-- Panel seat sections may leave physical seats undistributed, but may never
-- exceed the selected location capacity.

create or replace function app.validate_panel_configuration(target_panel_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  panel_record public.event_moments%rowtype;
  location_capacity integer;
  section_count integer;
  section_capacity bigint;
begin
  select *
  into panel_record
  from public.event_moments
  where id = target_panel_id
  for update;

  if not found or panel_record.moment_type <> 'panel' then
    return;
  end if;

  if panel_record.location_id is null then
    if panel_record.publication_status = 'published' then
      raise exception 'published panels require a location and a valid time range';
    end if;
    return;
  end if;

  select location.max_capacity
  into location_capacity
  from public.event_locations location
  where location.id = panel_record.location_id
    and location.event_id = panel_record.event_id
    and location.is_active;

  if location_capacity is null then
    if panel_record.publication_status = 'published' then
      raise exception 'published panels require an active location with a maximum capacity';
    end if;
    return;
  end if;

  select count(*), coalesce(sum(section.capacity), 0)
  into section_count, section_capacity
  from public.panel_seat_sections section
  where section.panel_id = panel_record.id;

  if section_capacity > location_capacity then
    raise exception
      'panel section capacity total (%) exceeds location capacity limit (%)',
      section_capacity,
      location_capacity;
  end if;

  if panel_record.publication_status <> 'published' then
    return;
  end if;

  if panel_record.starts_at is null
    or panel_record.ends_at is null
    or panel_record.ends_at <= panel_record.starts_at then
    raise exception 'published panels require a location and a valid time range';
  end if;

  if section_count = 0 then
    raise exception 'published panels require at least one seat section';
  end if;
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

comment on function app.validate_panel_configuration(uuid)
  is 'Validates published panel completeness and prevents all panel section totals from exceeding location capacity.';

comment on function public.publish_panels(uuid, uuid[])
  is 'Idempotently publishes panels whose section totals do not exceed location capacity.';

comment on function public.save_published_panel(
  uuid, uuid, text, text, uuid, timestamptz, timestamptz, jsonb
) is 'Atomically updates a published panel while allowing unused physical capacity.';
