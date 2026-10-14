-- FIFO waiting list for individual Forum bookings, with atomic 30-minute offers.
-- Public opening is unchanged. No existing booking is cancelled by this migration.
create or replace function app.panel_slot_key(p_start timestamptz)
returns text language sql immutable strict set search_path = pg_catalog as $$
  select to_char(p_start at time zone 'Europe/Rome', 'YYYY-MM-DD') ||
    case when (p_start at time zone 'Europe/Rome')::time < time '12:00' then ':morning' else ':afternoon' end;
$$;
create or replace function app.panel_slots_conflict(a_start timestamptz, a_end timestamptz, b_start timestamptz, b_end timestamptz)
returns boolean language sql immutable strict set search_path = pg_catalog as $$
  select app.panel_slot_key(a_start) = app.panel_slot_key(b_start)
    or tstzrange(a_start, a_end, '[)') && tstzrange(b_start, b_end, '[)');
$$;

create table public.panel_waitlist (
  id uuid primary key default extensions.gen_random_uuid(),
  sequence bigint generated always as identity unique,
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  panel_id uuid not null references public.event_moments(id) on delete restrict,
  section_id uuid not null references public.panel_seat_sections(id) on delete restrict,
  notification_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','offered','accepted','expired','cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  offered_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz,
  reserved_seats integer check (reserved_seats > 0),
  notification_status text check (notification_status in ('pending','sending','sent','failed','unknown')),
  notification_claim uuid,
  notification_started_at timestamptz,
  notification_message_id text,
  check (status <> 'offered' or (offered_at is not null and expires_at is not null and reserved_seats is not null and notification_status is not null))
);
create or replace function app.ensure_panel_waitlist_scope()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists(select 1 from public.registrations r join public.participants p on p.id=r.participant_id
    join public.panel_seat_sections sec on sec.id=new.section_id join public.panel_audience_types a on a.id=sec.audience_type_id
    where r.id=new.registration_id and r.event_id=new.event_id and p.auth_user_id=new.notification_user_id
      and sec.event_id=new.event_id and sec.panel_id=new.panel_id and a.booking_channel='individual') then
    raise exception 'panel waitlist scope mismatch' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger panel_waitlist_scope before insert or update of event_id,registration_id,panel_id,section_id,notification_user_id
  on public.panel_waitlist for each row execute function app.ensure_panel_waitlist_scope();
revoke all on function app.ensure_panel_waitlist_scope() from public,anon,authenticated;
create unique index panel_waitlist_one_active on public.panel_waitlist(registration_id,panel_id)
  where status in ('waiting','offered');
create index panel_waitlist_fifo on public.panel_waitlist(section_id,sequence) where status in ('waiting','offered');
alter table public.panel_waitlist enable row level security;
-- Participant data is available only through the scoped catalog RPC, never this table.
revoke all on public.panel_waitlist from public, anon, authenticated;
revoke all on sequence public.panel_waitlist_sequence_seq from public, anon, authenticated;
grant all on public.panel_waitlist to service_role;
grant usage, select on sequence public.panel_waitlist_sequence_seq to service_role;

-- The FIFO head is protected even for operational direct writes to canonical choices.
create or replace function app.protect_panel_waitlist_priority()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.choice<>'yes' or new.seat_section_id is null then return new; end if;
  if tg_op='UPDATE' and old.choice='yes' and old.seat_section_id=new.seat_section_id then return new; end if;
  perform 1 from public.panel_seat_sections where id=new.seat_section_id for update;
  if exists(select 1 from public.panel_waitlist where section_id=new.seat_section_id and status='waiting')
    and not exists(select 1 from public.panel_waitlist where registration_id=new.registration_id
      and panel_id=new.moment_id and section_id=new.seat_section_id and status='accepted'
      and accepted_at>=statement_timestamp()) then
    raise exception 'panel section is full; waiting list has priority' using errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger forum_queue_protect_priority before insert or update on public.moment_attendance_choices
  for each row execute function app.protect_panel_waitlist_priority();
revoke all on function app.protect_panel_waitlist_priority() from public,anon,authenticated;

