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
select pair_test('assign',(select c.seat_id from ceremony_seat_claims c join ceremony_allocations a on a.id=c.allocation_id join ceremony_quotas q on q.id=a.quota_id join ceremony_sectors s on s.id=q.sector_id where a.group_id=f(7701) and s.name='B' and c.released_at is null limit 1),f(10),f(40),null);
reset role;
create temp table sector_before as select (select sum(quantity) from ceremony_allocations where revoked_at is null) qty,(select count(*) from ceremony_seat_claims where released_at is null) claims,(select seats from ceremony_map_versions where state='published') seats,(select jsonb_agg(to_jsonb(n) order by n.id) from ceremony_nominees n) nominees;
grant select on sector_before to service_role;
do $$ declare p public.ceremony_plans; released integer; begin
 for p in select cp.* from public.ceremony_plans cp join public.events e on e.id=cp.event_id where e.is_current order by cp.id loop
  perform pg_advisory_xact_lock(hashtextextended(p.event_id::text,1381));
  perform 1 from public.ceremony_plans where id=p.id for update;
  if not exists(select 1 from public.ceremony_sectors where plan_id=p.id and numbered) then continue;end if;
  update public.ceremony_seat_claims set released_at=clock_timestamp() where plan_id=p.id and released_at is null;
  get diagnostics released=row_count;
  update public.ceremony_sectors set numbered=false where plan_id=p.id;
  update public.ceremony_plans set revision=revision+1 where id=p.id;
  insert into public.audit_logs(event_id,action,entity_table,entity_id,metadata) values(p.event_id,'ceremony.sector_only','ceremony_plans',p.id,jsonb_build_object('migration','20261022200000','historical_chair_links',released));
 end loop;
end $$;


