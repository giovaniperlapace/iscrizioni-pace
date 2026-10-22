-- The runner inserts legacy fixture data and applies the new migration here,
-- inside a disposable transaction. Existing E assignments must survive.
select prepare_opening_ceremony_layout(f(1),f(33),-1);
select save_ceremony(f(1),f(33),'opening',(select revision from ceremony_plans where kind='opening'),'configure','{"location":"Synthetic hall","capacity":3540,"startsAt":"2026-10-25T16:30","endsAt":"2026-10-25T19:00","state":"validated","attendancePart":"afternoon"}');
select set_ceremony_map(f(1),f(33),(select id from ceremony_plans where kind='opening'),(select revision from ceremony_plans where kind='opening'),f(9800),'publish',jsonb_build_object('versionId',(select id from ceremony_map_versions where state='draft')));
select assign_ceremony_seats(f(1),f(31),(select id from ceremony_plans where kind='opening'),(select revision from ceremony_plans where kind='opening'),f(9801),jsonb_build_object('action','assign','sectorId',(select id from ceremony_sectors where layout_code='E'),'quantity',1,'seatIds',jsonb_build_array((select s->>'id' from ceremony_map_versions,jsonb_array_elements(seats) s where state='published' and s->>'row'='E-b1-r01' and s->>'number'='1')),'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(10),'childId',null))));
create temporary table preserved_maps as select * from ceremony_map_versions;
create temporary table preserved_claims as select * from ceremony_seat_claims;
create temporary table preserved_allocations as select * from ceremony_allocations;
create temporary table preserved_nominees as select * from ceremony_nominees;
create temporary table preserved_plan as select * from ceremony_plans;
-- APPLY REAR BLOCK MIGRATION HERE

do $$ declare p uuid; v jsonb; result jsonb; before_revision integer; sid uuid; begin
 select id,revision into p,before_revision from preserved_plan;
 assert (select revision=before_revision+1 from ceremony_plans where id=p);
 assert (select count(*)=9 and sum(capacity)=3540 from ceremony_sectors where plan_id=p);
 assert (select sum(quantity)=3250 from ceremony_quotas where plan_id=p);
 assert (select capacity=740 and assignable_limit=740 from ceremony_sectors where plan_id=p and layout_code='E');
 assert not exists(select 1 from ceremony_sectors where layout_code in ('H1','H2'));
 assert not exists((select * from ceremony_seat_claims except select * from preserved_claims) union all (select * from preserved_claims except select * from ceremony_seat_claims));
 assert not exists((select * from ceremony_allocations except select * from preserved_allocations) union all (select * from preserved_allocations except select * from ceremony_allocations));
 assert not exists((select * from ceremony_nominees except select * from preserved_nominees) union all (select * from preserved_nominees except select * from ceremony_nominees));
 assert (select bool_and(v.seats=old.seats and v.state='archived') from preserved_maps old join ceremony_map_versions v on v.id=old.id);
 select seats into v from ceremony_map_versions where plan_id=p and state='published';
 assert jsonb_array_length(v)=3140;
 assert (select count(*)=290 from jsonb_array_elements(v) s where (s->>'blocked')::boolean);
 assert (select count(*)=740 from jsonb_array_elements(v) s join ceremony_sectors sec on sec.id=(s->>'sectorId')::uuid where sec.layout_code='E');
 assert (select count(*)=140 from jsonb_array_elements(v) s where s->>'row' ~ '^E-b[78]-r0[1-7]$');
 assert (select count(*)=3140 and bool_and(s-'row'-'sectorId'=old_s-'row'-'sectorId') from jsonb_array_elements(v) s join (select jsonb_array_elements(seats) old_s from preserved_maps) old on old_s->>'id'=s->>'id');
 assert not exists(select 1 from jsonb_array_elements(v) s join ceremony_seat_identities i on i.id=(s->>'id')::uuid where i.sector_id<>(s->>'sectorId')::uuid);
 assert (select count(*)=3000 from jsonb_array_elements(v) s join (select jsonb_array_elements(seats) old_s from preserved_maps) old on old_s->>'id'=s->>'id' where s=old_s);
 select id into sid from ceremony_sectors where layout_code='E';
 result:=assign_ceremony_seats(f(1),f(31),p,before_revision,f(9802),jsonb_build_object('action','assign','sectorId',sid,'quantity',1,'seatIds',jsonb_build_array((select s->>'id' from jsonb_array_elements(v) s where s->>'row'='E-b7-r01' and s->>'number'='1')),'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(11),'childId',null))));
 assert result->>'status'='conflict','stale desk must reload';
 result:=assign_ceremony_seats(f(1),f(31),p,before_revision+1,f(9803),jsonb_build_object('action','assign','sectorId',sid,'quantity',1,'seatIds',jsonb_build_array((select s->>'id' from jsonb_array_elements(v) s where s->>'row'='E-b7-r01' and s->>'number'='1')),'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(11),'childId',null))));
 assert result->>'status'='saved','Manager must assign E7 via canonical RPC';
 assert exists(select 1 from jsonb_array_elements(get_my_ceremony_seats(f(1),f(35))) s where s->>'sector'='E' and s->'seat'->>'row'='E-b1-r01');
end $$;
select 'PASS rear conversion: UUIDs/geometry/claims/nominees/E assignments preserved, old map archived, 740 E seats, stale revisions blocked, new rear assignment succeeds';
