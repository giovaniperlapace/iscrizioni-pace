-- Group leaders book canonical individual panel seats in one atomic batch.
-- No service-role or caller-supplied actor is accepted by these RPCs.
create or replace function app.leader_panel_group_scope(p_event_id uuid)
returns setof uuid language sql stable security definer
set search_path = public, pg_temp as $$
  with recursive scope as (
    select g.id from public.groups g
    join public.group_memberships m on m.group_id = g.id
    where m.user_id = auth.uid() and m.role = 'capogruppo'
      and g.event_id = p_event_id and g.is_active
      and exists (select 1 from public.events e where e.id = p_event_id and e.is_current)
      and (app.is_admin() or not exists (
        select 1 from public.event_user_roles r where r.user_id = auth.uid()
          and r.role in ('manager', 'manager_viewer')
      ))
    union
    select g.id from public.groups g join scope s on g.parent_group_id = s.id
    where g.event_id = p_event_id and g.is_active
  ) select id from scope;
$$;
revoke all on function app.leader_panel_group_scope(uuid) from public, anon, authenticated;

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
revoke all on function public.get_group_panel_booking_view(uuid, uuid) from public, anon;
revoke all on function public.book_group_panel(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.get_group_panel_booking_view(uuid, uuid) to authenticated;
grant execute on function public.book_group_panel(uuid, uuid, uuid[]) to authenticated;
