-- Synthetic only, in the disposable cluster supplied by run-forum-waitlist.
begin;
insert into event_locations(id,event_id,name,max_capacity) values(fw(707),fw(200),'Withdrawal room',40);
insert into event_moments(id,event_id,moment_type,title,starts_at,ends_at,location_id,publication_status)
 values(fw(701),fw(200),'panel','Withdrawal Forum','2026-10-25 09:00 Europe/Rome','2026-10-25 10:00 Europe/Rome',fw(707),'draft');
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values
 (fw(702),fw(200),fw(701),fw(300),10),(fw(703),fw(200),fw(701),fw(301),20);
update event_moments set publication_status='published' where id=fw(701);
set constraints all immediate;
insert into participants(id,auth_user_id,first_name,last_name,public_code)
 select fw(720+n),fw(n),'Withdrawal','Synthetic',lpad(n::text,4,'W') from generate_series(1,4) n;
insert into registrations(id,event_id,participant_id,status)
 select fw(710+n),fw(200),fw(720+n),'confirmed' from generate_series(1,4) n;
insert into registration_children(registration_id,position,first_name,last_name,birth_date) values(fw(711),1,'Minor','Synthetic','2018-01-01');
select set_config('request.jwt.claim.sub',fw(1)::text,true);
select set_individual_panel_booking(fw(711),fw(701),fw(702),true);
insert into school_booking_teachers(id,event_id,email,first_name,last_name,phone) values(fw(750),fw(200),'withdrawal@example.invalid','Teacher','Synthetic','12345');
insert into school_bookings(id,event_id,teacher_id,school_name,school_city,class_description,student_count,companion_count,privacy_version,privacy_accepted_at)
 values(fw(751),fw(200),fw(750),'Synthetic school','Test city','Test class',4,1,'synthetic',now());
insert into school_panel_reservations(id,event_id,booking_id,panel_id,seat_section_id,student_count,companion_count)
 values(fw(752),fw(200),fw(751),fw(701),fw(703),4,1);
insert into panel_waitlist(event_id,registration_id,panel_id,section_id,notification_user_id,status,offered_at,expires_at,reserved_seats,notification_status)
 values(fw(200),fw(712),fw(701),fw(702),fw(2),'offered',clock_timestamp(),clock_timestamp()+interval '30 minutes',1,'pending');
insert into panel_waitlist(event_id,registration_id,panel_id,section_id,notification_user_id)
 values(fw(200),fw(713),fw(701),fw(702),fw(3));
create temp table withdrawal_snapshot as
 select 'choices' kind,to_jsonb(x) row from moment_attendance_choices x where moment_id=fw(701)
 union all select 'children',to_jsonb(x) from registration_children x where registration_id=fw(711)
 union all select 'schools',to_jsonb(x) from school_panel_reservations x where panel_id=fw(701)
 union all select 'registrations',to_jsonb(x) from registrations x where id in(fw(711),fw(712),fw(713));
select set_config('request.jwt.claim.sub',fw(12)::text,true);
set local role authenticated;
do $$ begin
 begin perform unpublish_panel(fw(200),fw(701));raise exception 'viewer allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',fw(1)::text,true);
set local role authenticated;
do $$ begin
 begin perform unpublish_panel(fw(200),fw(701));raise exception 'participant allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform unpublish_panel(fw(200),fw(701));raise exception 'anon allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',fw(11)::text,true);
set local role authenticated;
select unpublish_panel(fw(200),fw(701));
select unpublish_panel(fw(200),fw(701));
reset role;
do $$ begin
 assert (select publication_status='draft' and not is_public from event_moments where id=fw(701));
 assert (select count(*)=1 from audit_logs where entity_id=fw(701) and action='panel.unpublished');
 assert (select count(*)=2 from panel_seat_sections where panel_id=fw(701));
 assert not exists(select 1 from get_public_panel_program() where panel_id=fw(701));
 assert (select status='cancelled' from panel_waitlist where registration_id=fw(712));
 assert (select status='waiting' from panel_waitlist where registration_id=fw(713));
 assert app.panel_section_occupancy(fw(702))=2;
 assert not exists(
  (select * from withdrawal_snapshot except
   (select 'choices',to_jsonb(x) from moment_attendance_choices x where moment_id=fw(701)
    union all select 'children',to_jsonb(x) from registration_children x where registration_id=fw(711)
    union all select 'schools',to_jsonb(x) from school_panel_reservations x where panel_id=fw(701)
    union all select 'registrations',to_jsonb(x) from registrations x where id in(fw(711),fw(712),fw(713))))
 );
end $$;
\echo PASS withdrawal hides Forum, preserves exact registrations/children/schools/sections, cancels offers, retains FIFO and audits once
select set_config('request.jwt.claim.sub',fw(10)::text,true);
set local role authenticated;
select save_panel_draft(fw(200),fw(701),'Withdrawal Forum edited','Synthetic description',fw(707),'2026-10-25 09:00 Europe/Rome','2026-10-25 10:00 Europe/Rome',
 jsonb_build_array(jsonb_build_object('audience_type_id',fw(300),'capacity',10),jsonb_build_object('audience_type_id',fw(301),'capacity',20)));
select publish_panels(fw(200),array[fw(701)]);
reset role;
do $$ begin
 assert (select publication_status='published' and is_public from event_moments where id=fw(701));
 assert (select count(*)=2 from panel_seat_sections where id in(fw(702),fw(703)));
 assert (select choice='yes' and seat_section_id=fw(702) from moment_attendance_choices where registration_id=fw(711) and moment_id=fw(701));
 assert (select seat_section_id=fw(703) and status='reserved' from school_panel_reservations where id=fw(752));
end $$;
\echo PASS withdrawn Forum remains editable and republish retains section IDs and confirmed seats
select set_config('request.jwt.claim.sub',fw(11)::text,true);
set local role authenticated;
select unpublish_panel(fw(200),fw(701));
do $$ begin
 begin
  perform save_panel_draft(fw(200),fw(701),'Bad edit',null,fw(707),'2026-10-25 09:00 Europe/Rome','2026-10-25 10:00 Europe/Rome',
   jsonb_build_array(jsonb_build_object('audience_type_id',fw(300),'capacity',1),jsonb_build_object('audience_type_id',fw(301),'capacity',20)));
  raise exception 'occupied seats lost';
 exception when sqlstate 'P0001' then
  if sqlerrm='occupied seats lost' then raise; end if;
 end;
 begin
  perform unpublish_panel(fw(701),fw(701));raise exception 'wrong event allowed';exception when insufficient_privilege then null;end;
 begin
  perform unpublish_panel(fw(200),fw(9999));raise exception 'missing Forum allowed';exception when no_data_found then null;end;
end $$;
reset role;
do $$ begin assert (select capacity=10 from panel_seat_sections where id=fw(702));end $$;
\echo PASS draft edits cannot reduce below occupied seats; foreign events and missing Forum rejected
rollback;
