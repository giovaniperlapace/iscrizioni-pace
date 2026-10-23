-- Linked Italian-only relay rooms. No activation or invitations during schema rollout.
create table public.panel_relay_rooms (
 panel_id uuid primary key references public.event_moments(id),
 source_panel_id uuid not null unique references public.event_moments(id),
 phase text not null default 'staged' check (phase in ('staged','priority','open')),
 activated_at timestamptz,
 check(panel_id<>source_panel_id)
);
alter table public.panel_relay_rooms enable row level security;
revoke all on public.panel_relay_rooms from public,anon,authenticated;
grant all on public.panel_relay_rooms to service_role;
alter table public.panel_waitlist add column source_waitlist_id uuid unique references public.panel_waitlist(id);

-- Residence is the participant's current usual-residence field, never nationality,
-- UI language, group geography or the leader's country. Missing values are excluded.
create function app.relay_resident_in_italy(p_registration_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.registrations r
  join public.participants p on p.id=r.participant_id
  left join public.countries c on c.id=p.country_id
  where r.id=p_registration_id and case
   when nullif(btrim(p.country_other),'') is not null
    then lower(btrim(p.country_other)) in ('it','ita','italia','italy')
   else upper(c.iso2)='IT' end);
$$;
revoke all on function app.relay_resident_in_italy(uuid) from public,anon,authenticated;

create function app.relay_priority(p_panel_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.panel_relay_rooms where panel_id=p_panel_id and phase<>'open');
$$;
revoke all on function app.relay_priority(uuid) from public,anon,authenticated;

-- Protect every booking path, including operational writers, while priority is active.
create function app.guard_relay_booking() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.choice<>'yes' or new.seat_section_id is null then return new; end if;
 if tg_op='UPDATE' and old.choice='yes' and old.seat_section_id=new.seat_section_id then return new; end if;
 if app.relay_priority(new.moment_id) and not exists (
  select 1 from public.panel_waitlist q where q.registration_id=new.registration_id
  and q.panel_id=new.moment_id and q.section_id=new.seat_section_id and q.source_waitlist_id is not null
  and q.status='accepted' and q.accepted_at>=statement_timestamp()
 ) then raise exception 'relay room reserved for waiting list offers' using errcode='22023'; end if;
 return new;
end;
$$;
revoke all on function app.guard_relay_booking() from public,anon,authenticated;
create trigger forum_relay_priority before insert or update on public.moment_attendance_choices
 for each row execute function app.guard_relay_booking();

create function app.guard_relay_waitlist() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='waiting' and exists(select 1 from public.panel_relay_rooms where panel_id=new.panel_id)
  and not app.relay_resident_in_italy(new.registration_id) then
  raise exception 'relay waiting-list offers require residence in Italy' using errcode='22023';
 end if;
 if new.source_waitlist_id is not null and not exists (
  select 1 from public.panel_waitlist src join public.panel_relay_rooms relay on relay.source_panel_id=src.panel_id
  join public.event_moments target on target.id=relay.panel_id
  where src.id=new.source_waitlist_id and relay.panel_id=new.panel_id and src.event_id=new.event_id
   and target.event_id=new.event_id and src.registration_id=new.registration_id
   and src.notification_user_id=new.notification_user_id and src.notification_kind=new.notification_kind
 ) then raise check_violation using message='invalid relay invitation source'; end if;
 if tg_op='INSERT' and app.relay_priority(new.panel_id) and new.source_waitlist_id is null then
  raise exception 'relay room reserved for waiting list offers' using errcode='22023';
 end if;
 return new;
end;
$$;
revoke all on function app.guard_relay_waitlist() from public,anon,authenticated;
create trigger forum_relay_waitlist before insert or update of source_waitlist_id,registration_id,panel_id,notification_user_id,notification_kind,event_id
 on public.panel_waitlist for each row execute function app.guard_relay_waitlist();

