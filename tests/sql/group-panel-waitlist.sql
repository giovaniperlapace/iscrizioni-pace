-- Synthetic group leader extension; the enclosing runner provides fw() and local PostgreSQL.
begin;
insert into groups(id,event_id,name) values(fw(700),fw(200),'Queue parent'),(fw(702),fw(200),'Outside queue');
insert into groups(id,event_id,name,parent_group_id) values(fw(701),fw(200),'Queue child',fw(700));
insert into group_memberships(group_id,user_id) values(fw(700),fw(9)),(fw(700),fw(11)),(fw(700),fw(12));
insert into participant_group_assignments(registration_id,group_id,status,is_current)
 select fw(100+n),fw(701),'confirmed',true from generate_series(1,5) n;
-- No personal account is required for a participant whose request is handled by a leader.
update participants set auth_user_id=null where id=fw(24);
insert into registration_children(id,registration_id,position,first_name,last_name,birth_date)
 values(fw(904),fw(104),1,'Child','Queue','2018-01-01');
insert into event_locations(id,event_id,name,max_capacity) values(fw(607),fw(200),'Group waiting room',20),(fw(608),fw(200),'Group alternative',20);
insert into event_moments(id,event_id,moment_type,title,starts_at,ends_at,location_id,publication_status,is_public) values
 (fw(407),fw(200),'panel','Group queue','2026-10-25 16:00 Europe/Rome','2026-10-25 17:00 Europe/Rome',fw(607),'draft',false),
 (fw(408),fw(200),'panel','Group alternative','2026-10-25 17:00 Europe/Rome','2026-10-25 18:00 Europe/Rome',fw(608),'draft',false);
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fw(507),fw(200),fw(407),fw(300),1),(fw(508),fw(200),fw(408),fw(300),10);
update event_moments set publication_status='published',is_public=true where id in (fw(407),fw(408));
select set_config('request.jwt.claim.sub',fw(9)::text,false);
set local role authenticated;
select set_group_panel_booking(fw(200),fw(507),fw(101),true);
select set_panel_family_booking(fw(104),fw(408),fw(508),'book',array[fw(904)],true,'fr');
select set_panel_family_booking(fw(104),fw(407),fw(507),'join',array[fw(904)],true,'fr');
select set_panel_family_booking(fw(104),fw(407),fw(507),'join',array[fw(904)],true,'fr');
do $$ declare v jsonb; begin
 v:=get_group_panel_booking_view(fw(200),fw(507));
 assert (select x->>'status'='queued' and x->>'queuePosition'='1' from jsonb_array_elements(v->'participants') x where x->>'registrationId'=fw(104)::text);
 assert (select count(*)=5 from jsonb_array_elements(v->'participants'));
 begin perform set_group_panel_waitlist(fw(200),fw(507),fw(108),'join');raise exception 'foreign group allowed';exception when insufficient_privilege then null;end;
 begin perform set_individual_panel_waitlist(fw(104),fw(407),fw(507),'join');raise exception 'owner gate widened';exception when insufficient_privilege then null;end;
 begin perform 1 from panel_waitlist;raise exception 'queue table exposed';exception when insufficient_privilege then null;end;
 begin perform app.set_panel_waitlist(fw(104),fw(407),fw(507),'join',true,'it');raise exception 'private helper exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 assert (select count(*)=1 from panel_waitlist where registration_id=fw(104) and panel_id=fw(407));
 assert (select notification_kind='leader' and notification_user_id=fw(9) and notification_locale='fr' from panel_waitlist where registration_id=fw(104) and panel_id=fw(407));
end $$;
\echo PASS leader descendant scope, no-account family, queue despite same-slot booking, deduplication and private helpers
-- Personal and group requests share the FIFO. Leader reads and manages an existing personal request without stealing its notification.
select set_config('request.jwt.claim.sub',fw(5)::text,false);
set local role authenticated;
select set_individual_panel_waitlist(fw(105),fw(407),fw(507),'join');
reset role;
select set_config('request.jwt.claim.sub',fw(9)::text,false);
set local role authenticated;
select set_group_panel_waitlist(fw(200),fw(507),fw(105),'join','it');
select set_group_panel_booking(fw(200),fw(507),fw(101),false);
reset role;
select app.advance_panel_waitlist(fw(507),true);
do $$ begin
 assert (select status='waiting' from panel_waitlist where panel_id=fw(407) and registration_id=fw(104));
 assert (select status='waiting' and notification_kind='participant' and notification_user_id=fw(5) from panel_waitlist where panel_id=fw(407) and registration_id=fw(105));
end $$;
update panel_seat_sections set capacity=2 where id=fw(507);
select app.advance_panel_waitlist(fw(507),true);
-- Ensure unrelated earlier fixtures are not pending notification candidates in this rollback-only test.
update panel_waitlist set notification_status='sent' where panel_id<>fw(407) and status='offered';
update panel_waitlist_scheduler set next_run_at=clock_timestamp()+interval '5 minutes';
set local role service_role;
do $$ declare v jsonb; begin
 v:=claim_panel_waitlist_notification();
 assert v->>'email'='queue-9@example.invalid'; assert v->>'notificationKind'='leader';
 assert v->>'registrationId'=fw(104)::text; assert v->>'sectionId'=fw(507)::text;
 assert v->>'locale'='fr'; assert v->>'seats'='2';
 assert claim_panel_waitlist_notification() is null;
