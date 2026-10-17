-- Group leaders use the same FIFO and reservations as participants.
-- Additive metadata only; existing entries and the public release gate are unchanged.
alter table public.panel_waitlist
  add column notification_kind text not null default 'participant' check (notification_kind in ('participant','leader')),
  add column notification_locale text check (notification_locale in ('it','en','fr','de','es','nl','uk'));
create or replace function app.leader_panel_group_scope_for_user(p_event_id uuid,p_user_id uuid)
returns setof uuid language sql stable security definer
set search_path = public, pg_temp as $$
  with recursive scope as (
    select g.id from public.groups g
    join public.group_memberships m on m.group_id = g.id
    where m.user_id = p_user_id and m.role = 'capogruppo'
      and g.event_id = p_event_id and g.is_active
      and exists (select 1 from public.events e where e.id = p_event_id and e.is_current)
      and (exists(select 1 from public.event_user_roles where user_id=p_user_id and role='admin' and event_id is null) or not exists (
        select 1 from public.event_user_roles r where r.user_id = p_user_id
          and r.role in ('manager', 'manager_viewer')
      ))
    union
    select g.id from public.groups g join scope s on g.parent_group_id = s.id
    where g.event_id = p_event_id and g.is_active
  ) select id from scope;
$$;

create or replace function app.leader_panel_group_scope(p_event_id uuid)
returns setof uuid language sql stable security definer set search_path=public,pg_temp as $$
  select * from app.leader_panel_group_scope_for_user(p_event_id,auth.uid());
$$;
create or replace function app.can_manage_group_panel_registration(p_event_id uuid,p_registration_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select p_user_id is not null and exists (
    select 1 from public.registrations r join public.participant_group_assignments a on a.registration_id=r.id
    where r.id=p_registration_id and r.event_id=p_event_id and r.status in ('submitted','confirmed') and r.deleted_at is null
      and a.is_current and a.status='confirmed'
      and a.group_id in (select app.leader_panel_group_scope_for_user(p_event_id,p_user_id)));
$$;
create or replace function app.panel_waitlist_recipient_valid(w public.panel_waitlist)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.registrations r join public.participants p on p.id=r.participant_id
    join auth.users u on u.id=w.notification_user_id
    where r.id=w.registration_id and r.event_id=w.event_id and r.status in ('submitted','confirmed')
      and r.deleted_at is null and u.email is not null and (
        (w.notification_kind='participant' and p.auth_user_id=w.notification_user_id) or
        (w.notification_kind='leader' and app.can_manage_group_panel_registration(w.event_id,w.registration_id,w.notification_user_id))));
$$;
create or replace function app.ensure_panel_waitlist_scope()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists(select 1 from public.registrations r join public.participants p on p.id=r.participant_id
    join public.panel_seat_sections sec on sec.id=new.section_id join public.panel_audience_types a on a.id=sec.audience_type_id
    where r.id=new.registration_id and r.event_id=new.event_id and ((new.notification_kind='participant' and p.auth_user_id=new.notification_user_id)
        or (new.notification_kind='leader' and app.can_manage_group_panel_registration(new.event_id,new.registration_id,new.notification_user_id)))
      and sec.event_id=new.event_id and sec.panel_id=new.panel_id and a.booking_channel='individual') then
    raise exception 'panel waitlist scope mismatch' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger panel_waitlist_scope on public.panel_waitlist;
create trigger panel_waitlist_scope before insert or update of event_id,registration_id,panel_id,section_id,notification_user_id,notification_kind
  on public.panel_waitlist for each row execute function app.ensure_panel_waitlist_scope();
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
    v_seats := app.registration_panel_party_size(w.registration_id);
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
    if app.panel_section_occupancy(p_section_id)+app.registration_panel_party_size(r.id)<=(select capacity from public.panel_seat_sections where id=p_section_id)
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
  if w.reserved_seats<>app.registration_panel_party_size(r.id) then raise exception 'reserved family size changed' using errcode='22023'; end if;
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

create or replace function public.set_individual_panel_waitlist(p_registration_id uuid,p_panel_id uuid,p_section_id uuid,p_intent text)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
  select app.set_panel_waitlist(p_registration_id,p_panel_id,p_section_id,p_intent,false,null);