-- Snapshot invitations are not a new attendance declaration. The acceptance guard
-- still requires current declared attendance, and checks it again for every booking.
create or replace function app.guard_forum_attendance() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='moment_attendance_choices' then
  if new.choice<>'yes' then return new; end if;
  if tg_op='UPDATE' and old.choice='yes' and old.registration_id=new.registration_id
    and old.moment_id=new.moment_id and old.seat_section_id is not distinct from new.seat_section_id then return new; end if;
  -- INSERT ... ON CONFLICT retries of an existing reservation are harmless.
  if tg_op='INSERT' and exists(select 1 from public.moment_attendance_choices c
   where c.registration_id=new.registration_id and c.moment_id=new.moment_id and c.choice='yes'
   and c.seat_section_id is not distinct from new.seat_section_id) then return new; end if;
  perform app.require_forum_attendance(new.registration_id,new.moment_id);
 else
  if new.status<>'waiting' or new.source_waitlist_id is not null then return new; end if;
  if tg_op='UPDATE' and old.status='waiting' and old.registration_id=new.registration_id
   and old.panel_id=new.panel_id then return new; end if;
  perform app.require_forum_attendance(new.registration_id,new.panel_id);
 end if;
 return new;
end;
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
  -- Recheck current residence before promotion AND notification claim. Cancel only
  -- relay requests; original queues, their order and reservations are untouched.
  update public.panel_waitlist q set status='cancelled'
   where q.section_id=p_section_id and q.status in ('waiting','offered')
    and exists(select 1 from public.panel_relay_rooms where panel_id=q.panel_id)
    and not app.relay_resident_in_italy(q.registration_id);
  -- Refresh only this room's offers; never rewrite its original queue.
  update public.panel_waitlist q set status='cancelled'
  where q.section_id=p_section_id and q.status in ('waiting','offered') and q.source_waitlist_id is not null
   and exists(select 1 from public.panel_waitlist src where src.id=q.source_waitlist_id and (
     src.status in ('cancelled','accepted') or exists(select 1 from public.moment_attendance_choices c
      where c.registration_id=q.registration_id and c.moment_id=src.panel_id and c.choice='yes')));
  if exists(select 1 from public.panel_relay_rooms r join public.panel_seat_sections s on s.panel_id=r.panel_id
    where s.id=p_section_id and r.phase='staged') then return 0; end if;
  update public.panel_relay_rooms r set phase='open' where r.phase='priority'
   and r.panel_id=(select panel_id from public.panel_seat_sections where id=p_section_id)
   and not exists(select 1 from public.panel_waitlist q where q.panel_id=r.panel_id and q.source_waitlist_id is not null and q.status in ('waiting','offered'));
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
    -- An existing main-room offer gets its full response window first.
    exit when w.source_waitlist_id is not null and exists(select 1 from public.panel_waitlist src
     where src.id=w.source_waitlist_id and src.status='offered' and src.expires_at>clock_timestamp());
    v_seats := app.registration_panel_party_size(w.registration_id,w.panel_id);
    -- Strict FIFO: an entire family must fit before considering the next entry.
    exit when v_seats > v_free;
    update public.panel_waitlist set status='offered', reserved_seats=v_seats,
      offered_at=clock_timestamp(), expires_at=clock_timestamp()+interval '2 hours', notification_status='pending'
      where id=w.id;
    insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
      values(w.event_id,null,'panel.waitlist_offered','panel_waitlist',w.id,jsonb_build_object('section_id',p_section_id,'seats',v_seats));
    v_free := v_free-v_seats; v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.claim_panel_waitlist_notification()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare sid uuid; w public.panel_waitlist%rowtype; claim uuid; result jsonb; due timestamptz;
begin
  select next_run_at into due from public.panel_waitlist_scheduler where id=true for update;
  if due <= clock_timestamp() then
    for sid in select section_id from public.panel_waitlist where status in ('waiting','offered') union select s.id from public.panel_seat_sections s join public.panel_relay_rooms r on r.panel_id=s.panel_id where r.phase='priority' order by 1 loop
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
    notification_started_at=clock_timestamp(),offered_at=clock_timestamp(),expires_at=clock_timestamp()+interval '2 hours'
    where id=w.id returning * into w;
  select jsonb_build_object('id',w.id,'claim',claim,'eventId',w.event_id,'registrationId',w.registration_id,
    'panelId',w.panel_id,'sectionId',w.section_id,'notificationKind',w.notification_kind,'title',m.title,'startsAt',m.starts_at,'endsAt',m.ends_at,'location',l.name,
    'expiresAt',w.expires_at,'seats',w.reserved_seats,'email',u.email,'locale',case when w.notification_kind='leader' then coalesce(w.notification_locale,'it') else p.preferred_locale end,'name',concat_ws(' ',p.first_name,p.last_name)) into result
    from public.registrations r join public.participants p on p.id=r.participant_id
    join auth.users u on u.id=w.notification_user_id
    join public.event_moments m on m.id=w.panel_id join public.event_locations l on l.id=m.location_id
    where r.id=w.registration_id;
  return result;
