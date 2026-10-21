begin;
update panel_waitlist set status='cancelled' where status in ('waiting','offered');
insert into registration_children(id,registration_id,position,first_name,last_name,birth_date) values(fw(990),fw(107),1,'Child','Seven','2018-01-01');
set local role service_role;
do $$ declare v jsonb; keys text[]; begin
 begin perform set_reception_duties(fw(200),fw(12),fw(8),array[fw(403)::text]);raise exception 'viewer grant';exception when insufficient_privilege then null;end;
 perform set_reception_duties(fw(200),fw(11),fw(8),array[fw(403)::text,'opening','closing']);
 assert cardinality(app.reception_duty_keys(fw(200),fw(8)))=3;
 assert not exists(select 1 from event_user_roles where user_id=fw(8));
 keys:=app.reception_duty_keys(fw(200),fw(8));
 perform set_reception_duties(fw(200),fw(10),fw(8),array[fw(403)::text,'opening'],keys);
 begin perform set_reception_duties(fw(200),fw(11),fw(8),array['closing'],keys);raise exception 'stale duties allowed';exception when serialization_failure then null;end;
 begin perform reception_target_statistics(fw(200),fw(8),fw(405)::text);raise exception 'foreign duty stats';exception when insufficient_privilege then null;end;
 v:=reception_desk(fw(200),fw(8),fw(403)::text,'code','QQQ7');
 assert v->>'status'='ready' and jsonb_array_length(v->'children')=1;
 assert v::text !~ 'email|birth|auth_user';
 v:=reception_desk(fw(200),fw(8),fw(403)::text,'code','QQQ7','book',fw(503),array[fw(990)],fw(991));
 assert v->>'status'='saved';
 assert (select cardinality(child_ids)=1 from panel_child_selections where registration_id=fw(107) and panel_id=fw(403));
 assert not exists(select 1 from check_ins where registration_id=fw(107));
 assert reception_desk(fw(200),fw(8),fw(403)::text,'code','QQQ7','book',fw(503),array[fw(990)],fw(991))->>'status'='saved';
 assert (select count(*)=1 from audit_logs where action='reception.booking' and entity_id=fw(107));
 assert reception_desk(fw(200),fw(8),fw(403)::text,'code','QQQ7','book',fw(503),'{}',fw(992))->>'status'='already_booked';
 v:=reception_panel_check_in('panel_entry',fw(403),fw(200),fw(8),'code','QQQ7');
 assert v->>'status'='valid' and jsonb_array_length(v->'persons')=2;
 assert reception_panel_check_in('panel_entry',fw(403),fw(200),fw(8),'code','QQQ7','enter',fw(993),array[fw(107)])->>'status'='event_entry_required';
 assert (reception_target_statistics(fw(200),fw(8),fw(403)::text)->>'booked')::integer>=2;
 assert reception_desk(fw(200),fw(8),'opening','code','QQQ7')->>'status'='unconfigured';
 perform set_reception_duties(fw(200),fw(11),fw(8),array[fw(404)::text]);
 assert reception_forum_routing(fw(200),fw(8),fw(404),'code','QQQ7')->'routes'->0->>'title'='Morning A';
 assert reception_desk(fw(200),fw(8),fw(404)::text,'code','QQQ7','book',fw(504),'{}',fw(994))->>'status'='booking_conflict';
 keys:=app.reception_duty_keys(fw(200),fw(8));
 perform set_reception_duties(fw(200),fw(11),fw(8),'{}',keys);
 begin perform reception_desk(fw(200),fw(8),fw(403)::text,'code','QQQ7','book',fw(503),array[fw(990)],fw(991));raise exception 'revoked retry';exception when insufficient_privilege then null;end;