-- BEGIN SECTOR TESTS
set role service_role;
do $$ declare p uuid; a uuid; b uuid; fa uuid; v jsonb; r jsonb; rev integer; request uuid:=f(7799); before_count integer; begin
 select id into p from ceremony_plans where kind='opening';
 assert not exists(select 1 from ceremony_sectors where numbered);
 assert not exists(select 1 from ceremony_seat_claims where released_at is null);
 assert (select count(*) from ceremony_seat_claims)=(select claims from sector_before);
 assert (select sum(quantity) from ceremony_allocations where revoked_at is null)=(select qty from sector_before);
 assert (select seats from ceremony_map_versions where state='published')=(select seats from sector_before);
 assert (select jsonb_agg(to_jsonb(n) order by n.id) from ceremony_nominees n)=(select nominees from sector_before);
 assert (select count(*) from ceremony_seat_claims where nominee_id is not null)=1;
 assert get_ceremony_assignment_history(f(1),f(31),p,1,'','all')->>'total'='4';
 -- A pre-conversion named chair is now a sector ticket; cancelling it keeps the reserve.
 assert pair_test('revoke',null,null,null,(select id from ceremony_nominees where revoked_at is null))->>'status'='saved';
 select id into a from ceremony_sectors where name='A';select id into b from ceremony_sectors where name='B';
 select ca.id into fa from ceremony_allocations ca join ceremony_quotas q on q.id=ca.quota_id join ceremony_sectors s on s.id=q.sector_id where ca.group_id=f(7701) and s.name='F';
 -- A direct name must contribute to the same group summary as later group nominations.
 r:=assign_ceremony_seats(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(7800),jsonb_build_object('action','assign','sectorId',a,'quantity',1,'seatIds','[]'::jsonb,'groupId',f(7701),'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',null))));assert r->>'status'='saved',r;
 v:=get_ceremony_sector_directory(f(1),f(31),p,f(7701),'',1);
 assert v->'summary'->>'total'='3' and v->'summary'->>'assigned'='1' and v->'summary'->>'unassigned'='2',v;
 assert v->'people'->0->>'attendance'='unknown';
 -- Batch beyond capacity must roll back the first nominal write as well.
 select count(*) into before_count from ceremony_nominees;
 r:=assign_ceremony_group_members(f(1),f(36),fa,(select revision from ceremony_plans where id=p),f(7801),jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',f(40)),jsonb_build_object('registrationId',f(10),'childId',f(41))));assert r->>'status'='capacity',r;
 assert (select count(*) from ceremony_nominees)=before_count;
 select ca.id into a from ceremony_allocations ca join ceremony_quotas q on q.id=ca.quota_id where ca.group_id=f(7701) and q.sector_id=b;
 select revision into rev from ceremony_plans where id=p;
 r:=assign_ceremony_group_members(f(1),f(36),a,rev,request,jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',f(40)),jsonb_build_object('registrationId',f(10),'childId',f(41))));assert r->>'status'='saved',r;
 assert assign_ceremony_group_members(f(1),f(36),a,rev,request,jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',f(40)),jsonb_build_object('registrationId',f(10),'childId',f(41))))->>'status'='saved';
 assert (select quantity from ceremony_allocations where id=a)=3;
 assert not exists(select 1 from ceremony_seat_claims where released_at is null);
 v:=get_ceremony_sector_directory(f(1),f(31),p,f(7701),'',1);
 assert v->'summary'->>'assigned'='3' and v->'summary'->>'unassigned'='0',v;
 assert pair_ceremony_group_ticket(f(1),f(36),a,(select revision from ceremony_plans where id=p),f(7802),'revoke',null,null,null,(select id from ceremony_nominees where child_id=f(40) and revoked_at is null))->>'status'='saved';
 assert (select quantity from ceremony_allocations where id=a)=3;
 -- A nominal manager assignment consumes that group's existing reserve.
 r:=assign_ceremony_seats(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(7803),jsonb_build_object('action','assign','sectorId',b,'quantity',1,'seatIds','[]'::jsonb,'groupId',f(7701),'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',f(40)))));assert r->>'status'='saved',r;
 assert (select quantity from ceremony_allocations where id=a)=3;
 assert (select sum(quantity) from ceremony_allocations where revoked_at is null)=6;
 begin perform get_ceremony_sector_directory(f(1),f(32),p,null,'',1);raise exception 'Viewer read';exception when insufficient_privilege then null;end;
 begin perform assign_ceremony_group_members(f(1),f(31),(select id from ceremony_allocations where group_id=f(7702)),(select revision from ceremony_plans where id=p),f(7804),jsonb_build_array(jsonb_build_object('registrationId',f(11),'childId',null)));raise exception 'Manager bypass';exception when insufficient_privilege then null;end;
 assert not has_function_privilege('authenticated','public.assign_ceremony_group_members(uuid,uuid,uuid,integer,uuid,jsonb)','execute');
 assert not has_function_privilege('anon','public.get_ceremony_sector_directory(uuid,uuid,uuid,uuid,text,integer,boolean)','execute');
end $$;
reset role;
select 'PASS sector conversion retains quantities, people and historical chair links; direct/group totals, atomic rollback, reserve reuse, replay and role boundaries';
insert into participants(id,first_name,last_name,public_code) select f(90000+n),'Page','Member '||lpad(n::text,3,'0'),'P'||lpad(n::text,3,'0') from generate_series(1,105) n;
insert into registrations(id,event_id,participant_id,status) select f(91000+n),f(1),f(90000+n),'submitted' from generate_series(1,105) n;
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) select f(91000+n),f(7701),true,'manager','confirmed' from generate_series(1,105) n;
set role service_role;
do $$ declare p uuid; v jsonb; begin
 select id into p from ceremony_plans where kind='opening';
 v:=get_ceremony_sector_directory(f(1),f(31),p,f(7701),'',2);
 assert v->>'total'='108' and jsonb_array_length(v->'people')=8 and v->'summary'->>'assigned'='3',v;
 v:=get_ceremony_sector_directory(f(1),f(31),p,f(7701),'Member 105',1);
 assert v->>'total'='1' and v->'people'->0->>'name'='Page Member 105',v;
 assert v->'summary'->>'total'='108',v;
end $$;
reset role;
select 'PASS sector directory searches before pagination; summary is complete across direct/group names and pages';
rollback;
