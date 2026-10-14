-- Synthetic only. No connection to staging, no real admissions.
begin;
reset role;
create function public.ms(actor integer,op text,data jsonb) returns jsonb language sql as $$
 select save_ceremony(f(1),f(actor),'opening',coalesce((select revision from ceremony_plans where event_id=f(1) and kind='opening'),-1),op,data)
$$;
create function public.mm(actor integer,op text,data jsonb,request integer) returns jsonb language sql as $$
 select set_ceremony_map(f(1),f(actor),(select id from ceremony_plans where event_id=f(1) and kind='opening'),(select revision from ceremony_plans where event_id=f(1) and kind='opening'),f(request),op,data)
$$;
create function public.map_seat(i integer,sector integer,row_label text,number_label text,blocked boolean default false) returns jsonb language sql as $$
 select jsonb_build_object('id',f(i),'sectorId',f(sector),'row',row_label,'number',number_label,'x',i%100*60,'y',0,'blocked',blocked)
$$;
insert into groups(id,event_id,name) values(f(9100),f(1),'Map group'),(f(9101),f(1),'Other group');
insert into group_memberships(group_id,user_id,role) values(f(9100),f(36),'capogruppo');
update participant_group_assignments set is_current=false where registration_id=f(10);
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values(f(10),f(9100),true,'manager','confirmed');
delete from event_attendance_choices where registration_id=f(10);
insert into event_attendance_choices(registration_id,day,choice) values(f(10),'2026-10-25','yes');
set local role service_role;
do $$ declare v jsonb;layout jsonb;p uuid;rev integer;n uuid;other_n uuid;total bigint;payload jsonb;begin
 select count(*) into total from check_ins;
 assert ms(33,'configure','{"location":"Synthetic map hall","capacity":4,"startsAt":"2026-10-25T10:00","endsAt":"2026-10-25T11:00","state":"validated","attendancePart":"day"}')->>'status'='saved';
 select id into p from ceremony_plans where event_id=f(1) and kind='opening';
 assert ms(33,'sector',jsonb_build_object('id',f(9110),'name','North','capacity',4))->>'status'='saved';
 assert ms(31,'quota',jsonb_build_object('id',f(9120),'sectorId',f(9110),'category','Guests','quantity',3))->>'status'='saved';
 assert ms(31,'allocate',jsonb_build_object('id',f(9130),'quotaId',f(9120),'groupId',f(9100),'quantity',2))->>'status'='saved';
 assert ms(31,'allocate',jsonb_build_object('id',f(9131),'quotaId',f(9120),'groupId',f(9101),'quantity',1))->>'status'='saved';
 assert set_ceremony_nominee(f(1),f(36),'assign',f(9130),f(10),f(40),null,(select revision from ceremony_plans where id=p),f(9200))->>'status'='saved';
 assert set_ceremony_nominee(f(1),f(36),'no_seat',f(9130),f(10),f(41),null,(select revision from ceremony_plans where id=p),f(9201))->>'status'='saved';
 select id into n from ceremony_nominees where allocation_id=f(9130) and child_id=f(40);
 select id into other_n from ceremony_nominees where allocation_id=f(9130) and child_id=f(41);
 layout:=jsonb_build_array(map_seat(9140,9110,'A','1'),map_seat(9141,9110,'A','2'),map_seat(9142,9110,'A','3'),map_seat(9143,9110,'A','4',true));
 begin perform mm(31,'draft',jsonb_build_object('title','Not admin','seats',layout),9202);raise exception 'manager edits geometry';exception when insufficient_privilege then null;end;
 assert mm(33,'draft',jsonb_build_object('title','Synthetic version','seats',layout),9202)->>'status'='saved';
 v:=get_ceremony_map(f(1),f(33),p,'manager');
 assert v->'active'='null'::jsonb and v->'draft'->>'title'='Synthetic version';
 assert get_ceremony_map(f(1),f(31),p,'manager')->'draft'='null'::jsonb,'manager saw unpublished layout';
 assert mm(33,'publish',jsonb_build_object('versionId',v->'draft'->>'id'),9203)->>'status'='saved';
 assert (select sum(quantity)=3 from ceremony_allocations where plan_id=p and revoked_at is null),'conversion changes quantitative commitments';
 assert (select count(*)=2 from ceremony_nominees where plan_id=p and revoked_at is null),'conversion loses children';
 assert (get_my_ceremony_seats(f(1),f(35))->0->>'mapAvailable')::boolean;
 payload:=jsonb_build_object('allocationId',f(9130),'seatIds',jsonb_build_array(f(9140),f(9141)));
 select revision into rev from ceremony_plans where id=p;
 assert set_ceremony_map(f(1),f(31),p,rev,f(9204),'reserve',payload)->>'status'='saved';
 assert set_ceremony_map(f(1),f(31),p,rev,f(9204),'reserve',payload)->>'status'='saved','retry duplicate';
 begin perform set_ceremony_map(f(1),f(33),p,rev,f(9204),'reserve',payload);raise exception 'foreign replay accepted';exception when invalid_parameter_value then null;end;
 assert (select count(*)=2 from ceremony_seat_claims where plan_id=p and released_at is null);
 assert mm(31,'reserve',jsonb_build_object('allocationId',f(9131),'seatIds',jsonb_build_array(f(9140))),9205)->>'status'='occupied';
 begin perform mm(31,'reserve',jsonb_build_object('allocationId',f(9131),'seatIds',jsonb_build_array(f(9143))),9205);raise exception 'blocked seat reserved';exception when invalid_parameter_value then null;end;
 begin perform mm(32,'reserve',payload,9205);raise exception 'viewer writes';exception when insufficient_privilege then null;end;
 begin perform mm(36,'reserve',payload,9205);raise exception 'leader reserves outside allowance';exception when insufficient_privilege then null;end;
 assert mm(31,'reserve',jsonb_build_object('allocationId',f(9131),'seatIds',jsonb_build_array(f(9142))),9205)->>'status'='saved';
 v:=get_ceremony_map(f(1),f(36),p,'leader');
 assert jsonb_array_length(v->'allocations')=1;
 assert exists(select 1 from jsonb_array_elements(v->'claims') c where c->>'seatId'=f(9142)::text and c->'allocationId'='null'::jsonb),'other allocation exposed';
 begin perform mm(36,'name',jsonb_build_object('allocationId',f(9131),'seatIds',jsonb_build_array(f(9142)),'nomineeId',n),9206);raise exception 'leader crossed group';exception when insufficient_privilege then null;end;
 begin perform mm(36,'name',jsonb_build_object('allocationId',f(9130),'seatIds',jsonb_build_array(f(9140)),'nomineeId',other_n),9206);raise exception 'no-seat child got seat';exception when invalid_parameter_value then null;end;
 assert mm(36,'name',jsonb_build_object('allocationId',f(9130),'seatIds',jsonb_build_array(f(9140)),'nomineeId',n),9206)->>'status'='saved';
 assert app.ceremony_numbered_seat(n)->>'number'='1';
 v:=reception_event_check_in('event_entry',f(1),f(30),'code','TST1');
 assert exists(select 1 from jsonb_array_elements(v->'persons') person cross join lateral jsonb_array_elements(person->'ceremonies') info where person->>'id'=f(40)::text and info->'seat'->>'number'='1'),'reception seat projection missing';
 insert into group_reception_tokens(group_id,token_hash,token_encrypted) values(f(9100),repeat('7',64),'synthetic');
 v:=reception_group_check_in(f(1),f(30),repeat('7',64));
 assert exists(select 1 from jsonb_array_elements(v->'persons') person cross join lateral jsonb_array_elements(person->'ceremonies') info where person->>'id'=f(40)::text and info->'seat'->>'number'='1'),'group seat projection missing';

 assert exists(select 1 from jsonb_array_elements(get_my_ceremony_seats(f(1),f(35))) x where x->'seat'->>'number'='1');
 assert mm(31,'name',jsonb_build_object('allocationId',f(9130),'seatIds',jsonb_build_array(f(9141)),'nomineeId',n),9207)->>'status'='occupied';
 assert mm(31,'release',payload,9207)->>'status'='seats_active';
 begin perform set_ceremony_nominee(f(1),f(31),'revoke',null,null,null,n,(select revision from ceremony_plans where id=p),f(9207));raise exception 'E2 dropped seat';exception when sqlstate 'P1303' then null;end;
 begin perform ms(31,'revoke',jsonb_build_object('id',f(9131)));raise exception 'E1 dropped seats';exception when sqlstate 'P1303' then null;end;
 begin perform ms(31,'quota',jsonb_build_object('id',f(9120),'sectorId',f(9110),'category','Guests','quantity',4));raise exception 'quota exceeded mapped seats';exception when sqlstate 'P1304' then null;end;
 -- Occupied seat cannot be relabeled, even though all quantitative capacity fits.
 assert mm(33,'draft',jsonb_build_object('title','Unsafe relabel','seats',jsonb_set(layout,'{0,number}','"9"')),9207)->>'status'='saved';
 v:=get_ceremony_map(f(1),f(33),p,'manager');
 assert mm(33,'publish',jsonb_build_object('versionId',v->'draft'->>'id'),9208)->>'status'='seats_active';
 assert app.ceremony_numbered_seat(n)->>'number'='1';
 -- Moving coordinates preserves stable identity and every allocation.
 assert mm(33,'draft',jsonb_build_object('title','Moved geometry','seats',jsonb_set(layout,'{0,y}','120')),9208)->>'status'='saved';
 assert mm(33,'publish',jsonb_build_object('versionId',v->'draft'->>'id'),9209)->>'status'='saved';
 assert jsonb_array_length(get_ceremony_map(f(1),f(33),p,'manager')->'history')=1;
 assert app.ceremony_numbered_seat(n)->>'mapVersion'='2';
 begin update ceremony_map_versions set title='mutated' where plan_id=p and state='archived';raise exception 'history mutated';exception when check_violation then null;end;
 -- Explicit unname/release/reassignment; no changes to attendance or budget.
 assert mm(36,'unname',jsonb_build_object('allocationId',f(9130),'seatIds',jsonb_build_array(f(9140))),9210)->>'status'='saved';
 assert mm(36,'name',jsonb_build_object('allocationId',f(9130),'seatIds',jsonb_build_array(f(9141)),'nomineeId',n),9211)->>'status'='saved';
 assert mm(31,'release',jsonb_build_object('allocationId',f(9130),'seatIds',jsonb_build_array(f(9140))),9212)->>'status'='saved';
 assert (select sum(quantity)=3 from ceremony_allocations where plan_id=p and revoked_at is null);
 assert (select count(*)=total from check_ins),'seat operation created admission';
 begin perform get_ceremony_map(f(2),f(31),p,'manager');raise exception 'foreign event';exception when insufficient_privilege then null;end;
 -- Badge preparation reuses the active QR and carries the adult's current seat.
 assert set_ceremony_nominee(f(1),f(31),'assign',f(9130),f(10),null,null,(select revision from ceremony_plans where id=p),f(9220))->>'status'='saved';
 select id into other_n from ceremony_nominees where allocation_id=f(9130) and child_id is null and revoked_at is null;
 assert mm(31,'reserve',jsonb_build_object('allocationId',f(9130),'seatIds',jsonb_build_array(f(9140))),9221)->>'status'='saved';
 assert mm(31,'name',jsonb_build_object('allocationId',f(9130),'seatIds',jsonb_build_array(f(9140)),'nomineeId',other_n),9222)->>'status'='saved';
 update qr_tokens set token_encrypted='synthetic' where registration_id=f(10);
 v:=reception_group_check_in(f(1),f(30),repeat('7',64));
 assert group_badge_queue(f(1),f(30),repeat('7',64),'create',f(9223),array[f(10)],v->>'snapshot')->>'status'='queue';
 v:=group_badge_queue(f(1),f(30),repeat('7',64),'prepare',f(9223),'{}',null,f(10));
 assert v->>'status'='ready' and v->'ceremonies'->0->'seat'->>'number'='1','badge loses canonical seat';
 assert (select count(*)=total from check_ins),'badge created an admission';
 -- Independent closing venue with a map above the PostgREST 1,000 row limit.
 assert save_ceremony(f(1),f(33),'closing',-1,'configure','{"location":"Different synthetic venue","capacity":1501,"startsAt":"2026-10-25T18:00","endsAt":"2026-10-25T19:00","state":"validated","attendancePart":"day"}')->>'status'='saved';
 assert save_ceremony(f(1),f(33),'closing',1,'sector',jsonb_build_object('id',f(9500),'name','Outdoor','capacity',1501))->>'status'='saved';
 select jsonb_agg(map_seat(100000+i,9500,'Outdoor',i::text)) into layout from generate_series(1,1501) i;
 assert set_ceremony_map(f(1),f(33),(select id from ceremony_plans where kind='closing'),2,f(9501),'draft',jsonb_build_object('title','Large synthetic layout','seats',layout))->>'status'='saved';
 assert jsonb_array_length(get_ceremony_map(f(1),f(33),(select id from ceremony_plans where kind='closing'),'manager')->'draft'->'seats')=1501;
 assert (get_ceremony_map(f(1),f(33),p,'manager')->'active'->>'version')::int=2,'closing changed opening';
 -- Role revoked before an identical retry: permission must be checked again.
 delete from event_user_roles where user_id=f(31) and event_id=f(1) and role='manager';
 begin perform set_ceremony_map(f(1),f(31),p,rev,f(9204),'reserve',payload);raise exception 'revoked role replay';exception when insufficient_privilege then null;end;
 assert not exists(select 1 from audit_logs where action like 'ceremony.map_%' and metadata::text ~ 'Synthetic|Guests|North');
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('authenticated','public.set_ceremony_map(uuid,uuid,uuid,integer,uuid,text,jsonb)','execute');
 assert not has_function_privilege('anon','public.get_ceremony_map(uuid,uuid,uuid,text)','execute');
 assert not has_table_privilege('authenticated','public.ceremony_seat_claims','select');
 assert (select bool_and(relrowsecurity) from pg_class where oid in ('ceremony_map_versions'::regclass,'ceremony_seat_identities'::regclass,'ceremony_seat_claims'::regclass,'ceremony_map_requests'::regclass));
end $$;
rollback;
select 'PASS E3 versioning, conversion, child choices, scope, privacy, replay, immutable history, explicit relocation, legacy guards and no admission';
