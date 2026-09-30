-- Read projection used by P13, under actual authenticated RLS. Disposable DB only.
begin;
create view public.p13_attendance_probe with (security_invoker=true) as
select c.id,c.event_id,c.registration_id,c.child_id,c.school_booking_id,c.checked_in_at,c.student_count,c.companion_count
from public.check_ins c
left join public.registrations r on r.id=c.registration_id
left join public.school_bookings s on s.id=c.school_booking_id
where c.moment_id is null and c.cancelled_at is null
and ((r.status in ('submitted','confirmed') and r.deleted_at is null and r.cancelled_at is null)
  or s.status in ('submitted','confirmed'));
grant select on public.p13_attendance_probe to authenticated;
create temporary table p13_expected as select count(*) n from p13_attendance_probe where event_id=f(1);
grant select on p13_expected to authenticated;
do $$ declare actor int; begin
  assert exists(select 1 from pg_constraint where conname='check_ins_registration_id_fkey');
  assert exists(select 1 from pg_constraint where conname='check_ins_school_booking_id_fkey');
  assert (select n>0 from p13_expected);
  foreach actor in array array[31,32,33] loop
    perform set_config('request.jwt.claim.sub',f(actor)::text,true);
    set local role authenticated;
    assert (select count(*)=(select n from p13_expected) from p13_attendance_probe where event_id=f(1)), 'operational projection truncated by RLS';
    reset role;
  end loop;
end $$;
insert into event_user_roles(event_id,user_id,role) values(f(2),f(34),'manager');
set local role authenticated;
select set_config('request.jwt.claim.sub',f(34)::text,true);
do $$ begin assert (select count(*)=0 from p13_attendance_probe where event_id=f(1)), 'foreign event leaked'; end $$;
reset role;
rollback;
select 'PASS P13 event attendance projection, manager/viewer/admin and foreign-event RLS';
