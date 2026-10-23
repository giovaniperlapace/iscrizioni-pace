begin;
insert into school_booking_teachers(id,event_id,email,first_name,last_name,phone)
 values(fw(2996),fw(200),'school-qr@example.invalid','Teacher','QR','+39000000');
insert into school_bookings(id,event_id,teacher_id,school_name,school_city,class_description,student_count,companion_count,privacy_version,privacy_accepted_at)
 values(fw(2997),fw(200),fw(2996),'School QR','Test','1A',10,2,'test',now());
insert into school_panel_reservations(event_id,booking_id,panel_id,seat_section_id,student_count,companion_count)
 values(fw(200),fw(2997),fw(401),fw(550),10,2);
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fw(555),fw(200),fw(405),fw(301),12);
insert into school_panel_reservations(event_id,booking_id,panel_id,seat_section_id,student_count,companion_count)
 values(fw(200),fw(2997),fw(405),fw(555),10,2);
select set_reception_duties(fw(200),fw(10),fw(8),array[fw(401)::text,fw(405)::text]);
create temp table school_before_registrations as select count(*) total from registrations;
set local role service_role;
do $$ declare v jsonb; n integer; begin
 assert ensure_school_booking_qr(fw(2997),repeat('c',64),repeat('z',100))=repeat('z',100);
 assert ensure_school_booking_qr(fw(2997),repeat('d',64),repeat('y',100))=repeat('z',100);
 assert (select count(*) from school_booking_qr_tokens where booking_id=fw(2997))=1;
 assert (select state from school_booking_email_deliveries where booking_id=fw(2997))='queued';
 begin
  insert into audit_logs(event_id,action,entity_table,entity_id,metadata)
    values(fw(200),'school_booking.confirmation_email_sent','school_bookings',fw(2997),'{}');
  assert (select state from school_booking_email_deliveries where booking_id=fw(2997))='accepted';
  raise exception using errcode='PZ002',message='rollback compatibility test';
 exception when sqlstate 'PZ002' then null;end;
 assert not (select enabled from school_booking_email_control where singleton);
 assert claim_school_booking_email(fw(2997)) is null;
 assert (select state from school_booking_email_deliveries where booking_id=fw(2997))='queued';
 assert not has_table_privilege('authenticated','public.school_booking_email_control','UPDATE');
 update school_booking_email_control set enabled=true where singleton;
 assert claim_school_booking_email(fw(2997))=fw(2997);
 assert claim_school_booking_email(fw(2997)) is null;
 update school_booking_email_deliveries set updated_at=now()-interval '11 minutes' where booking_id=fw(2997);
 assert claim_school_booking_email(fw(2997)) is null;
 assert (select state from school_booking_email_deliveries where booking_id=fw(2997))='uncertain';
 v:=reception_panel_check_in('panel_entry',fw(401),fw(200),fw(8),'qr',repeat('c',64));
 assert v->>'status'='valid' and v->>'eventCheckedIn'='false';
 begin
  perform reception_panel_check_in('panel_entry',fw(401),fw(200),fw(8),'qr',repeat('c',64),'enter',fw(2998),'{}',11,1,null,'school_event_entry');
  raise exception 'Count bound ignored';
 exception when invalid_parameter_value then null;end;
 assert not exists(select 1 from check_ins where school_booking_id=fw(2997));
 begin
  perform reception_panel_check_in('panel_entry',fw(401),fw(200),fw(8),'code','QQQ1','enter',fw(2998),array[fw(101)],null,null,null,'school_event_entry');
  raise exception 'Personal QR accepted school permission';
 exception when invalid_parameter_value then null;end;
 v:=reception_panel_check_in('panel_entry',fw(401),fw(200),fw(8),'qr',repeat('c',64),'enter',fw(2998),'{}',8,1,null,'school_event_entry');
 assert v->>'status'='valid' and v->>'outcome'='saved' and v->>'eventCheckedIn'='true',v::text;
 assert (select count(*) from check_ins where school_booking_id=fw(2997) and cancelled_at is null)=2;
 assert (select student_count=8 and companion_count=1 from check_ins where school_booking_id=fw(2997) and moment_id is null);
 assert (select check_in_revision=1 from school_bookings where id=fw(2997));
 assert reception_panel_check_in('panel_entry',fw(401),fw(200),fw(8),'qr',repeat('c',64),'enter',fw(2998),'{}',8,1,null,'school_event_entry')->>'outcome'='replayed';
 assert reception_panel_check_in('panel_entry',fw(401),fw(200),fw(8),'qr',repeat('c',64),'enter',fw(2999),'{}',8,1,null,'school_event_entry')->>'outcome'='unchanged';
 assert (select check_in_revision=1 from school_bookings where id=fw(2997));
 assert (select count(*) from audit_logs where entity_id=fw(2997) and action='reception.school.event_from_forum')=1;
 -- A second Forum records its own actual count without counting this class twice at the event.
 assert reception_panel_check_in('panel_entry',fw(405),fw(200),fw(8),'qr',repeat('c',64),'enter',fw(3002),'{}',6,1,null,'school_event_entry')->>'status'='valid';
 assert (select count(*) from check_ins where school_booking_id=fw(2997) and moment_id is null)=1;
 assert (select student_count=8 from check_ins where school_booking_id=fw(2997) and moment_id is null);
 assert (select student_count=6 from check_ins where school_booking_id=fw(2997) and moment_id=fw(405));
 assert (select check_in_revision=1 from school_bookings where id=fw(2997));
 -- Correcting/cancelling Forum attendance must not revoke general-event participation.
 v:=reception_panel_check_in('panel_entry',fw(401),fw(200),fw(8),'qr',repeat('c',64),'correct',fw(3000),'{}',7,1,(v->>'revision')::integer,'count_error');
 assert v->>'status'='valid';
 assert (select student_count=8 from check_ins where school_booking_id=fw(2997) and moment_id is null);
 v:=reception_panel_check_in('panel_entry',fw(401),fw(200),fw(8),'qr',repeat('c',64),'cancel',fw(3001),'{}',null,null,(v->>'revision')::integer,'entry_cancelled');
 assert v->>'status'='valid';
 assert (select cancelled_at is null from check_ins where school_booking_id=fw(2997) and moment_id is null);
 assert not has_function_privilege('authenticated','public.ensure_school_booking_qr(uuid,text,text)','EXECUTE');
 assert not has_table_privilege('authenticated','public.school_booking_email_deliveries','SELECT');
end $$;
reset role;
do $$ begin assert (select count(*) from registrations)=(select total from school_before_registrations); end $$;
select set_config('request.jwt.claim.sub',fw(10)::text,true);
select cancel_school_booking(fw(2997));
set local role service_role;
do $$ begin
 assert reception_panel_check_in('panel_entry',fw(401),fw(200),fw(8),'qr',repeat('c',64))->>'status'='invalid';
 begin perform ensure_school_booking_qr(fw(2997),repeat('d',64),repeat('z',100));raise exception 'Cancelled QR recreated';
 exception when invalid_parameter_value then null;end;
end $$;
reset role;
set constraints all immediate;
\echo PASS school QR stable, durable email claim/uncertain, explicit atomic event+Forum, absences, personal rejection, replay, correction and separate registrations
rollback;
