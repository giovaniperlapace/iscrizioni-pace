begin;
reset role;
select prepare_opening_ceremony_layout(f(1),f(33),-1);
select save_ceremony(f(1),f(33),'opening',(select revision from ceremony_plans where kind='opening'),'configure','{"location":"Synthetic hall","capacity":3540,"startsAt":"2026-10-25T16:30","endsAt":"2026-10-25T19:00","state":"validated","attendancePart":"afternoon"}');
select set_ceremony_map(f(1),f(33),(select id from ceremony_plans where kind='opening'),(select revision from ceremony_plans where kind='opening'),f(7790),'publish',jsonb_build_object('versionId',(select id from ceremony_map_versions where state='draft')));
insert into groups(id,event_id,name) values(f(7700),f(1),'Leader parent'),(f(7701),f(1),'Leader group'),(f(7702),f(1),'Other group');
update groups set parent_group_id=f(7700) where id=f(7701);
insert into group_memberships(group_id,user_id,role) values(f(7700),f(36),'capogruppo'),(f(7700),f(31),'capogruppo');
update participant_group_assignments set is_current=false where registration_id in(f(10),f(11));
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values(f(10),f(7701),true,'manager','confirmed'),(f(11),f(7702),true,'manager','confirmed');
delete from event_attendance_choices where registration_id in(f(10),f(11));
create function public.pair_test(action text,seat uuid,registration uuid,child uuid,nominee uuid,allocation uuid default null,actor integer default 36) returns jsonb language sql as $$
 select pair_ceremony_group_ticket(f(1),f(actor),coalesce(allocation,(select a.id from ceremony_allocations a join ceremony_quotas q on q.id=a.quota_id join ceremony_sectors s on s.id=q.sector_id where a.group_id=f(7701) and s.name='B')),(select revision from ceremony_plans where kind='opening'),gen_random_uuid(),action,seat,registration,child,nominee)
$$;
set role service_role;
do $$ declare p uuid; s uuid; seats uuid[]; begin
 select id into p from ceremony_plans where kind='opening';select id into s from ceremony_sectors where name='B';
 select array_agg((x->>'id')::uuid order by x->>'row',lpad(x->>'number',3,'0')) into seats from ceremony_map_versions v,jsonb_array_elements(v.seats) x where v.state='published' and (x->>'sectorId')::uuid=s;
 assert assign_ceremony_seats(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(7791),jsonb_build_object('action','group','sectorId',s,'quantity',3,'seatIds',to_jsonb(seats[1:3]),'groupId',f(7701)))->>'status'='saved';
 assert assign_ceremony_seats(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(7792),jsonb_build_object('action','group','sectorId',s,'quantity',1,'seatIds',to_jsonb(seats[4:4]),'groupId',f(7702)))->>'status'='saved';
 assert assign_ceremony_seats(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(7793),jsonb_build_object('action','group','sectorId',(select id from ceremony_sectors where name='F'),'quantity',1,'seatIds','[]'::jsonb,'groupId',f(7701)))->>'status'='saved';