end $$;
reset role;
\echo PASS scoped duties, Manager/Admin grants, stale edit, no general role, desktop booking/minors/retry, wrong Forum routing and revocation
-- Validate actual event and Forum presence separately.
select set_reception_duties(fw(200),fw(11),fw(8),array[fw(403)::text,'opening','closing']);
insert into check_ins(event_id,registration_id,child_id,checked_in_by,source) values(fw(200),fw(107),null,fw(10),'manual'),(fw(200),fw(107),fw(990),fw(10),'manual');
select reception_panel_check_in('panel_entry',fw(403),fw(200),fw(8),'code','QQQ7','enter',fw(995),array[fw(107),fw(990)]);
do $$ begin
 assert (select count(*)=2 from check_ins where registration_id=fw(107) and moment_id is null and cancelled_at is null);
 assert (select count(*)=2 from check_ins where registration_id=fw(107) and moment_id=fw(403) and cancelled_at is null);
 assert (reception_target_statistics(fw(200),fw(8),fw(403)::text)->>'entered')::integer=2;
end $$;
-- Canonical ceremony setup with synthetic data; no production capacities.
select save_ceremony(fw(200),fw(10),'opening',-1,'configure','{"location":"Synthetic ceremony","capacity":2,"startsAt":"2026-10-25T10:00","endsAt":"2026-10-25T11:00","state":"validated","attendancePart":"morning"}');
select save_ceremony(fw(200),fw(10),'opening',1,'sector',jsonb_build_object('id',fw(980),'name','Synthetic sector','capacity',2));
select save_ceremony(fw(200),fw(10),'opening',2,'quota',jsonb_build_object('id',fw(981),'sectorId',fw(980),'category','Synthetic guests','quantity',2));
set local role service_role;
do $$ declare v jsonb; begin
 assert reception_desk(fw(200),fw(8),'opening','code','QQQ7','book',fw(981),'{}',fw(982))->>'status'='saved';
 v:=reception_ceremony_check_in(fw(200),fw(8),'opening','code','QQQ7');
 assert v->>'status'='valid';
 assert v->'persons'->0->'ceremonies'->0->>'sector'='Synthetic sector';
 assert v->'persons'->1->'ceremonies'='[]'::jsonb;
 assert reception_ceremony_check_in(fw(200),fw(8),'opening','code','QQQ7','enter',fw(983),array[fw(107),fw(990)])->>'status'='not_booked';
 assert not exists(select 1 from check_ins where moment_id=(select moment_id from ceremony_plans where kind='opening'));
 assert reception_ceremony_check_in(fw(200),fw(8),'opening','code','QQQ7','enter',fw(983),array[fw(107)])->>'status'='valid';
 assert reception_ceremony_check_in(fw(200),fw(8),'opening','code','QQQ7','enter',fw(983),array[fw(107)])->>'outcome'='replayed';
 assert reception_ceremony_check_in(fw(200),fw(8),'opening','code','QQQ7','cancel',fw(984),array[fw(107)],0)->>'status'='conflict';
 assert reception_ceremony_check_in(fw(200),fw(8),'opening','code','QQQ7','cancel',fw(984),array[fw(107)],1)->>'status'='valid';
 assert (reception_target_statistics(fw(200),fw(8),'opening')->>'entered')::integer=0;
 assert (select count(*)=2 from check_ins where registration_id=fw(107) and moment_id is null and cancelled_at is null);
end $$;
reset role;
select set_config('request.jwt.claim.sub',fw(8)::text,true);
set local role authenticated;
do $$ begin
 assert has_panel_reception_duty();
 assert jsonb_array_length(reception_duty_catalog()->'choices')=3;
 begin perform set_reception_duties(fw(200),fw(10),fw(8),array['closing']);raise exception 'spoofed actor';exception when insufficient_privilege then null;end;
 begin perform reception_desk(fw(200),fw(8),'opening','code','QQQ7');raise exception 'public desk';exception when insufficient_privilege then null;end;
 begin perform 1 from ceremony_reception_assignments;raise exception 'RLS';exception when insufficient_privilege then null;end;
end $$;
reset role;
set constraints all immediate;
\echo PASS distinct Forum/event entries, ceremony tickets/seats, explicit minors, atomic rejection, replay and revision, service-only RPC and scoped catalogue
rollback;
