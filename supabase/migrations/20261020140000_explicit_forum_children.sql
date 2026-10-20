-- Explicit child participation per Forum. Existing bookings/queues retain their seats.
-- Serialize the backfill with live writes; the release runner applies this atomically.
lock table public.registrations,public.participant_group_assignments,public.event_moments,
 public.panel_seat_sections,public.moment_attendance_choices,public.panel_waitlist,public.registration_children
 in share row exclusive mode;
create table public.panel_child_selections (
 registration_id uuid not null references public.registrations(id) on delete cascade,
 panel_id uuid not null references public.event_moments(id) on delete cascade,
 child_ids uuid[] not null default '{}',
 primary key(registration_id,panel_id)
);
alter table public.panel_child_selections enable row level security;
revoke all on public.panel_child_selections from public,anon,authenticated;
grant select on public.panel_child_selections to authenticated;
grant all on public.panel_child_selections to service_role;
create policy "read authorized forum child selections" on public.panel_child_selections for select to authenticated
 using(app.owns_registration(registration_id) or exists (
 select 1 from public.moment_attendance_choices c where c.registration_id=panel_child_selections.registration_id
 and c.moment_id=panel_child_selections.panel_id));
insert into public.panel_child_selections(registration_id,panel_id,child_ids)
 select r.registration_id,r.panel_id,array(select c.id from public.registration_children c where c.registration_id=r.registration_id order by c.id)
 from (select registration_id,moment_id as panel_id from public.moment_attendance_choices where choice='yes' and seat_section_id is not null
 union select registration_id,panel_id from public.panel_waitlist where status in ('waiting','offered')) r;

create function app.panel_child_ids(p_registration_id uuid,p_panel_id uuid) returns uuid[]
 language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(array_agg(c.id order by c.id),'{}'::uuid[]) from public.registration_children c
 join public.panel_child_selections s on s.registration_id=c.registration_id and c.id=any(s.child_ids)
 where s.registration_id=p_registration_id and s.panel_id=p_panel_id;
$$;
create function app.registration_panel_party_size(p_registration_id uuid,p_panel_id uuid) returns integer
 language sql stable security definer set search_path=public,pg_temp as $$
 select 1+cardinality(app.panel_child_ids(p_registration_id,p_panel_id));
$$;
create function app.panel_children_options(p_registration_id uuid,p_panel_id uuid) returns jsonb
 language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',concat_ws(' ',c.first_name,c.last_name),
 'selected',c.id=any(app.panel_child_ids(p_registration_id,p_panel_id))) order by c.position,c.id),'[]'::jsonb)
 from public.registration_children c where c.registration_id=p_registration_id;
$$;
revoke all on function app.panel_child_ids(uuid,uuid),app.registration_panel_party_size(uuid,uuid),app.panel_children_options(uuid,uuid) from public,anon,authenticated;
grant execute on function app.panel_child_ids(uuid,uuid) to service_role;


