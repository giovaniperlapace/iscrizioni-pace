create function public.fr(n integer) returns uuid language sql immutable as $$ select md5('forum-reminder-'||n)::uuid $$;
grant usage on schema public,app,extensions to anon,authenticated,service_role;
update events set is_current=false;
insert into events(id,slug,title,city,country,starts_on,ends_on,status,is_current,panel_access_mode)
 values(fr(1),'reminder-test','Synthetic reminders','Test','IT',current_date,current_date+3,'published',true,'open');
insert into participants(id,first_name,last_name,public_code) values(fr(2),'Synthetic','Participant','REM1');
insert into registrations(id,event_id,participant_id,status) values(fr(3),fr(1),fr(2),'confirmed');
insert into panel_audience_types(id,event_id,code,name,booking_channel,sort_order) values(fr(4),fr(1),'individual','Individual','individual',1);
begin;
insert into event_locations(id,event_id,name,address,city,max_capacity) values(fr(5),fr(1),'Sala prova','Via sintetica 42','Assisi',50);
insert into event_moments(id,event_id,moment_type,title,starts_at,ends_at,location_id,publication_status,is_public)
 values(fr(6),fr(1),'panel','Forum prova',now()+interval '2 hours',now()+interval '3 hours',fr(5),'draft',false);
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fr(7),fr(1),fr(6),fr(4),50);
update event_moments set publication_status='published',is_public=true where id=fr(6);
insert into event_attendance_choices(registration_id,day,day_part,choice)
 select fr(3),d::date,part,'yes' from generate_series(current_date,current_date+3,interval '1 day') d cross join (values('morning'),('afternoon')) parts(part);
insert into moment_attendance_choices(registration_id,moment_id,choice,seat_section_id) values(fr(3),fr(6),'yes',fr(7));
insert into registration_children(id,registration_id,position,first_name,last_name,birth_date)
 values(fr(8),fr(3),1,'Booked','Child','2018-01-01'),(fr(9),fr(3),2,'Not booked','Child','2019-01-01');
insert into panel_child_selections values(fr(3),fr(6),array[fr(8)]);
commit;
-- Exact boundary uses transaction time, independent of test execution duration.
begin;
update event_moments set starts_at=now()+interval '2 hours',ends_at=now()+interval '3 hours' where id=fr(6);
insert into forum_reminder_settings values(fr(1),now()-interval '1 day',false);
set local role service_role;
do $$ begin assert enqueue_forum_reminders()=0; end $$;
reset role;
update forum_reminder_settings set enabled=true;
update event_moments set starts_at=now()+interval '2 hours 1 second' where id=fr(6);
do $$ begin assert enqueue_forum_reminders()=0; end $$;
update event_moments set starts_at=now()+interval '2 hours' where id=fr(6);
do $$ declare notice jsonb; begin
 assert enqueue_forum_reminders()=1;
 assert enqueue_forum_reminders()=0;
 notice:=claim_forum_reminder();
 assert notice->'payload'->0->>'address'='Via sintetica 42';
 assert notice->'payload'->0->'children'='["Booked Child"]'::jsonb;
 assert claim_forum_reminder() is null;
 assert not authorize_forum_reminder((notice->>'id')::uuid,fr(100),notice->'payload','test@example.invalid','Subject','Text');
 assert authorize_forum_reminder((notice->>'id')::uuid,(notice->>'claim')::uuid,notice->'payload','test@example.invalid','Subject','Text');
 update event_locations set address='Via nuova 99' where id=fr(5);
 assert not authorize_forum_reminder((notice->>'id')::uuid,(notice->>'claim')::uuid,notice->'payload','test@example.invalid','Subject','Text');
 update moment_attendance_choices set choice='no',seat_section_id=null where registration_id=fr(3);
 assert app.forum_reminder_payload(fr(3),fr(6)) is null;
 assert not authorize_forum_reminder((notice->>'id')::uuid,(notice->>'claim')::uuid,notice->'payload','test@example.invalid','Subject','Text');
