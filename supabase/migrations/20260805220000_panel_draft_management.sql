-- Milestone P3: atomic creation and editing of panel drafts with seat sections.

alter table public.event_moments
  add constraint event_moments_panel_title_length
    check (
      moment_type <> 'panel'
      or length(btrim(title)) between 1 and 160
    ),
  add constraint event_moments_panel_description_length
    check (
      moment_type <> 'panel'
      or description is null
      or length(description) <= 2000
    );

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

revoke all on function public.save_panel_draft(
  uuid, uuid, text, text, uuid, timestamptz, timestamptz, jsonb
) from public;
grant execute on function public.save_panel_draft(
  uuid, uuid, text, text, uuid, timestamptz, timestamptz, jsonb
) to authenticated;

comment on function public.save_panel_draft(
  uuid, uuid, text, text, uuid, timestamptz, timestamptz, jsonb
) is 'Atomically creates or updates one draft panel and replaces its seat sections.';