$$;
create or replace function public.set_group_panel_waitlist(p_event_id uuid,p_section_id uuid,p_registration_id uuid,p_intent text,p_locale text default 'en')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_panel_id uuid;
begin
  if not app.can_manage_group_panel_registration(p_event_id,p_registration_id,auth.uid()) then
    raise exception 'registration outside leader scope or inactive' using errcode='42501';
  end if;
  select panel_id into v_panel_id from public.panel_seat_sections where id=p_section_id and event_id=p_event_id;
  if v_panel_id is null then raise exception 'panel not found' using errcode='22023'; end if;
  return app.set_panel_waitlist(p_registration_id,v_panel_id,p_section_id,p_intent,true,p_locale);
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
  select sum(app.registration_panel_party_size(id)) into v_needed from unnest(v_ids) id;
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
        'party_size', app.registration_panel_party_size(v_id)));
    v_changed := v_changed + 1;
  end loop;
  return jsonb_build_object('count', v_changed, 'seats', v_needed);
end;
$$;
create or replace function public.claim_panel_waitlist_notification()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare sid uuid; w public.panel_waitlist%rowtype; claim uuid; result jsonb; due timestamptz;
begin
  select next_run_at into due from public.panel_waitlist_scheduler where id=true for update;
  if due <= clock_timestamp() then
    for sid in select distinct section_id from public.panel_waitlist where status in ('waiting','offered') order by section_id loop
      perform app.advance_panel_waitlist(sid,true);
    end loop;
    update public.panel_waitlist_scheduler set next_run_at=clock_timestamp()+interval '5 minutes' where id=true;
  end if;
  select section_id into sid from public.panel_waitlist
    where status='offered' and notification_status='pending' and expires_at>clock_timestamp() order by sequence limit 1;
  if sid is null then return null; end if;
  perform app.advance_panel_waitlist(sid);
  select q.* into w from public.panel_waitlist q
    where q.section_id=sid and q.status='offered' and q.notification_status='pending' and q.expires_at>clock_timestamp()
    order by q.sequence limit 1 for update skip locked;
  if not found then return null; end if;
  claim:=extensions.gen_random_uuid();
  update public.panel_waitlist set notification_status='sending',notification_claim=claim,
    notification_started_at=clock_timestamp(),offered_at=clock_timestamp(),expires_at=clock_timestamp()+interval '30 minutes'
    where id=w.id returning * into w;
  select jsonb_build_object('id',w.id,'claim',claim,'eventId',w.event_id,'registrationId',w.registration_id,
    'panelId',w.panel_id,'sectionId',w.section_id,'notificationKind',w.notification_kind,'title',m.title,'startsAt',m.starts_at,'endsAt',m.ends_at,'location',l.name,
    'expiresAt',w.expires_at,'seats',w.reserved_seats,'email',u.email,'locale',case when w.notification_kind='leader' then coalesce(w.notification_locale,'en') else p.preferred_locale end,'name',concat_ws(' ',p.first_name,p.last_name)) into result
    from public.registrations r join public.participants p on p.id=r.participant_id
    join auth.users u on u.id=w.notification_user_id
    join public.event_moments m on m.id=w.panel_id join public.event_locations l on l.id=m.location_id
    where r.id=w.registration_id;
  return result;
end;
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
    'seats', app.registration_panel_party_size(r.id),
    'waitlistSectionId', w.section_id,
    'waitlistAudience', (select a.name from public.panel_seat_sections s join public.panel_audience_types a on a.id=s.audience_type_id where s.id=w.section_id),
    'queuePosition', case when w.status='waiting' then (select count(*) from public.panel_waitlist q where q.section_id=w.section_id and q.status='waiting' and q.sequence<=w.sequence) end,
    'offerExpiresAt', case when w.status='offered' and w.expires_at>statement_timestamp() then w.expires_at end,
    'status', case
      when exists (select 1 from public.moment_attendance_choices c
        where c.registration_id = r.id and c.moment_id = v_panel.id and c.choice = 'yes') then 'selected'
      when w.status='offered' and w.expires_at>statement_timestamp() then 'offered'
      when w.status='waiting' then 'queued'
      when app.registration_panel_party_size(r.id) > v_remaining or exists(select 1 from public.panel_waitlist where section_id=p_section_id and status='waiting') then 'full'
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

revoke all on function app.leader_panel_group_scope_for_user(uuid,uuid),app.leader_panel_group_scope(uuid),
  app.can_manage_group_panel_registration(uuid,uuid,uuid),app.panel_waitlist_recipient_valid(public.panel_waitlist),
  app.set_panel_waitlist(uuid,uuid,uuid,text,boolean,text) from public,anon,authenticated;
revoke all on function public.set_group_panel_waitlist(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.set_group_panel_waitlist(uuid,uuid,uuid,text,text) to authenticated;