end $$;
rollback;
\echo PASS disabled switch, exact two-hour boundary, idempotence, explicit minors, stale claims, changed address and cancellation
begin;
insert into forum_reminder_settings values(fr(1),now()-interval '1 day',true);
update event_moments set starts_at=now()-interval '1 second',ends_at=now()+interval '1 hour' where id=fr(6);
do $$ begin assert enqueue_forum_reminders()=0; end $$;
update event_moments set starts_at=now()+interval '1 hour',ends_at=now()+interval '2 hours' where id=fr(6);
update forum_reminder_settings set enabled_at=now();
do $$ begin assert enqueue_forum_reminders()=0; end $$;
update forum_reminder_settings set enabled_at=now()-interval '1 day';
update registrations set status='cancelled' where id=fr(3);
do $$ begin assert enqueue_forum_reminders()=0; end $$;
update registrations set status='confirmed',deleted_at=now(),deletion_reason='Synthetic test' where id=fr(3);
do $$ begin assert enqueue_forum_reminders()=0; end $$;
update registrations set deleted_at=null where id=fr(3);
update event_moments set publication_status='draft',is_public=false where id=fr(6);
do $$ begin assert enqueue_forum_reminders()=0; end $$;
rollback;
\echo PASS past Forum, no retroactive activation, cancelled/deleted registration and unpublished Forum excluded
begin;
set local role authenticated;
do $$ begin
 begin perform enqueue_forum_reminders(); raise exception 'permission missing'; exception when insufficient_privilege then null; end;
 begin perform claim_forum_reminder(); raise exception 'permission missing'; exception when insufficient_privilege then null; end;
 begin perform 1 from forum_reminder_emails; raise exception 'permission missing'; exception when insufficient_privilege then null; end;
 begin perform app.forum_reminder_payload(fr(3),fr(6)); raise exception 'permission missing'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform claim_forum_reminder(); raise exception 'permission missing'; exception when insufficient_privilege then null; end;
 begin perform 1 from forum_reminder_settings; raise exception 'permission missing'; exception when insufficient_privilege then null; end;
end $$;
rollback;
\echo PASS anonymous/authenticated cannot read identities/settings or call worker RPCs
begin;
insert into forum_reminder_settings values(fr(1),now()-interval '1 day',true);
do $$ declare notice jsonb; begin
 assert enqueue_forum_reminders()=1;
 notice:=claim_forum_reminder();
 update forum_reminder_emails set updated_at=now()-interval '11 minutes';
 assert enqueue_forum_reminders()=0;
 assert (select state='uncertain' from forum_reminder_emails);
 assert claim_forum_reminder() is null;
end $$;
rollback;
\echo PASS interrupted claims become uncertain and never resend
begin;
insert into auth.users(id,email) values(fr(20),'leader@example.invalid');
insert into profiles(id,email) values(fr(20),'leader@example.invalid');
update registrations set source='capogruppo',created_by=fr(20) where id=fr(3);
insert into registration_questionnaire_answers(registration_id,event_id,questionnaire_version,answers)
 values(fr(3),fr(1),'reminder',jsonb_build_object('contact',jsonb_build_object('useLeaderEmail',true,'communicationDelegateUserId',fr(20))));
-- 1,005 delegated people: one durable digest, not one email per registration.
update event_locations set max_capacity=2000 where id=fr(5);
update panel_seat_sections set capacity=2000 where id=fr(7);
insert into participants(id,first_name,last_name,public_code)
 select fr(1000+n),'Synthetic '||n,'Delegate',lpad(n::text,4,'0') from generate_series(1,1004) n;
insert into registrations(id,event_id,participant_id,status,source,created_by)
 select fr(3000+n),fr(1),fr(1000+n),'confirmed','capogruppo',fr(20) from generate_series(1,1004) n;
insert into event_attendance_choices(registration_id,day,day_part,choice)
 select fr(3000+n),d::date,part,'yes' from generate_series(1,1004) n
 cross join generate_series(current_date,current_date+3,interval '1 day') d cross join (values('morning'),('afternoon')) parts(part);
insert into moment_attendance_choices(registration_id,moment_id,choice,seat_section_id)
 select fr(3000+n),fr(6),'yes',fr(7) from generate_series(1,1004) n;
insert into registration_questionnaire_answers(registration_id,event_id,questionnaire_version,answers)
 select fr(3000+n),fr(1),'reminder',jsonb_build_object('contact',jsonb_build_object('useLeaderEmail',true,'communicationDelegateUserId',fr(20))) from generate_series(1,1004) n;
