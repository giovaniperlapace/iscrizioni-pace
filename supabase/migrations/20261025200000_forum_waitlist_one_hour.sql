-- New offers last one hour, renewed at notification claim.
-- Existing notified offers retain the deadline already communicated.
-- CREATE OR REPLACE preserves function ownership and privileges.
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
      offered_at=clock_timestamp(), expires_at=clock_timestamp()+interval '1 hour', notification_status='pending'
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
    notification_started_at=clock_timestamp(),offered_at=clock_timestamp(),expires_at=clock_timestamp()+interval '1 hour'
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