create or replace function app.panel_section_booked_seats(p_section_id uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select (coalesce((select sum(app.registration_panel_party_size(c.registration_id,c.moment_id))
    from public.moment_attendance_choices c join public.registrations r on r.id=c.registration_id
    where c.seat_section_id=p_section_id and c.choice='yes' and r.status in ('submitted','confirmed') and r.deleted_at is null),0)
    + app.school_panel_section_occupancy(p_section_id))::integer;
$$;

create or replace function app.advance_panel_waitlist(p_section_id uuid,p_promote boolean default false)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_capacity integer; v_free integer; v_seats integer; v_count integer:=0; w record;
begin
  select capacity into v_capacity from public.panel_seat_sections where id=p_section_id for update;
  if not found then return 0; end if;
  with expired as (update public.panel_waitlist set status='expired'
    where section_id=p_section_id and status='offered' and expires_at <= clock_timestamp() returning id,event_id)
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    select event_id,null,'panel.waitlist_expired','panel_waitlist',id,jsonb_build_object('section_id',p_section_id) from expired;
  update public.panel_waitlist q set status='cancelled'
    where q.section_id=p_section_id and q.status in ('waiting','offered') and not app.panel_waitlist_recipient_valid(q);
  -- Closing/unpublishing cancels reservations. Waiting entries survive a temporary closure.
  if not exists (select 1 from public.panel_seat_sections s
    join public.event_moments p on p.id=s.panel_id join public.events e on e.id=p.event_id
    join public.event_locations l on l.id=p.location_id
    join public.panel_audience_types a on a.id=s.audience_type_id
    where s.id=p_section_id and e.is_current and e.status='published' and e.panel_access_mode='open'
      and p.moment_type='panel' and p.is_public and p.publication_status='published'
      and p.starts_at > clock_timestamp() and l.is_active and a.is_active and a.booking_channel='individual') then
    update public.panel_waitlist set status='cancelled' where section_id=p_section_id and status='offered';
    return 0;
  end if;
  -- A booking made through an authorized operational route removes the redundant queue entry.
  update public.panel_waitlist q set status='accepted' where q.section_id=p_section_id
    and q.status in ('waiting','offered') and exists (select 1 from public.moment_attendance_choices c
      where c.registration_id=q.registration_id and c.moment_id=q.panel_id and c.choice='yes');
  if not p_promote then return 0; end if;
  v_free := v_capacity-app.panel_section_occupancy(p_section_id);
  for w in select * from public.panel_waitlist where section_id=p_section_id and status='waiting' order by sequence for update loop
    v_seats := app.registration_panel_party_size(w.registration_id,w.panel_id);
    -- Strict FIFO: an entire family must fit before considering the next entry.
    exit when v_seats > v_free;
    update public.panel_waitlist set status='offered', reserved_seats=v_seats,
      offered_at=clock_timestamp(), expires_at=clock_timestamp()+interval '30 minutes', notification_status='pending'
      where id=w.id;
    insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
      values(w.event_id,null,'panel.waitlist_offered','panel_waitlist',w.id,jsonb_build_object('section_id',p_section_id,'seats',v_seats));
    v_free := v_free-v_seats; v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

create or replace function app.set_panel_waitlist(p_registration_id uuid,p_panel_id uuid,p_section_id uuid,p_intent text,p_as_leader boolean,p_locale text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.registrations%rowtype; w public.panel_waitlist%rowtype; result jsonb; replaced uuid[];
begin
  select * into r from public.registrations where id=p_registration_id for update;
  if p_as_leader then
    perform 1 from public.participant_group_assignments where registration_id=p_registration_id and is_current order by id for update;
    if not app.can_manage_group_panel_registration(r.event_id,r.id,auth.uid()) then
      raise exception 'registration outside leader scope or inactive' using errcode='42501';
    end if;
  elsif not app.owns_registration(p_registration_id) then
    raise exception 'registration not found for this participant' using errcode='42501';
  end if;
  if r.id is null then raise exception 'registration not found' using errcode='42501'; end if;
  perform app.require_panel_bookings_open(r.event_id);
  if r.status not in ('submitted','confirmed') or r.deleted_at is not null then raise exception 'registration is not available' using errcode='22023'; end if;
  if p_intent not in ('join','leave','accept') or p_intent is null then raise exception 'invalid waitlist intent' using errcode='22023'; end if;
  -- Lock all panels/sections that may be changed by acceptance in stable order.
  perform 1 from public.event_moments p where p.id=p_panel_id or p.id in (
    select moment_id from public.moment_attendance_choices where registration_id=p_registration_id and choice='yes') order by p.id for update;
  perform 1 from public.panel_seat_sections s where s.id=p_section_id or s.id in (
    select seat_section_id from public.moment_attendance_choices where registration_id=p_registration_id and choice='yes') or s.id in (
    select section_id from public.panel_waitlist where registration_id=p_registration_id and panel_id=p_panel_id and status in ('waiting','offered')) order by s.id for update;
  if not exists(select 1 from public.event_moments p join public.panel_seat_sections s on s.panel_id=p.id
    join public.panel_audience_types a on a.id=s.audience_type_id join public.event_locations l on l.id=p.location_id
    where p.id=p_panel_id and p.event_id=r.event_id and s.id=p_section_id and s.event_id=r.event_id
      and a.is_active and a.booking_channel='individual' and l.is_active and p.is_public and p.publication_status='published'
      and p.starts_at>clock_timestamp()) and p_intent<>'leave' then
    raise exception 'panel is not available' using errcode='22023';
  end if;
  perform app.advance_panel_waitlist(p_section_id);
  select * into w from public.panel_waitlist where registration_id=p_registration_id and panel_id=p_panel_id
    order by sequence desc limit 1 for update;
  if p_intent='leave' then
    if w.status in ('waiting','offered') then
      update public.panel_waitlist set status='cancelled' where id=w.id;
      insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
        values(r.event_id,auth.uid(),'panel.waitlist_left','panel_waitlist',w.id,jsonb_build_object('panel_id',p_panel_id));
      perform app.advance_panel_waitlist(w.section_id);
    end if;
    return jsonb_build_object('status','left');
  end if;
  if p_intent='join' then
    if exists(select 1 from public.moment_attendance_choices where registration_id=r.id and moment_id=p_panel_id and choice='yes') then
      return jsonb_build_object('status','booked');
    end if;
    if w.status in ('waiting','offered') then return jsonb_build_object('status','queued'); end if;
    if app.panel_section_occupancy(p_section_id)+app.registration_panel_party_size(r.id,p_panel_id)<=(select capacity from public.panel_seat_sections where id=p_section_id)
      and not exists(select 1 from public.panel_waitlist where section_id=p_section_id and status='waiting') then
      return jsonb_build_object('status','available');
    end if;
    insert into public.panel_waitlist(event_id,registration_id,panel_id,section_id,notification_user_id,notification_kind,notification_locale)
      values(r.event_id,r.id,p_panel_id,p_section_id,auth.uid(),case when p_as_leader then 'leader' else 'participant' end,p_locale) returning * into w;
    insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
      values(r.event_id,auth.uid(),'panel.waitlist_joined','panel_waitlist',w.id,jsonb_build_object('panel_id',p_panel_id));
    return jsonb_build_object('status','queued');
  end if;
  if w.status='accepted' and exists(select 1 from public.moment_attendance_choices where registration_id=r.id and moment_id=p_panel_id and choice='yes') then
    return jsonb_build_object('status','booked');
  end if;
  if w.id is null or w.status<>'offered' or w.section_id<>p_section_id or w.expires_at<=clock_timestamp() then
    return jsonb_build_object('status','expired');
  end if;
  if w.reserved_seats<>app.registration_panel_party_size(r.id,p_panel_id) then raise exception 'reserved family size changed' using errcode='22023'; end if;
  -- Consume the hold before creating its canonical booking; any failure rolls everything back.
  update public.panel_waitlist set status='accepted',accepted_at=clock_timestamp() where id=w.id;
  select array_agg(c.moment_id) into replaced from public.moment_attendance_choices c
    join public.event_moments old_panel on old_panel.id=c.moment_id
    join public.event_moments target on target.id=p_panel_id
    where c.registration_id=r.id and c.choice='yes' and c.seat_section_id is not null and c.moment_id<>p_panel_id
      and app.panel_slots_conflict(old_panel.starts_at,old_panel.ends_at,target.starts_at,target.ends_at);
  update public.moment_attendance_choices c set choice='no',seat_section_id=null
    from public.event_moments old_panel,public.event_moments target
    where c.registration_id=r.id and c.choice='yes' and c.seat_section_id is not null and c.moment_id<>p_panel_id
      and old_panel.id=c.moment_id and target.id=p_panel_id
      and app.panel_slots_conflict(old_panel.starts_at,old_panel.ends_at,target.starts_at,target.ends_at);
  if p_as_leader then
    result:=public.book_group_panel(r.event_id,p_section_id,array[r.id]);
  else
    result:=app.set_individual_panel_booking_base(r.id,p_panel_id,p_section_id,true);
  end if;
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(r.event_id,auth.uid(),'panel.waitlist_accepted','panel_waitlist',w.id,jsonb_build_object('panel_id',p_panel_id,'replaced_panel_ids',coalesce(to_jsonb(replaced),'[]'::jsonb)));
  return jsonb_build_object('status','booked');
end;
$$;

create or replace function app.set_individual_panel_booking_base(
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

  if v_registration.status not in ('submitted', 'confirmed') or v_registration.deleted_at is not null then
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
      and app.panel_slots_conflict(selected_panel.starts_at, selected_panel.ends_at, v_panel.starts_at, v_panel.ends_at)
  ) then
    raise exception 'panel booking overlaps another selected panel' using errcode = '23P01';
  end if;

  v_party_size := app.registration_panel_party_size(p_registration_id,p_panel_id);
  v_occupied := app.panel_section_occupancy(p_section_id)
    - case when v_current_section_id = p_section_id then v_party_size else 0 end;

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
    or v_panel.starts_at<=clock_timestamp()
    or not exists(select 1 from public.event_locations where id=v_panel.location_id and is_active)
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
      and app.panel_slots_conflict(p.starts_at, p.ends_at, v_panel.starts_at, v_panel.ends_at)
  ) then raise exception 'panel overlap' using errcode = '23P01'; end if;
  select sum(app.registration_panel_party_size(id,v_panel.id)) into v_needed from unnest(v_ids) id;
  perform app.advance_panel_waitlist(p_section_id);
  if (exists(select 1 from public.panel_waitlist where section_id=p_section_id and status='waiting')
      and exists(select 1 from unnest(v_ids) rid where not exists (
        select 1 from public.panel_waitlist q where q.registration_id=rid and q.section_id=p_section_id
          and q.status='accepted' and q.accepted_at>=statement_timestamp())))
    or app.panel_section_occupancy(p_section_id) + v_needed > v_capacity then
    raise exception 'panel section is full' using errcode = 'P0001';
  end if;
  foreach v_id in array v_ids loop
    insert into public.moment_attendance_choices(registration_id, moment_id, choice, seat_section_id)
    values (v_id, v_panel.id, 'yes', p_section_id)
    on conflict (registration_id, moment_id) do update set choice = 'yes', seat_section_id = excluded.seat_section_id;
    insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
    values (p_event_id, auth.uid(), 'panel.group_booking_confirmed', 'registrations', v_id,
      jsonb_build_object('panel_id', v_panel.id, 'section_id', p_section_id,
        'party_size', app.registration_panel_party_size(v_id,v_panel.id)));
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
  v_seats := app.registration_panel_party_size(p_registration_id,v_panel_id);
  update public.moment_attendance_choices set choice = 'no', seat_section_id = null
    where registration_id = p_registration_id and moment_id = v_panel_id and choice = 'yes';
  insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
    values(p_event_id, auth.uid(), 'panel.group_booking_cancelled', 'registrations', p_registration_id,
      jsonb_build_object('panel_id',v_panel_id,'section_id',v_current_section,'party_size',v_seats));
  return jsonb_build_object('count',1,'seats',v_seats);
end;
$$;

create or replace function app.protect_offered_family_size()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare rid uuid;
begin
  for rid in select distinct x from unnest(array[
    case when tg_op<>'INSERT' then old.registration_id end,
    case when tg_op<>'DELETE' then new.registration_id end]) x where x is not null loop
    perform 1 from public.panel_seat_sections s where s.id in (select section_id from public.panel_waitlist
      where registration_id=rid and status='offered') order by s.id for update;
    if exists(select 1 from public.panel_waitlist where registration_id=rid and status='offered'
      and expires_at>clock_timestamp() and reserved_seats<>app.registration_panel_party_size(rid,panel_id)) then
      raise exception 'cancel the reserved forum offer before changing family size' using errcode='22023';
    end if;
  end loop;
  return null;
end;
$$;

drop function public.get_participant_panel_catalog(uuid);

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
  party_size integer,
  waitlist_status text,
  offer_expires_at timestamptz,
  queue_position bigint,
  children jsonb, remaining_seats integer, has_waiting boolean, has_slot_conflict boolean
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
      and registration.status in ('submitted', 'confirmed') and registration.deleted_at is null
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
      when w.status='offered' and w.expires_at>statement_timestamp() then 'offered'
      when w.status='waiting' then 'queued'
      when app.panel_section_occupancy(section.id)+app.registration_panel_party_size(registration.id,panel.id)>section.capacity
        or exists(select 1 from public.panel_waitlist q where q.section_id=section.id and q.status='waiting') then 'full'
      when exists (
        select 1
        from selected other_choice
        join public.event_moments other_panel on other_panel.id = other_choice.moment_id
        where other_choice.moment_id <> panel.id
          and app.panel_slots_conflict(other_panel.starts_at, other_panel.ends_at, panel.starts_at, panel.ends_at)
      ) then 'conflict'
      when app.panel_section_occupancy(section.id)
        + app.registration_panel_party_size(registration.id,panel.id) > section.capacity then 'full'
      else 'available'
    end,
    app.registration_panel_party_size(registration.id,panel.id),
    case when w.status='offered' and w.expires_at<=statement_timestamp() then 'expired' else w.status end,
    case when w.status='offered' and w.expires_at>statement_timestamp() then w.expires_at end,
    case when w.status='waiting' then (select count(*) from public.panel_waitlist q where q.section_id=section.id and q.status='waiting' and q.sequence<=w.sequence) end,
    app.panel_children_options(registration.id,panel.id),
    greatest(0,section.capacity-app.panel_section_occupancy(section.id)),
    exists(select 1 from public.panel_waitlist q where q.section_id=section.id and q.status='waiting'),
    exists(select 1 from selected other_choice join public.event_moments other_panel on other_panel.id=other_choice.moment_id
      where other_choice.moment_id<>panel.id and app.panel_slots_conflict(other_panel.starts_at,other_panel.ends_at,panel.starts_at,panel.ends_at))
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
  left join public.panel_waitlist w on w.registration_id=registration.id and w.panel_id=panel.id and w.section_id=section.id and w.status in ('waiting','offered')
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

create or replace function public.reception_panel_check_in(
  p_duty text, p_panel_id uuid, p_event_id uuid, p_actor_user_id uuid, p_lookup_kind text, p_lookup text,
  p_action text default 'inspect', p_request_id uuid default null,
  p_subject_ids uuid[] default '{}', p_students integer default null,
  p_companions integer default null, p_expected_revision integer default null,
  p_reason text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  panel public.event_moments; section public.panel_seat_sections;
  section_id uuid; section_label text; room_name text; location_capacity integer;
  reservation_students integer; reservation_companions integer; arrival public.check_ins;
  expected_students integer; expected_companions integer; occupied bigint; desired integer;
  r public.registrations; b public.school_bookings; q record;
  target_id uuid; school boolean := false; person uuid; ci public.check_ins;
  revision integer; changed integer := 0; replay boolean := false;
  fingerprint text; previous_request public.check_in_requests;
  v_source text; outcome text := 'verified'; persons jsonb; result jsonb; before_state jsonb; after_state jsonb;
begin
  -- Lock the exact assignment so revocation and a command have a definite order.
  if p_duty is null or p_duty not in ('panel_entry','room_assistance')
    or (p_duty='room_assistance' and p_action is distinct from 'inspect') then
    raise insufficient_privilege using message='Panel duty forbidden';
  end if;
  perform 1 from public.panel_reception_assignments where user_id=p_actor_user_id
    and event_id=p_event_id and panel_id=p_panel_id and duty=p_duty for share;
  if not found then raise insufficient_privilege using message='Panel assignment required'; end if;
  perform 1 from public.events where id=p_event_id and is_current for share;
  if not found then raise insufficient_privilege using message='Reception event unavailable'; end if;
  if p_action is null or p_action not in ('inspect','enter','correct','cancel')
    or p_lookup_kind is null or p_lookup_kind not in ('qr','code')
    or (p_reason is not null and p_reason not in ('selection_error','count_error','entry_cancelled'))
    or p_lookup is null or (p_lookup_kind='qr' and p_lookup !~ '^[a-f0-9]{64}$')
    or (p_lookup_kind='code' and p_lookup !~ '^[A-Z0-9]{4}$') then
    raise invalid_parameter_value using message='Invalid reception request';
  end if;
  v_source := case when p_lookup_kind='qr' then 'qr_scan' else 'manual' end;
  -- Parent first, then token locks: same order as cancellation/revocation flows.
  if p_lookup_kind='qr' then
    select registration_id into target_id from public.qr_tokens where token_hash=p_lookup;
    if target_id is null then
      select booking_id into target_id from public.school_booking_qr_tokens where token_hash=p_lookup;
      school := true;
    elsif exists(select 1 from public.school_booking_qr_tokens where token_hash=p_lookup) then
      target_id := null; -- Ambiguous token namespaces fail closed.
    end if;
  else
    select reg.id into target_id from public.registrations reg join public.participants p on p.id=reg.participant_id
      where p.public_code=p_lookup and reg.event_id=p_event_id;
  end if;
  if school then
    select * into b from public.school_bookings where id=target_id and event_id=p_event_id for update;
    if not found or b.status not in ('submitted','confirmed') then target_id:=null; end if;

  else
    select * into r from public.registrations where id=target_id and event_id=p_event_id for update;
    if not found or r.deleted_at is not null or r.cancelled_at is not null or r.status not in ('submitted','confirmed') then target_id:=null; end if;

  end if;
  if target_id is not null and p_lookup_kind='qr' then
    if school then
      select id,status,revoked_at,expires_at,token_hash into q from public.school_booking_qr_tokens
        where booking_id=target_id order by created_at desc,id desc limit 1 for share;
    else
      select id,status,revoked_at,expires_at,token_hash into q from public.qr_tokens
        where registration_id=target_id order by created_at desc,id desc limit 1 for share;
    end if;
    if not found or q.token_hash<>p_lookup or q.status<>'active' or q.revoked_at is not null
      or (q.expires_at is not null and q.expires_at<=clock_timestamp()) then target_id:=null; end if;
  end if;
  if target_id is null then
    -- Invalid lookups disclose no identity. Room assistance does not write data.
    return jsonb_build_object('status','invalid');
  end if;

  -- Same parent/reservation/panel/section lock order as booking operations.
  if school then
    select seat_section_id,student_count,companion_count
      into section_id,reservation_students,reservation_companions
      from public.school_panel_reservations where booking_id=target_id
        and panel_id=p_panel_id and event_id=p_event_id and status='reserved' for share;
  else
    select seat_section_id into section_id from public.moment_attendance_choices
      where registration_id=target_id and moment_id=p_panel_id and choice='yes' for share;
  end if;
  if section_id is null then return jsonb_build_object('status','not_booked'); end if;
  select * into panel from public.event_moments where id=p_panel_id and event_id=p_event_id
    and moment_type='panel' and publication_status='published' for update;
  if not found then return jsonb_build_object('status','panel_unavailable'); end if;
  select name,max_capacity into room_name,location_capacity from public.event_locations
    where id=panel.location_id and event_id=p_event_id and is_active for share;
  if not found or location_capacity is null then return jsonb_build_object('status','panel_unavailable'); end if;
  select * into section from public.panel_seat_sections where id=section_id
    and event_id=p_event_id and panel_id=p_panel_id for update;
  if not found then return jsonb_build_object('status','not_booked'); end if;
  select name into section_label from public.panel_audience_types where id=section.audience_type_id
    and event_id=p_event_id and is_active
    and booking_channel=case when school then 'school_booking'::public.panel_booking_channel else 'individual'::public.panel_booking_channel end for share;
  if not found then return jsonb_build_object('status','not_booked'); end if;
  -- Room assistance gets only routing information, with no attendance history,
  -- technical subject IDs, quantities, contacts or writes (including audit).
  if p_duty='room_assistance' then
    return jsonb_build_object('status','valid','kind','room','revision',0,'outcome','verified',
      'registrationStatus',case when school then b.status::text else r.status::text end,
      'label',case when school then b.school_name||' · '||b.class_description else
        (select first_name||' '||last_name from public.participants where id=r.participant_id) end,
      'panel',jsonb_build_object('id',p_panel_id,'title',panel.title,'room',room_name,'section',section_label));
  end if;
  select coalesce((select pr.revision from public.panel_check_in_revisions pr
    where pr.panel_id=p_panel_id and pr.subject_id=target_id),0) into revision;
  if school then
    select * into arrival from public.check_ins where school_booking_id=target_id
      and event_id=p_event_id and moment_id is null and cancelled_at is null;
    expected_students:=least(reservation_students,b.student_count,coalesce(arrival.student_count,0));
    expected_companions:=least(reservation_companions,b.companion_count,coalesce(arrival.companion_count,0));
    if arrival.id is null and (p_action not in ('inspect','cancel') or
      (p_action='inspect' and not exists(select 1 from public.check_ins where school_booking_id=target_id
        and moment_id=p_panel_id and cancelled_at is null))) then
      return jsonb_build_object('status','event_entry_required');
    end if;
  end if;

  if p_action<>'inspect' then
    if p_request_id is null or p_subject_ids is null or cardinality(p_subject_ids)>11
      or (p_action in ('correct','cancel') and (p_expected_revision is null or p_expected_revision<0
        or p_reason is null or p_reason not in ('selection_error','count_error','entry_cancelled'))) then
      raise invalid_parameter_value using message='Explicit correction and request identity required';
    end if;
    fingerprint := encode(sha256(convert_to(jsonb_build_array(p_duty,p_panel_id,p_event_id,p_actor_user_id,p_lookup_kind,p_lookup,
      p_action,p_subject_ids,p_students,p_companions,p_expected_revision,p_reason)::text,'UTF8')),'hex');
    -- Global key lock also serializes accidental reuse across different subjects.
    perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,11));
    select * into previous_request from public.check_in_requests where request_id=p_request_id;
    if found then
      if previous_request.fingerprint<>fingerprint then
        raise invalid_parameter_value using message='Request identity already used';
      end if;
      replay := true;
      outcome := 'replayed';
    elsif p_action in ('correct','cancel') and p_expected_revision<>revision then
      return jsonb_build_object('status','conflict');
    end if;
  end if;

  if p_action<>'inspect' and not replay then
    if p_action<>'cancel' then
      if school then
        desired:=case when p_action='enter' and exists(select 1 from public.check_ins where school_booking_id=target_id
          and moment_id=p_panel_id and cancelled_at is null) then
          (select student_count+companion_count from public.check_ins where school_booking_id=target_id and moment_id=p_panel_id and cancelled_at is null)
          else coalesce(p_students,0)+coalesce(p_companions,0) end;
      else
        select count(*) into desired from (select unnest(p_subject_ids) id union
          select coalesce(child_id,registration_id) from public.check_ins where registration_id=target_id
            and moment_id=p_panel_id and cancelled_at is null and p_action='enter') subjects;
      end if;
      select coalesce(sum(case when school_booking_id is null then 1 else student_count+companion_count end),0)
        into occupied from public.check_ins where moment_id=p_panel_id and cancelled_at is null
          and seat_section_id=section_id and coalesce(registration_id,school_booking_id)<>target_id;
      if occupied+desired>section.capacity then return jsonb_build_object('status','capacity_exceeded'); end if;
      select coalesce(sum(case when school_booking_id is null then 1 else student_count+companion_count end),0)
        into occupied from public.check_ins where moment_id=p_panel_id and cancelled_at is null
          and coalesce(registration_id,school_booking_id)<>target_id;
      if occupied+desired>location_capacity then return jsonb_build_object('status','capacity_exceeded'); end if;
      -- Existing admissions retain their historical section; do not silently move them.
      if exists(select 1 from public.check_ins where moment_id=p_panel_id and cancelled_at is null
        and coalesce(registration_id,school_booking_id)=target_id and seat_section_id is distinct from section_id) then
        return jsonb_build_object('status','conflict');
      end if;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'child_id',child_id,'cancelled_at',cancelled_at,
      'student_count',student_count,'companion_count',companion_count)), '[]') into before_state
      from public.check_ins where event_id=p_event_id and moment_id=p_panel_id
        and (registration_id=target_id or school_booking_id=target_id);
    if school then
      if cardinality(p_subject_ids)<>0 or (p_action<>'cancel' and
        (p_students is null or p_companions is null or p_students<0 or p_companions<0
        or p_students>expected_students or p_companions>expected_companions or p_students+p_companions=0)) then
        raise invalid_parameter_value using message='Invalid school attendance counts';
      end if;
      select * into ci from public.check_ins where school_booking_id=target_id and event_id=p_event_id and moment_id=p_panel_id for update;
      if p_action='cancel' then
        update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor_user_id
          where id=ci.id and cancelled_at is null;
        get diagnostics changed=row_count;
      elsif ci.id is null then
        insert into public.check_ins(event_id,moment_id,seat_section_id,school_booking_id,student_count,companion_count,checked_in_by,updated_by,source)
          values(p_event_id,p_panel_id,section_id,target_id,p_students,p_companions,p_actor_user_id,p_actor_user_id,v_source);
        changed:=1;
      elsif ci.cancelled_at is not null or (p_action='correct' and (ci.student_count<>p_students or ci.companion_count<>p_companions)) then
        update public.check_ins set student_count=p_students,companion_count=p_companions,cancelled_at=null,seat_section_id=section_id,
          checked_in_at=case when cancelled_at is not null then clock_timestamp() else checked_in_at end,
          checked_in_by=case when cancelled_at is not null then p_actor_user_id else checked_in_by end,
          updated_at=clock_timestamp(),updated_by=p_actor_user_id,source=v_source where id=ci.id;
        changed:=1;
      end if;
    else
      -- Child rows cannot disappear between validation and persistence.
      perform 1 from public.registration_children where registration_id=target_id order by id for share;
      if p_students is not null or p_companions is not null or cardinality(p_subject_ids)=0
        or array_position(p_subject_ids,null) is not null
        or cardinality(p_subject_ids)<>(select count(distinct x) from unnest(p_subject_ids) x)
        or exists(select 1 from unnest(p_subject_ids) x where x<>target_id and not exists(
          select 1 from public.registration_children where id=x and registration_id=target_id and (p_action='cancel' or id=any(app.panel_child_ids(target_id,p_panel_id))))) then
        raise invalid_parameter_value using message='Invalid family selection';
      end if;
      if p_action<>'cancel' and exists(select 1 from unnest(p_subject_ids) x where not exists(
        select 1 from public.check_ins e where e.registration_id=target_id and e.event_id=p_event_id
          and e.moment_id is null and e.cancelled_at is null and coalesce(e.child_id,e.registration_id)=x)) then
        return jsonb_build_object('status','event_entry_required');
      end if;
      if p_action='correct' then
        update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor_user_id
          where registration_id=target_id and moment_id=p_panel_id and cancelled_at is null
            and not(coalesce(child_id,registration_id)=any(p_subject_ids));
        get diagnostics changed=row_count;
      end if;
      foreach person in array p_subject_ids loop
        ci:=null;
        select * into ci from public.check_ins where registration_id=target_id and moment_id=p_panel_id
          and coalesce(child_id,registration_id)=person for update;
        if p_action='cancel' then
          if ci.id is not null and ci.cancelled_at is null then
            update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor_user_id where id=ci.id;
            changed:=changed+1;
          end if;
        elsif ci.id is null then
          insert into public.check_ins(registration_id,event_id,moment_id,seat_section_id,child_id,checked_in_by,updated_by,source)
            values(target_id,p_event_id,p_panel_id,section_id,case when person=target_id then null else person end,p_actor_user_id,p_actor_user_id,v_source);
          changed:=changed+1;
        elsif ci.cancelled_at is not null then
          update public.check_ins set cancelled_at=null,seat_section_id=section_id,checked_in_at=clock_timestamp(),checked_in_by=p_actor_user_id,
            updated_at=clock_timestamp(),updated_by=p_actor_user_id,source=v_source where id=ci.id;
          changed:=changed+1;
        end if;
      end loop;
    end if;
    if changed>0 then
      insert into public.panel_check_in_revisions(panel_id,subject_id,revision) values(p_panel_id,target_id,1)
        on conflict(panel_id,subject_id) do update set revision=panel_check_in_revisions.revision+1 returning panel_check_in_revisions.revision into revision;
    end if;
    outcome:=case when changed=0 then 'unchanged' else 'saved' end;
    insert into public.check_in_requests(request_id,event_id,actor_user_id,fingerprint) values(p_request_id,p_event_id,p_actor_user_id,fingerprint);
  end if;
  -- Do not include contacts, dates of birth, questionnaire, notes, or tokens.
  if school then
    select * into ci from public.check_ins where school_booking_id=target_id and event_id=p_event_id and moment_id=p_panel_id;
    result:=jsonb_build_object('kind','school','schoolName',b.school_name,'classDescription',b.class_description,
      'registrationStatus',b.status,'expectedStudents',expected_students,'expectedCompanions',expected_companions,
      'students',case when ci.cancelled_at is null then coalesce(ci.student_count,0) else 0 end,
      'companions',case when ci.cancelled_at is null then coalesce(ci.companion_count,0) else 0 end,
      'checkedInAt',case when ci.cancelled_at is null then ci.checked_in_at else null end);
  else
    select jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'firstName',s.first_name,'lastName',s.last_name,
      'checkedInAt',case when c.cancelled_at is null then c.checked_in_at else null end,
      'eventCheckedIn',exists(select 1 from public.check_ins e where e.registration_id=target_id and e.moment_id is null
        and e.cancelled_at is null and coalesce(e.child_id,e.registration_id)=s.id)) order by s.position) into persons
    from (select r.id as id,'adult' as kind,p.first_name,p.last_name,0 as position from public.participants p where p.id=r.participant_id
      union all select id,'child',first_name,last_name,position from public.registration_children where registration_id=target_id and id=any(app.panel_child_ids(target_id,p_panel_id))) s
    left join public.check_ins c on c.registration_id=target_id and c.moment_id=p_panel_id and coalesce(c.child_id,c.registration_id)=s.id;
    result:=jsonb_build_object('kind','family','code',(select public_code from public.participants where id=r.participant_id),
      'registrationStatus',r.status,'persons',persons);
  end if;
  if p_action<>'inspect' then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'child_id',child_id,'cancelled_at',cancelled_at,
      'checked_in_at',checked_in_at,'student_count',student_count,'companion_count',companion_count)), '[]') into after_state
      from public.check_ins where event_id=p_event_id and moment_id=p_panel_id
        and (registration_id=target_id or school_booking_id=target_id);
  end if;
  if p_duty<>'room_assistance' then
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(p_event_id,p_actor_user_id,'reception.panel.'||p_action,case when school then 'school_bookings' else 'registrations' end,target_id,
      jsonb_build_object('panel_id',p_panel_id,'duty',p_duty,'source',v_source,'outcome',outcome,'revision',revision,'request_id',p_request_id,
        'reason',p_reason,'changed',changed,'before',before_state,'after',after_state));
  end if;
  return result || jsonb_build_object('status','valid','revision',revision,'outcome',outcome,
    'panel',jsonb_build_object('id',p_panel_id,'title',panel.title,'room',room_name,'section',section_label));