end;
$$;
-- The additional OUT column requires recreation; preserve owner, comment and ACL.
create temporary table relay_catalog_metadata on commit drop as
 select proowner,proacl,obj_description(oid,'pg_proc') as comment
 from pg_proc where oid='public.get_participant_panel_catalog(uuid)'::regprocedure;
drop function public.get_participant_panel_catalog(uuid);
create function public.get_participant_panel_catalog(p_registration_id uuid)
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
  children jsonb, remaining_seats integer, has_waiting boolean, has_slot_conflict boolean, replacement_titles text[]
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
      when app.relay_priority(panel.id) then 'priority'
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
      where other_choice.moment_id<>panel.id and app.panel_slots_conflict(other_panel.starts_at,other_panel.ends_at,panel.starts_at,panel.ends_at)),
    array(select other_panel.title||' · '||coalesce(other_location.name,'')
      from selected other_choice join public.event_moments other_panel on other_panel.id=other_choice.moment_id
      left join public.event_locations other_location on other_location.id=other_panel.location_id
      where other_choice.moment_id<>panel.id and app.panel_slots_conflict(other_panel.starts_at,other_panel.ends_at,panel.starts_at,panel.ends_at)
      order by other_panel.starts_at,other_panel.title)
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

do $$ declare saved record; privilege record; role_name text; begin
 select * into strict saved from relay_catalog_metadata;
 for privilege in select distinct grantee from pg_proc,
   lateral aclexplode(coalesce(proacl,acldefault('f',proowner)))
   where oid='public.get_participant_panel_catalog(uuid)'::regprocedure loop
  role_name:=case when privilege.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(privilege.grantee)) end;
  execute 'revoke all on function public.get_participant_panel_catalog(uuid) from '||role_name;
 end loop;
 execute format('alter function public.get_participant_panel_catalog(uuid) owner to %I',pg_get_userbyid(saved.proowner));
 for privilege in select * from aclexplode(coalesce(saved.proacl,acldefault('f',saved.proowner))) loop
  role_name:=case when privilege.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(privilege.grantee)) end;
  execute 'grant execute on function public.get_participant_panel_catalog(uuid) to '||role_name||case when privilege.is_grantable then ' with grant option' else '' end;
 end loop;
 execute format('comment on function public.get_participant_panel_catalog(uuid) is %L',saved.comment);
