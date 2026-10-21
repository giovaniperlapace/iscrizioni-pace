begin;
update panel_waitlist set status='cancelled' where registration_id=fw(106);
delete from moment_attendance_choices where registration_id=fw(106);
delete from event_attendance_choices where registration_id=fw(106);
insert into event_attendance_choices(registration_id,day,day_part,choice) values
 (fw(106),'2026-10-26','morning','no'),
 (fw(106),'2026-10-26','afternoon','no'),
 (fw(106),'2026-10-27','morning','unknown');
select set_config('request.jwt.claim.sub',fw(6)::text,true);
-- Invalid child: both the attendance update and booking must roll back.
do $$ begin
 begin
  perform confirm_attendance_and_book_forum(fw(106),fw(403),fw(503),'book',array[fw(999999)]);
  raise exception 'invalid child accepted' using errcode='PFA99';
 exception when others then
  if sqlstate='PFA99' then raise; end if;
 end;
 assert (select choice='no' from event_attendance_choices where registration_id=fw(106) and day='2026-10-26' and day_part='morning');
end $$;
set local role authenticated;
select confirm_attendance_and_book_forum(fw(106),fw(403),fw(503),'book',array[]::uuid[]);
reset role;
do $$ begin
 assert (select choice='yes' from event_attendance_choices where registration_id=fw(106) and day='2026-10-26' and day_part='morning');
 assert (select choice='no' from event_attendance_choices where registration_id=fw(106) and day='2026-10-26' and day_part='afternoon');
 assert (select choice='unknown' from event_attendance_choices where registration_id=fw(106) and day='2026-10-27' and day_part='morning');
 assert exists(select 1 from moment_attendance_choices where registration_id=fw(106) and moment_id=fw(403) and choice='yes');
 begin
  perform confirm_attendance_and_book_forum(fw(101),fw(403),fw(503),'book',array[]::uuid[]);
  raise exception 'foreign registration accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
\echo PASS one-click attendance and booking, other slots preserved, invalid-child rollback, ownership