end $$;
-- BEGIN PAIR TESTS
set role service_role;
do $$ declare v jsonb; a uuid; fa uuid; other uuid; seats uuid[]; n uuid; rev integer; p uuid; request uuid:=f(7794); before_count bigint; before_checkins bigint; begin
 select count(*) into before_checkins from check_ins;
 v:=get_ceremony_leader_tickets(f(1),f(36));
 assert jsonb_array_length(v->'allocations')=2 and jsonb_array_length(v->'people')=1;
 assert jsonb_array_length(v->'tickets')=3 and not v ? 'active' and not v ? 'history';
 assert not (v->'tickets'->0->'seat') ? 'x';
 select (x->>'id')::uuid into a from jsonb_array_elements(v->'allocations') x where x->>'sector'='B';
 select (x->>'id')::uuid into fa from jsonb_array_elements(v->'allocations') x where x->>'sector'='F';
 select array_agg((x->'seat'->>'id')::uuid) into seats from jsonb_array_elements(v->'tickets') x;
 select id into other from ceremony_allocations where group_id=f(7702);
 select id,revision into p,rev from ceremony_plans where kind='opening';
 -- Manager+leader may use only their leader scope, not their general manager role.
 begin perform pair_test('assign',null,f(11),null,null,other,31);raise exception 'manager scope bypass';exception when insufficient_privilege then null;end;
 begin perform get_ceremony_leader_tickets(f(1),f(32));raise exception 'viewer';exception when insufficient_privilege then null;end;
 begin perform pair_test('assign',seats[1],f(10),null,null,a,33);raise exception 'admin without membership';exception when insufficient_privilege then null;end;
 begin perform pair_ceremony_group_ticket(f(2),f(36),a,rev,request,'assign',seats[1],f(10),null,null);raise exception 'foreign event';exception when insufficient_privilege then null;end;
 assert pair_test('assign',seats[1],f(11),null,null)->>'status'='ineligible';
 assert pair_test('assign',seats[1],f(10),f(42),null)->>'status'='ineligible';
 begin perform pair_test('assign',(select seat_id from ceremony_seat_claims where allocation_id=other),f(10),null,null);raise exception 'foreign ticket';exception when insufficient_privilege then null;end;
 assert pair_ceremony_group_ticket(f(1),f(36),a,rev,request,'assign',seats[1],f(10),f(40),null)->>'status'='saved';
 assert pair_ceremony_group_ticket(f(1),f(36),a,rev,request,'assign',seats[1],f(10),f(40),null)->>'status'='saved';
 assert (select count(*)=1 from ceremony_nominees where revoked_at is null);
 assert pair_ceremony_group_ticket(f(1),f(36),a,rev,f(7795),'assign',seats[2],f(10),null,null)->>'status'='conflict';
 begin perform pair_ceremony_group_ticket(f(1),f(36),a,rev,request,'assign',seats[2],f(10),f(40),null);raise exception 'changed replay';exception when invalid_parameter_value then null;end;
 assert pair_test('assign',seats[1],f(10),null,null)->>'status'='occupied';
 assert pair_test('assign',seats[2],f(10),f(40),null)->>'status'='occupied';
 assert (select quantity=3 from ceremony_allocations where id=a);
 select id into n from ceremony_nominees where child_id=f(40) and revoked_at is null;
 assert pair_test('revoke',null,null,null,n)->>'status'='saved';
 assert (select nominee_id is null and released_at is null from ceremony_seat_claims where seat_id=seats[1] and released_at is null);
 assert (select quantity=3 and revoked_at is null from ceremony_allocations where id=a);
 -- A legacy nominee without a numbered chair can complete pairing.
 assert set_ceremony_nominee(f(1),f(36),'assign',a,f(10),null,null,(select revision from ceremony_plans where id=p),f(7796))->>'status'='saved';
 select count(*) into before_count from ceremony_nominees;
 assert pair_test('assign',seats[2],f(10),null,null)->>'status'='saved';
 assert (select count(*)=before_count from ceremony_nominees);
 assert pair_test('assign',null,f(10),f(40),null,fa)->>'status'='saved';
 assert pair_test('assign',null,f(10),f(41),null,fa)->>'status'='capacity';
 assert pair_test('no_seat',null,f(10),f(41),null,fa)->>'status'='saved';
 assert (select count(*)=1 from ceremony_seat_claims where nominee_id is not null and released_at is null);
 assert (select sum(quantity)=5 from ceremony_allocations where revoked_at is null);
 assert (select count(*)=before_checkins from check_ins);
 assert not has_function_privilege('authenticated','public.pair_ceremony_group_ticket(uuid,uuid,uuid,integer,uuid,text,uuid,uuid,uuid,uuid)','execute');
 assert not has_function_privilege('anon','public.get_ceremony_leader_tickets(uuid,uuid)','execute');
end $$;
reset role;
-- Failure after both canonical steps rolls everything back, including audit and retry rows.
create function public.fail_pair_audit() returns trigger language plpgsql as $$ begin if new.action='ceremony.leader_pair_revoke' then raise exception 'synthetic audit failure';end if;return new;end $$;
create trigger fail_pair before insert on audit_logs for each row execute function fail_pair_audit();
set role service_role;
do $$ declare n uuid; rev integer; audits integer; requests integer; begin
 select id into n from ceremony_nominees where registration_id=f(10) and child_id is null and revoked_at is null;
 select revision into rev from ceremony_plans where kind='opening';select count(*) into audits from audit_logs;select count(*) into requests from ceremony_map_requests;
 begin perform pair_test('revoke',null,null,null,n);raise exception 'missing fault';exception when raise_exception then assert sqlerrm='synthetic audit failure';end;
 assert (select revoked_at is null from ceremony_nominees where id=n);
 assert (select count(*)=1 from ceremony_seat_claims where nominee_id=n and released_at is null);
 assert (select revision=rev from ceremony_plans where kind='opening');
 assert (select count(*)=audits from audit_logs);assert (select count(*)=requests from ceremony_map_requests);
end $$;
reset role;
delete from group_memberships where user_id=f(36);
set role service_role;
do $$ begin
 begin perform get_ceremony_leader_tickets(f(1),f(36));raise exception 'revoked read';exception when insufficient_privilege then null;end;
 begin perform pair_test('assign',null,f(10),null,null);raise exception 'revoked write';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS leader tickets: scope/hierarchy/cumulative roles, atomic pairing and cancellation, preserved reserves, retry, conflict, minors, F, legacy nominations and audit rollback';
rollback;