end $$;
reset role;
-- An active entry remains visible when the leader views another individual quota of the same Forum.
insert into panel_audience_types(id,event_id,code,name,booking_channel) values(fw(302),fw(200),'other_individual','Other individuals','individual');
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fw(509),fw(200),fw(407),fw(302),1);
select set_config('request.jwt.claim.sub',fw(9)::text,false);
set local role authenticated;
do $$ declare v jsonb; begin
 v:=get_group_panel_booking_view(fw(200),fw(509));
 assert (select x->>'status'='offered' and x->>'waitlistSectionId'=fw(507)::text from jsonb_array_elements(v->'participants') x where x->>'registrationId'=fw(104)::text);
end $$;
reset role;
\echo PASS shared strict FIFO reserves the whole family; notification goes once to requesting leader; entry visible across quotas
select set_config('request.jwt.claim.sub',fw(9)::text,false);
set local role authenticated;
select set_group_panel_waitlist(fw(200),fw(507),fw(104),'accept');
select set_group_panel_waitlist(fw(200),fw(507),fw(104),'accept');
reset role;
do $$ begin
 assert (select choice='yes' from moment_attendance_choices where registration_id=fw(104) and moment_id=fw(407));
 assert (select choice='no' from moment_attendance_choices where registration_id=fw(104) and moment_id=fw(408));
 assert app.panel_section_occupancy(fw(507))=2;
 assert (select count(*)=1 from audit_logs where action='panel.waitlist_accepted' and entity_id in (select id from panel_waitlist where registration_id=fw(104) and panel_id=fw(407)));
end $$;
\echo PASS leader acceptance atomically replaces same-slot booking with children; retries preserve audit and capacity
-- Cancellation/expiry do not cancel the alternative booking.
select set_config('request.jwt.claim.sub',fw(9)::text,false);
set local role authenticated;
select set_group_panel_booking(fw(200),fw(507),fw(104),false);
select set_panel_family_booking(fw(104),fw(408),fw(508),'book',array[fw(904)],true,'fr');
select set_group_panel_waitlist(fw(200),fw(507),fw(104),'join');
select set_group_panel_waitlist(fw(200),fw(507),fw(105),'leave');
select set_group_panel_waitlist(fw(200),fw(507),fw(105),'leave');
reset role;
select app.advance_panel_waitlist(fw(507),true);
update panel_waitlist set expires_at=clock_timestamp()-interval '1 second' where registration_id=fw(104) and panel_id=fw(407) and status='offered';
set local role authenticated;
do $$ begin assert set_group_panel_waitlist(fw(200),fw(507),fw(104),'accept')->>'status'='expired';end $$;
reset role;
do $$ begin assert (select choice='yes' from moment_attendance_choices where registration_id=fw(104) and moment_id=fw(408));end $$;
\echo PASS leave and exact expiry preserve alternative booking
-- Revocation and participant movement block all subsequent operations and notifications.
update panel_seat_sections set capacity=1 where id=fw(507);
set local role authenticated;
select set_group_panel_waitlist(fw(200),fw(507),fw(104),'join');
reset role;
update panel_seat_sections set capacity=2 where id=fw(507);
select app.advance_panel_waitlist(fw(507),true);
delete from group_memberships where user_id=fw(9) and group_id=fw(700);
set local role authenticated;
do $$ begin
 begin perform set_group_panel_waitlist(fw(200),fw(507),fw(104),'accept');raise exception 'revoked leader accepted';exception when insufficient_privilege then null;end;
 begin perform get_group_panel_booking_view(fw(200),fw(507));raise exception 'revoked leader read';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
do $$ begin assert claim_panel_waitlist_notification() is null;end $$;
reset role;
do $$ begin assert (select status='cancelled' from panel_waitlist where registration_id=fw(104) and panel_id=fw(407) order by sequence desc limit 1);end $$;
insert into group_memberships(group_id,user_id) values(fw(700),fw(9));
update panel_seat_sections set capacity=1 where id=fw(507);
set local role authenticated;
select set_group_panel_waitlist(fw(200),fw(507),fw(104),'join');
reset role;
update participant_group_assignments set group_id=fw(702) where registration_id=fw(104) and is_current;
select app.advance_panel_waitlist(fw(507),true);
do $$ begin assert (select status='cancelled' from panel_waitlist where registration_id=fw(104) and panel_id=fw(407) order by sequence desc limit 1);end $$;
\echo PASS revoked leader and moved participant lose access and pending notification
-- Existing Manager/Viewer exclusion, anonymous protection and release gate remain.
do $$ declare uid uuid; begin
 foreach uid in array array[fw(11),fw(12),null] loop
  perform set_config('request.jwt.claim.sub',coalesce(uid::text,''),true);
  begin perform set_group_panel_waitlist(fw(200),fw(507),fw(101),'join');raise exception 'role gate bypass';exception when insufficient_privilege then null;end;
 end loop;
end $$;
select set_config('request.jwt.claim.sub',fw(9)::text,false);
update events set panel_access_mode='internal' where id=fw(200);
do $$ begin
 begin perform set_group_panel_waitlist(fw(200),fw(507),fw(101),'join');raise exception 'closed release bypass';exception when insufficient_privilege then null;end;
end $$;
\echo PASS unchanged role and public opening gates
rollback;