end $$;

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
    'relayPriority', app.relay_priority(p.id), 'remaining', greatest(0, s.capacity - app.panel_section_occupancy(s.id))
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
    'replacementTitles',array(select other.title||' · '||coalesce(other_location.name,'')
      from public.moment_attendance_choices c join public.event_moments other on other.id=c.moment_id
      left join public.event_locations other_location on other_location.id=other.location_id
      where c.registration_id=r.id and c.choice='yes' and c.seat_section_id is not null and c.moment_id<>v_panel.id
      and app.panel_slots_conflict(other.starts_at,other.ends_at,v_panel.starts_at,v_panel.ends_at) order by other.starts_at,other.title),
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
      when app.relay_priority(v_panel.id) then 'priority'
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
-- Add only aggregate bookable seats to the existing public catalogue.
-- Preserve the original RPC and its publication/access gates for old clients.
create or replace function public.get_public_panel_program_with_seats()
returns table (
  panel_id uuid, title text, description text, starts_at timestamptz,
  ends_at timestamptz, location_name text, location_address text,
  availability text, remaining_seats bigint
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select program.panel_id,program.title,program.description,program.starts_at,program.ends_at,
    program.location_name,program.location_address,
    case when app.relay_priority(program.panel_id) then 'priority' else program.availability end,
    case when app.relay_priority(program.panel_id) then 0 when program.availability = 'unavailable' then null
      else coalesce((
        select sum(case when exists (
          select 1 from public.panel_waitlist q
          where q.section_id = section.id and q.status = 'waiting'
        ) then 0 else greatest(0, section.capacity - app.panel_section_occupancy(section.id)) end)
        from public.panel_seat_sections section
        join public.panel_audience_types audience
          on audience.id = section.audience_type_id and audience.event_id = section.event_id
        where section.panel_id = program.panel_id
          and audience.booking_channel = 'individual' and audience.is_active
      ), 0)
    end
  from public.get_public_panel_program() program
  order by program.starts_at, program.title, program.panel_id;
$$;
revoke all on function public.get_public_panel_program_with_seats() from public;
grant execute on function public.get_public_panel_program_with_seats() to anon, authenticated;

-- Explicit service-only activation after the compatible application is deployed.
-- Snapshot the original FIFO once; retry cannot duplicate or restart invitations.
create function public.activate_panel_relay_rooms(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare relay record; src public.panel_waitlist%rowtype; sid uuid; added integer:=0; rooms integer:=0;
begin
 lock table public.registrations,public.participant_group_assignments,public.event_moments,
  public.panel_seat_sections,public.moment_attendance_choices,public.panel_waitlist,
  public.panel_child_selections in share row exclusive mode;
 if not exists(select 1 from public.events where id=p_event_id and is_current and status='published' and panel_access_mode='open') then
  raise exception 'event not open' using errcode='22023';
 end if;
 for relay in select r.* from public.panel_relay_rooms r join public.event_moments p on p.id=r.panel_id
  where p.event_id=p_event_id and r.phase='staged' order by r.panel_id for update of r loop
  if not exists(select 1 from public.event_moments a join public.event_moments b on b.id=relay.source_panel_id
   where a.id=relay.panel_id and a.event_id=b.event_id and a.starts_at=b.starts_at and a.ends_at=b.ends_at
    and a.starts_at>clock_timestamp() and a.publication_status='published' and b.publication_status='published'
    and a.is_public and b.is_public) then raise exception 'invalid relay programme'; end if;
  select s.id into strict sid from public.panel_seat_sections s join public.panel_audience_types a on a.id=s.audience_type_id
   where s.panel_id=relay.panel_id and a.booking_channel='individual' and a.is_active;
  for src in select q.* from public.panel_waitlist q where q.panel_id=relay.source_panel_id
    and q.status in ('waiting','offered') and app.panel_waitlist_recipient_valid(q)
    and app.relay_resident_in_italy(q.registration_id)
    and not exists(select 1 from public.moment_attendance_choices c where c.registration_id=q.registration_id
      and c.moment_id=q.panel_id and c.choice='yes') order by q.sequence loop
   insert into public.panel_child_selections(registration_id,panel_id,child_ids)
    values(src.registration_id,relay.panel_id,app.panel_child_ids(src.registration_id,src.panel_id));
   insert into public.panel_waitlist(event_id,registration_id,panel_id,section_id,notification_user_id,
    notification_kind,notification_locale,source_waitlist_id)
    values(src.event_id,src.registration_id,relay.panel_id,sid,src.notification_user_id,
      src.notification_kind,src.notification_locale,src.id);
   added:=added+1;
  end loop;
  update public.panel_relay_rooms set phase='priority',activated_at=clock_timestamp() where panel_id=relay.panel_id;
  perform app.advance_panel_waitlist(sid,false);
  rooms:=rooms+1;
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
   values(p_event_id,auth.uid(),'panel.relay_activated','event_moments',relay.panel_id,
    jsonb_build_object('source_panel_id',relay.source_panel_id,'language','it','invitations',
      (select count(*) from public.panel_waitlist where panel_id=relay.panel_id and source_waitlist_id is not null)));
 end loop;
 return jsonb_build_object('rooms',rooms,'invitations',added);
end;
$$;
revoke all on function public.activate_panel_relay_rooms(uuid) from public,anon,authenticated;
grant execute on function public.activate_panel_relay_rooms(uuid) to service_role;
notify pgrst,'reload schema';
