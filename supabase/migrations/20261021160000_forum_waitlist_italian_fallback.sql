-- Italian fallback for missing leader notification language; existing language choices are preserved.
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
