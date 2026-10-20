-- Make the leader catalog compatible with the actual PostgREST read-only transaction.
begin;
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
  -- PostgREST runs STABLE RPCs in a read-only transaction. This read must not
  -- call the write guard, which locks the event with SELECT FOR SHARE.
  -- Booking mutations still use that guard and retain their event lock.
  if not exists (select 1 from public.events
    where id=p_event_id and is_current and status='published' and panel_access_mode='open') then
    raise exception 'panel bookings are not available' using errcode='42501';
  end if;
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
    and a.booking_channel = 'individual' and a.is_active and l.is_active and p.starts_at>statement_timestamp();

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
    'seats', app.registration_panel_party_size(r.id,v_panel.id),
    'children',app.panel_children_options(r.id,v_panel.id),
    'hasConflict',exists(select 1 from public.moment_attendance_choices c join public.event_moments other on other.id=c.moment_id
      where c.registration_id=r.id and c.choice='yes' and c.seat_section_id is not null and c.moment_id<>v_panel.id
      and app.panel_slots_conflict(other.starts_at,other.ends_at,v_panel.starts_at,v_panel.ends_at)),
    'hasWaiting',exists(select 1 from public.panel_waitlist q where q.section_id=p_section_id and q.status='waiting'),
    'waitlistSectionId', w.section_id,
    'waitlistAudience', (select a.name from public.panel_seat_sections s join public.panel_audience_types a on a.id=s.audience_type_id where s.id=w.section_id),
    'queuePosition', case when w.status='waiting' then (select count(*) from public.panel_waitlist q where q.section_id=w.section_id and q.status='waiting' and q.sequence<=w.sequence) end,
    'offerExpiresAt', case when w.status='offered' and w.expires_at>statement_timestamp() then w.expires_at end,
    'status', case
      when exists (select 1 from public.moment_attendance_choices c
        where c.registration_id = r.id and c.moment_id = v_panel.id and c.choice = 'yes') then 'selected'
      when w.status='offered' and w.expires_at>statement_timestamp() then 'offered'
      when w.status='waiting' then 'queued'
      when app.registration_panel_party_size(r.id,v_panel.id) > v_remaining or exists(select 1 from public.panel_waitlist where section_id=p_section_id and status='waiting') then 'full'
      when exists (select 1 from public.moment_attendance_choices c
        join public.event_moments other on other.id = c.moment_id
        where c.registration_id = r.id and c.choice = 'yes' and c.seat_section_id is not null
          and c.moment_id <> v_panel.id
          and app.panel_slots_conflict(other.starts_at, other.ends_at, v_panel.starts_at, v_panel.ends_at)) then 'conflict'
      else 'available' end
  ) order by p.last_name, p.first_name, r.id), '[]'::jsonb) into v_people
  from public.registrations r
  join public.participants p on p.id = r.participant_id
  join public.participant_group_assignments assignment on assignment.registration_id = r.id
    and assignment.is_current and assignment.status = 'confirmed'
  join public.groups g on g.id = assignment.group_id
  left join public.panel_waitlist w on w.registration_id=r.id and w.panel_id=v_panel.id
    and w.status in ('waiting','offered')
  where r.event_id = p_event_id and r.status in ('submitted', 'confirmed') and r.deleted_at is null
    and g.id = any(v_groups);
  return jsonb_build_object('panels', v_panels, 'participants', v_people);
end;
$$;
commit;