create or replace function app.panel_section_booked_seats(p_section_id uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select (coalesce((select sum(app.registration_panel_party_size(c.registration_id))
    from public.moment_attendance_choices c join public.registrations r on r.id=c.registration_id
    where c.seat_section_id=p_section_id and c.choice='yes' and r.status in ('submitted','confirmed') and r.deleted_at is null),0)
    + app.school_panel_section_occupancy(p_section_id))::integer;
$$;
create or replace function app.panel_section_occupancy(target_section_id uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select app.panel_section_booked_seats(target_section_id) + coalesce((
    select sum(w.reserved_seats) from public.panel_waitlist w join public.registrations r on r.id=w.registration_id
    where w.section_id=target_section_id and w.status='offered' and w.expires_at > statement_timestamp()
      and r.status in ('submitted','confirmed') and r.deleted_at is null),0)::integer;
$$;

-- Section locks serialize all allocation, booking, claim and expiry decisions.
-- Workers never lock registrations, preserving registration -> panel -> section order.
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
    where q.section_id=p_section_id and q.status in ('waiting','offered') and not exists (
      select 1 from public.registrations r join public.participants p on p.id=r.participant_id
      join auth.users u on u.id=q.notification_user_id
      where r.id=q.registration_id and r.event_id=q.event_id and r.status in ('submitted','confirmed')
        and r.deleted_at is null and p.auth_user_id=q.notification_user_id and u.email is not null);
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

create or replace function app.refill_panel_waitlists_after_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare sid uuid; before_row jsonb; after_row jsonb;
begin
  if tg_op<>'INSERT' then before_row:=to_jsonb(old); end if;
  if tg_op<>'DELETE' then after_row:=to_jsonb(new); end if;
  -- Limit refill to affected sections. Unrelated Forums never take each other's locks.
  for sid in select distinct q.section_id from public.panel_waitlist q
    where q.status in ('waiting','offered') and (
      (tg_table_name='moment_attendance_choices' and q.section_id in (
        (before_row->>'seat_section_id')::uuid,(after_row->>'seat_section_id')::uuid))
      or (tg_table_name='panel_seat_sections' and q.section_id=(after_row->>'id')::uuid)
      or (tg_table_name='registrations' and q.registration_id=(after_row->>'id')::uuid)
      or (tg_table_name='registration_children' and q.registration_id in (
        (before_row->>'registration_id')::uuid,(after_row->>'registration_id')::uuid))
      or (tg_table_name='event_moments' and q.panel_id=(after_row->>'id')::uuid)
      or (tg_table_name='events' and q.event_id=(after_row->>'id')::uuid)
      or (tg_table_name='event_locations' and exists(select 1 from public.event_moments m where m.id=q.panel_id and m.location_id=(after_row->>'id')::uuid))
      or (tg_table_name='panel_audience_types' and exists(select 1 from public.panel_seat_sections sec where sec.id=q.section_id and sec.audience_type_id=(after_row->>'id')::uuid))
    ) order by q.section_id loop
    perform app.advance_panel_waitlist(sid);
  end loop;
  return null;
end;
$$;
create constraint trigger forum_queue_choices_changed after insert or update or delete on public.moment_attendance_choices
  deferrable initially deferred for each row execute function app.refill_panel_waitlists_after_change();
create constraint trigger forum_queue_capacity_changed after update of capacity on public.panel_seat_sections
  deferrable initially deferred for each row execute function app.refill_panel_waitlists_after_change();
create constraint trigger forum_queue_registration_changed after update of status,deleted_at on public.registrations
  deferrable initially deferred for each row execute function app.refill_panel_waitlists_after_change();
create constraint trigger forum_queue_children_changed after insert or update or delete on public.registration_children
  deferrable initially deferred for each row execute function app.refill_panel_waitlists_after_change();
create constraint trigger forum_queue_publication_changed after update of publication_status,is_public,starts_at,ends_at,location_id on public.event_moments
  deferrable initially deferred for each row execute function app.refill_panel_waitlists_after_change();
create constraint trigger forum_queue_opening_changed after update of panel_access_mode,is_current,status on public.events
  deferrable initially deferred for each row execute function app.refill_panel_waitlists_after_change();

create constraint trigger forum_queue_location_changed after update of is_active on public.event_locations
  deferrable initially deferred for each row execute function app.refill_panel_waitlists_after_change();
create constraint trigger forum_queue_audience_changed after update of is_active on public.panel_audience_types
  deferrable initially deferred for each row execute function app.refill_panel_waitlists_after_change();

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
      and expires_at>clock_timestamp() and reserved_seats<>app.registration_panel_party_size(rid)) then
      raise exception 'cancel the reserved forum offer before changing family size' using errcode='22023';
    end if;
  end loop;
  return null;
end;
$$;
create constraint trigger forum_queue_family_size after insert or update or delete on public.registration_children
  deferrable initially deferred for each row execute function app.protect_offered_family_size();

create or replace function app.validate_registration_panel_overlaps(target_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists(select 1 from public.registrations where id=target_registration_id and status in ('submitted','confirmed') and deleted_at is null) then return; end if;
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
      and app.panel_slots_conflict(first_panel.starts_at, first_panel.ends_at, second_panel.starts_at, second_panel.ends_at)
  ) then
    raise exception 'panel booking overlaps another selected panel' using errcode = '23P01';
  end if;
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

  v_party_size := app.registration_panel_party_size(p_registration_id);
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

create or replace function public.set_individual_panel_booking(p_registration_id uuid,p_panel_id uuid,p_section_id uuid,p_booked boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  perform app.require_panel_bookings_open((select event_id from public.registrations where id=p_registration_id));
  if not app.owns_registration(p_registration_id) then raise exception 'registration not found for this participant' using errcode='42501'; end if;
  perform 1 from public.registrations where id=p_registration_id for update;
  perform 1 from public.event_moments where id=p_panel_id for update;
  perform 1 from public.panel_seat_sections where id=p_section_id or id in (
    select seat_section_id from public.moment_attendance_choices where registration_id=p_registration_id and moment_id=p_panel_id and choice='yes') order by id for update;
  perform app.advance_panel_waitlist(p_section_id);
  if p_booked and not exists(select 1 from public.moment_attendance_choices where registration_id=p_registration_id and moment_id=p_panel_id and choice='yes')
    and exists(select 1 from public.panel_waitlist where section_id=p_section_id and status='waiting') then
    raise exception 'panel section is full; waiting list has priority' using errcode='P0001';
  end if;
  result:=app.set_individual_panel_booking_base(p_registration_id,p_panel_id,p_section_id,p_booked);
  return result;
end;
$$;

create or replace function public.set_individual_panel_waitlist(p_registration_id uuid,p_panel_id uuid,p_section_id uuid,p_intent text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.registrations%rowtype; w public.panel_waitlist%rowtype; result jsonb; replaced uuid[];
begin
  if not app.owns_registration(p_registration_id) then raise exception 'registration not found for this participant' using errcode='42501'; end if;
  select * into r from public.registrations where id=p_registration_id for update;
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
    insert into public.panel_waitlist(event_id,registration_id,panel_id,section_id,notification_user_id)
      values(r.event_id,r.id,p_panel_id,p_section_id,auth.uid()) returning * into w;
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
  result:=app.set_individual_panel_booking_base(r.id,p_panel_id,p_section_id,true);
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
    values(r.event_id,auth.uid(),'panel.waitlist_accepted','panel_waitlist',w.id,jsonb_build_object('panel_id',p_panel_id,'replaced_panel_ids',coalesce(to_jsonb(replaced),'[]'::jsonb)));
  return jsonb_build_object('status','booked');
end;
$$;

-- Reuse the existing minute scheduler, with a durable five-minute allocation cadence.
create table public.panel_waitlist_scheduler (
  id boolean primary key default true check (id), next_run_at timestamptz not null default clock_timestamp()
);
insert into public.panel_waitlist_scheduler(id) values(true);
alter table public.panel_waitlist_scheduler enable row level security;
revoke all on public.panel_waitlist_scheduler from public,anon,authenticated;
grant all on public.panel_waitlist_scheduler to service_role;

-- A durable send claim is committed before contacting Postmark. Never reclaim sending/unknown.
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
    'panelId',w.panel_id,'title',m.title,'startsAt',m.starts_at,'endsAt',m.ends_at,'location',l.name,
    'expiresAt',w.expires_at,'seats',w.reserved_seats,'email',u.email,'locale',p.preferred_locale,'name',concat_ws(' ',p.first_name,p.last_name)) into result
    from public.registrations r join public.participants p on p.id=r.participant_id
    join auth.users u on u.id=w.notification_user_id
    join public.event_moments m on m.id=w.panel_id join public.event_locations l on l.id=m.location_id
    where r.id=w.registration_id;
  return result;
end;
$$;
create or replace function public.finish_panel_waitlist_notification(p_id uuid,p_claim uuid,p_outcome text,p_message_id text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_outcome not in ('sent','failed','unknown') or p_outcome is null then raise exception 'invalid notification outcome'; end if;
  update public.panel_waitlist set notification_status=p_outcome,notification_message_id=p_message_id
    where id=p_id and notification_claim=p_claim and notification_status='sending';
  if found then
    insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
      select event_id,null,'panel.waitlist_notification_'||p_outcome,'panel_waitlist',id,jsonb_build_object('notification_claim',p_claim)
      from public.panel_waitlist where id=p_id;
  end if;
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
  queue_position bigint
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
      when app.panel_section_occupancy(section.id)+app.registration_panel_party_size(registration.id)>section.capacity
        or exists(select 1 from public.panel_waitlist q where q.section_id=section.id and q.status='waiting') then 'full'
      when exists (
        select 1
        from selected other_choice
        join public.event_moments other_panel on other_panel.id = other_choice.moment_id
        where other_choice.moment_id <> panel.id
          and app.panel_slots_conflict(other_panel.starts_at, other_panel.ends_at, panel.starts_at, panel.ends_at)
      ) then 'conflict'
      when app.panel_section_occupancy(section.id)
        + app.registration_panel_party_size(registration.id) > section.capacity then 'full'
      else 'available'
    end,
    app.registration_panel_party_size(registration.id),
    case when w.status='offered' and w.expires_at<=statement_timestamp() then 'expired' else w.status end,
    case when w.status='offered' and w.expires_at>statement_timestamp() then w.expires_at end,
    case when w.status='waiting' then (select count(*) from public.panel_waitlist q where q.section_id=section.id and q.status='waiting' and q.sequence<=w.sequence) end
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
          and app.panel_slots_conflict(other.starts_at, other.ends_at, v_panel.starts_at, v_panel.ends_at)) then 'conflict'
      when app.registration_panel_party_size(r.id) > v_remaining or exists(select 1 from public.panel_waitlist where section_id=p_section_id and status='waiting') then 'full'
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
      and app.panel_slots_conflict(p.starts_at, p.ends_at, v_panel.starts_at, v_panel.ends_at)
  ) then raise exception 'panel overlap' using errcode = '23P01'; end if;
  select sum(app.registration_panel_party_size(id)) into v_needed from unnest(v_ids) id;
  perform app.advance_panel_waitlist(p_section_id);
  if exists(select 1 from public.panel_waitlist where section_id=p_section_id and status='waiting')
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

revoke all on function app.panel_slot_key(timestamptz),app.panel_slots_conflict(timestamptz,timestamptz,timestamptz,timestamptz),
  app.panel_section_booked_seats(uuid),app.advance_panel_waitlist(uuid,boolean),app.refill_panel_waitlists_after_change(),
  app.protect_offered_family_size(),app.set_individual_panel_booking_base(uuid,uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.set_individual_panel_waitlist(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.set_individual_panel_waitlist(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.get_participant_panel_catalog(uuid) from public,anon;
grant execute on function public.get_participant_panel_catalog(uuid) to authenticated;
revoke all on function public.claim_panel_waitlist_notification(),public.finish_panel_waitlist_notification(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_panel_waitlist_notification(),public.finish_panel_waitlist_notification(uuid,uuid,text,text) to service_role;

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
      bool_or(app.panel_section_occupancy(section.id) < section.capacity and not exists(select 1 from public.panel_waitlist q where q.section_id=section.id and q.status='waiting')) as has_space
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

do $$ declare rid uuid; begin
  for rid in select distinct registration_id from public.moment_attendance_choices c
    join public.registrations r on r.id=c.registration_id
    where c.choice='yes' and c.seat_section_id is not null and r.status in ('submitted','confirmed') and r.deleted_at is null loop
    perform app.validate_registration_panel_overlaps(rid);
  end loop;
end $$;
