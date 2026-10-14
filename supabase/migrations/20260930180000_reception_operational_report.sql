-- P13: aggregate-only report. No new access to nominal check-ins or raw audit.
begin;
create function public.reception_operational_report(
  p_event_id uuid, p_day date default null, p_part text default 'all'
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.event_user_roles where user_id=auth.uid()
    and ((role='admin' and event_id is null)
      or (role in ('manager','manager_viewer') and event_id=p_event_id))
  ) then raise insufficient_privilege using message='Report forbidden'; end if;
  if p_part is null or p_part not in ('all','morning','afternoon') or (p_day is null and p_part<>'all') then
    raise invalid_parameter_value using message='Invalid report filter';
  end if;
  with registrations as materialized (
    select id from public.registrations where event_id=p_event_id
      and status in ('submitted','confirmed') and deleted_at is null and cancelled_at is null
  ), schools as materialized (
    select id,student_count,companion_count from public.school_bookings
      where event_id=p_event_id and status in ('submitted','confirmed')
  ), entries as materialized (
    select c.*,c.checked_in_at at time zone 'Europe/Rome' as local_time from public.check_ins c
    where c.event_id=p_event_id and c.moment_id is null and c.cancelled_at is null
      and (c.registration_id in (select id from registrations) or c.school_booking_id in (select id from schools))
  ), filtered as (
    select * from entries where p_day is null or (local_time::date=p_day and
      (p_part='all' or (p_part='morning' and local_time::time<time '12:00')
        or (p_part='afternoon' and local_time::time>=time '12:00')))
  ), expected_registrations as (
    select r.id from registrations r where p_day is null or exists (
      select 1 from public.event_attendance_choices a where a.registration_id=r.id and a.day=p_day
        and a.choice='yes' and (p_part='all' or a.day_part=p_part or a.day_part is null)
    )
  ), expected_schools as (
    -- A school can book multiple panels on the same day; count it once.
    select s.* from schools s where p_day is null or exists (
      select 1 from public.school_panel_reservations b join public.event_moments m on m.id=b.panel_id
      where b.booking_id=s.id and b.event_id=p_event_id and b.status='reserved'
        and (m.starts_at at time zone 'Europe/Rome')::date=p_day
        and (p_part='all' or (p_part='morning' and (m.starts_at at time zone 'Europe/Rome')::time<time '12:00')
          or (p_part='afternoon' and (m.starts_at at time zone 'Europe/Rome')::time>=time '12:00'))
    )
  ), operations as (
    select action,metadata from public.audit_logs where event_id=p_event_id
      and action in ('reception.enter','reception.correct','reception.cancel')
      and (p_day is null or ((created_at at time zone 'Europe/Rome')::date=p_day and
        (p_part='all' or (p_part='morning' and (created_at at time zone 'Europe/Rome')::time<time '12:00')
          or (p_part='afternoon' and (created_at at time zone 'Europe/Rome')::time>=time '12:00'))))
  )
  select jsonb_build_object(
    'eventId',p_event_id,'updatedAt',statement_timestamp(),'day',p_day,'part',p_part,
    'expected',jsonb_build_object(
      'adults',(select count(*) from expected_registrations),
      'children',(select count(*) from public.registration_children where registration_id in (select id from expected_registrations)),
      'students',(select coalesce(sum(student_count),0) from expected_schools),
      'companions',(select coalesce(sum(companion_count),0) from expected_schools),
      'schoolBookings',(select count(*) from expected_schools)),
    'arrivals',jsonb_build_object(
      'adults',count(*) filter(where registration_id is not null and child_id is null),
      'children',count(*) filter(where child_id is not null),
      'students',coalesce(sum(student_count),0),'companions',coalesce(sum(companion_count),0),
      'schoolBookings',count(*) filter(where school_booking_id is not null)),
    'operations',jsonb_build_object(
      'duplicateRequests',(select count(*) from operations where action='reception.enter' and metadata->>'outcome'='unchanged'),
      'retries',(select count(*) from operations where metadata->>'outcome'='replayed'),
      'corrections',(select count(*) from operations where action='reception.correct' and metadata->>'outcome'='saved'),
      'cancellations',(select count(*) from operations where action='reception.cancel' and metadata->>'outcome'='saved')),
    'hours',coalesce((select jsonb_agg(h order by h->>'hour') from (
      select jsonb_build_object('hour',to_char(local_time,'YYYY-MM-DD HH24:00'),
        'people',count(*) filter(where registration_id is not null)+coalesce(sum(student_count+companion_count),0)) h
      from filtered group by to_char(local_time,'YYYY-MM-DD HH24:00')) hourly),'[]'::jsonb)
  ) into result from filtered;
  return result;
end $$;
revoke all on function public.reception_operational_report(uuid,date,text) from public,anon;
grant execute on function public.reception_operational_report(uuid,date,text) to authenticated;
comment on function public.reception_operational_report(uuid,date,text) is
  'P13 aggregate report for real event manager/viewer or global admin. Current active arrivals, expected enrollment/declarations, and audited operations; no occupancy or no-show inference. No station identifier is currently recorded.';
notify pgrst,'reload schema';
commit;