end $$;


revoke all on function public.get_participant_panel_catalog(uuid) from public,anon;
grant execute on function public.get_participant_panel_catalog(uuid) to authenticated;

-- One transaction for explicit selection and canonical booking/waitlist mutation.
-- The old RPCs cannot include new children implicitly: absence of selection means adult only.
create function public.set_panel_family_booking(
 p_registration_id uuid,p_panel_id uuid,p_section_id uuid,p_intent text,
 p_child_ids uuid[],p_as_leader boolean default false,p_locale text default 'en'
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.registrations%rowtype; result jsonb; existing_ids uuid[]; active boolean;
begin
 select * into r from public.registrations where id=p_registration_id for update;
 if r.id is null or auth.uid() is null then raise insufficient_privilege; end if;
 if p_as_leader then
  perform 1 from public.participant_group_assignments where registration_id=r.id and is_current order by id for update;
  if not app.can_manage_group_panel_registration(r.event_id,r.id,auth.uid()) then raise insufficient_privilege; end if;
 elsif not app.owns_registration(r.id) then raise insufficient_privilege; end if;
 perform app.require_panel_bookings_open(r.event_id);
 if p_intent is null or p_intent not in ('book','cancel','join','leave','accept') then raise invalid_parameter_value; end if;
 if p_panel_id is null and p_as_leader then
  select panel_id into p_panel_id from public.panel_seat_sections where id=p_section_id and event_id=r.event_id;
 end if;
 if not exists(select 1 from public.panel_seat_sections s join public.event_moments p on p.id=s.panel_id
  where s.id=p_section_id and s.panel_id=p_panel_id and p.event_id=r.event_id and p.moment_type='panel') then
  raise invalid_parameter_value using message='panel is not available';
 end if;
 -- Lock all affected sections before changing the requested party, matching queue acceptance.
 perform 1 from public.event_moments where id=p_panel_id or id in (
  select moment_id from public.moment_attendance_choices where registration_id=r.id and choice='yes') order by id for update;
 perform 1 from public.panel_seat_sections where id=p_section_id or id in (
  select seat_section_id from public.moment_attendance_choices where registration_id=r.id and choice='yes') or id in (
  select section_id from public.panel_waitlist where registration_id=r.id and panel_id=p_panel_id and status in ('waiting','offered')) order by id for update;
 if p_intent in ('book','join') then
  if p_child_ids is null or cardinality(p_child_ids)>10 or array_position(p_child_ids,null) is not null
   or cardinality(p_child_ids)<>(select count(distinct x) from unnest(p_child_ids) x)
   or exists(select 1 from unnest(p_child_ids) x where not exists(select 1 from public.registration_children c where c.id=x and c.registration_id=r.id)) then
   raise invalid_parameter_value using message='invalid child selection';
  end if;
  existing_ids:=app.panel_child_ids(r.id,p_panel_id);
  active:=exists(select 1 from public.moment_attendance_choices where registration_id=r.id and moment_id=p_panel_id and choice='yes')
   or exists(select 1 from public.panel_waitlist where registration_id=r.id and panel_id=p_panel_id and status in ('waiting','offered'));
  if active and not(existing_ids @> p_child_ids and existing_ids <@ p_child_ids) then
   raise invalid_parameter_value using message='cancel existing booking or leave queue before changing children';
  end if;
  insert into public.panel_child_selections values(r.id,p_panel_id,p_child_ids)
   on conflict(registration_id,panel_id) do update set child_ids=excluded.child_ids;
 end if;
 if p_intent in ('join','leave','accept') then
  result:=app.set_panel_waitlist(r.id,p_panel_id,p_section_id,p_intent,p_as_leader,p_locale);
 elsif p_as_leader then
  result:=public.set_group_panel_booking(r.event_id,p_section_id,r.id,p_intent='book');
 else
  result:=public.set_individual_panel_booking(r.id,p_panel_id,p_section_id,p_intent='book');
 end if;
 if p_intent in ('cancel','leave') and not exists(select 1 from public.moment_attendance_choices where registration_id=r.id and moment_id=p_panel_id and choice='yes')
  and not exists(select 1 from public.panel_waitlist where registration_id=r.id and panel_id=p_panel_id and status in ('waiting','offered')) then
  delete from public.panel_child_selections where registration_id=r.id and panel_id=p_panel_id;
 end if;
 return result;
end;
$$;
revoke all on function public.set_panel_family_booking(uuid,uuid,uuid,text,uuid[],boolean,text) from public,anon;
grant execute on function public.set_panel_family_booking(uuid,uuid,uuid,text,uuid[],boolean,text) to authenticated;


-- Trusted/direct writers still cannot bypass child ownership, holds or capacity.
create function app.validate_panel_child_selection() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid; pid uuid; sid uuid;
begin
 rid:=case when tg_op='DELETE' then old.registration_id else new.registration_id end;
 pid:=case when tg_op='DELETE' then old.panel_id else new.panel_id end;
 perform 1 from public.registrations where id=rid for update;
 if not found then return null; end if;
 if tg_op<>'DELETE' then
  if not exists(select 1 from public.event_moments p join public.registrations r on r.event_id=p.event_id
   where r.id=rid and p.id=pid and p.moment_type='panel') or array_position(new.child_ids,null) is not null
   or cardinality(new.child_ids)<>(select count(distinct x) from unnest(new.child_ids) x)
   or exists(select 1 from unnest(new.child_ids) x where not exists(select 1 from public.registration_children c where c.id=x and c.registration_id=rid)) then
   raise check_violation using message='invalid Forum child scope';
  end if;
 end if;
 for sid in select seat_section_id from public.moment_attendance_choices where registration_id=rid and moment_id=pid and choice='yes'
 union select section_id from public.panel_waitlist where registration_id=rid and panel_id=pid and status in ('waiting','offered') order by 1 loop
  perform app.validate_panel_section_booking_capacity(sid);
 end loop;
 if exists(select 1 from public.panel_waitlist w where w.registration_id=rid and w.panel_id=pid and w.status='offered'
  and w.expires_at>clock_timestamp() and w.reserved_seats<>app.registration_panel_party_size(rid,pid)) then
  raise invalid_parameter_value using message='cancel the reserved forum offer before changing selected children';
 end if;
 return null;
end;
$$;
revoke all on function app.validate_panel_child_selection() from public,anon,authenticated;
create constraint trigger panel_child_selection_valid after insert or update or delete on public.panel_child_selections
 deferrable initially deferred for each row execute function app.validate_panel_child_selection();