insert into forum_reminder_settings values(fr(1),now()-interval '1 day',true);
do $$ declare notice jsonb; begin
 assert enqueue_forum_reminders()=1;
 notice:=claim_forum_reminder();
 assert notice->>'recipientKey'='delegate:'||fr(20)::text;
 assert jsonb_array_length(notice->'payload')=1005;
 assert enqueue_forum_reminders()=0;
 assert claim_forum_reminder() is null;
 insert into participant_contacts(participant_id,email) values(fr(1001),'personal@example.invalid');
 assert app.forum_reminder_recipient_key(fr(3001))='participant:'||fr(3001)::text;
 assert not authorize_forum_reminder((notice->>'id')::uuid,(notice->>'claim')::uuid,notice->'payload','leader@example.invalid','Subject','Text');
 assert enqueue_forum_reminders()=1;
 assert claim_forum_reminder()->>'recipientKey'='participant:'||fr(3001)::text;
end $$;
rollback;
\echo PASS 1,005 explicit delegations form one digest; personal email wins and route changes invalidate stale digest
begin;
insert into forum_reminder_settings values(fr(1),now()-interval '1 day',true);
insert into event_moments(id,event_id,moment_type,title,publication_status,is_public) values(fr(11),fr(1),'panel','Main Forum','draft',false);
insert into panel_relay_rooms(panel_id,source_panel_id,phase) values(fr(6),fr(11),'open');
do $$ declare p jsonb; begin
 p:=app.forum_reminder_payload(fr(3),fr(6));
 assert p->>'relay'='true';
 assert p->>'location'='Sala prova';
 assert p->>'address'='Via sintetica 42';
 assert p->>'title'='Forum prova';
end $$;
rollback;
\echo PASS relay reminder uses its own booked venue and canonical relation, never the source venue
begin;
insert into forum_reminder_settings values(fr(1),now()-interval '1 day',true);
do $$ declare notice jsonb; check_claim jsonb; report jsonb; begin
 assert enqueue_forum_reminders()=1;
 notice:=claim_forum_reminder();
 assert claim_forum_reminder_report() is null;
 update forum_reminder_emails set state='accepted',message_id='provider-test',recipient='synthetic@example.invalid',accepted_at=now(),updated_at=now();
 assert claim_forum_reminder_delivery_check() is null;
 assert claim_forum_reminder_report() is null;
 update forum_reminder_emails set accepted_at=now()-interval '6 minutes',updated_at=now()-interval '6 minutes';
 check_claim:=claim_forum_reminder_delivery_check();
 assert check_claim->>'messageId'='provider-test';
 assert claim_forum_reminder_delivery_check() is null;
 assert claim_forum_reminder_report() is null;
 update forum_reminder_emails set delivery_state='delivered',delivery_checked_at=now(),delivery_at=now()-interval '5 minutes';
 report:=claim_forum_reminder_report();
 assert (report->'payload'->>'accepted')::integer=1;
 assert (report->'payload'->>'delivered')::integer=1;
 assert (report->'payload'->>'digests')::integer=0;
 assert (report->'payload'->>'pending')::integer=0;
 assert claim_forum_reminder_report() is null;
 update forum_reminder_reports set updated_at=now()-interval '11 minutes';
 assert claim_forum_reminder_report() is null;
 assert (select state='uncertain' from forum_reminder_reports);
end $$;
rollback;
\echo PASS report waits for closed queue, five-minute delay and evidence; exact counts and interrupted report never resent
begin;
set local role authenticated;
do $$ begin
 begin perform claim_forum_reminder_report(); raise exception 'report exposed'; exception when insufficient_privilege then null; end;
 begin perform claim_forum_reminder_delivery_check(); raise exception 'checks exposed'; exception when insufficient_privilege then null; end;
 begin perform 1 from forum_reminder_reports; raise exception 'report identities exposed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
\echo PASS report and delivery evidence remain service-only
-- Durable fixture for independent concurrent connections in the runner.
insert into forum_reminder_settings values(fr(1),now()-interval '1 day',true);
select enqueue_forum_reminders();
