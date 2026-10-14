-- P13-E2, entirely synthetic and rolled back.
begin;
reset role;
create function public.cs(actor integer, op text, payload jsonb) returns jsonb language sql as $$
 select save_ceremony(f(1),f(actor),'opening',coalesce((select revision from ceremony_plans where event_id=f(1) and kind='opening'),-1),op,payload)
$$;
create function public.cn(actor integer, action text, allocation integer, registration integer, child integer, nominee uuid, request integer) returns jsonb language sql as $$
 select set_ceremony_nominee(f(1),f(actor),action,f(allocation),f(registration),f(child),nominee,(select revision from ceremony_plans where event_id=f(1) and kind='opening'),f(request))
$$;
insert into groups(id,event_id,name) values(f(8000),f(1),'Parent'),(f(8001),f(1),'Child'),(f(8002),f(1),'Other');
update groups set parent_group_id=f(8000) where id=f(8001);
insert into group_memberships(group_id,user_id,role) values(f(8000),f(36),'capogruppo');
update participant_group_assignments set is_current=false where registration_id in(f(10),f(11));
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values(f(10),f(8001),true,'manager','confirmed'),(f(11),f(8002),true,'manager','confirmed');
delete from event_attendance_choices where registration_id in(f(10),f(11));
insert into event_attendance_choices(registration_id,day,choice) values(f(10),'2026-10-25','yes'),(f(11),'2026-10-25','yes');
set local role service_role;
do $$ declare v jsonb; n uuid; rev integer; total bigint; begin
 select count(*) into total from check_ins;
 assert cs(33,'configure','{"location":"Opening","capacity":10,"startsAt":"2026-10-25T10:00","endsAt":"2026-10-25T11:00","state":"validated","attendancePart":"day"}')->>'status'='saved';
 assert cs(33,'sector',jsonb_build_object('id',f(8100),'name','North','capacity',10))->>'status'='saved';
 assert cs(31,'quota',jsonb_build_object('id',f(8200),'sectorId',f(8100),'category','Guests','quantity',10))->>'status'='saved';
 assert cs(31,'allocate',jsonb_build_object('id',f(8300),'quotaId',f(8200),'groupId',f(8001),'quantity',1))->>'status'='saved';
 assert cs(31,'allocate',jsonb_build_object('id',f(8301),'quotaId',f(8200),'groupId',f(8002),'quantity',2))->>'status'='saved';
 v:=get_ceremony_distribution(f(1),f(36),'leader');
 assert jsonb_array_length(v->'allocations')=1, 'leader must see descendants, not unrelated groups';
 assert jsonb_array_length(v->'people')=1;
 assert jsonb_array_length(v->'people'->0->'children')=2;
 assert jsonb_array_length(get_ceremony_distribution(f(1),f(31),'manager')->'allocations')=2;
 begin perform cn(36,'assign',8301,11,null,null,8400);raise exception 'leader bypass';exception when insufficient_privilege then null;end;
 begin perform cn(32,'assign',8300,10,null,null,8400);raise exception 'viewer bypass';exception when insufficient_privilege then null;end;
 -- Manager assigns a person in an unrelated group from their event view.
 assert cn(31,'assign',8301,11,null,null,8400)->>'status'='saved';
 -- Child takes a seat independently while the parent has none.
 select revision into rev from ceremony_plans where kind='opening';
 assert set_ceremony_nominee(f(1),f(36),'assign',f(8300),f(10),f(40),null,rev,f(8401))->>'status'='saved';
 assert set_ceremony_nominee(f(1),f(36),'assign',f(8300),f(10),f(40),null,rev,f(8401))->>'status'='saved', 'identical retry failed';
 assert (select count(*)=1 from ceremony_nominees where child_id=f(40) and revoked_at is null);
 assert cn(31,'assign',8300,10,40,null,8402)->>'status'='duplicate';
 assert cn(31,'assign',8300,10,null,null,8402)->>'status'='capacity';
 -- The other child explicitly needs no seat, even when the group is full.
 assert cn(31,'no_seat',8300,10,41,null,8402)->>'status'='saved';
 assert (select count(*)=1 from ceremony_nominees where child_id=f(41) and not needs_seat and revoked_at is null);
 assert (select (x->>'used')::integer=1 from jsonb_array_elements(get_ceremony_distribution(f(1),f(36),'leader')->'allocations') x where x->>'id'=f(8300)::text);
 assert jsonb_array_length(get_my_ceremony_seats(f(1),f(35)))=2;
 assert get_my_ceremony_seats(f(1),f(37))='[]'::jsonb;
 begin perform cs(31,'revoke',jsonb_build_object('id',f(8300)));raise exception 'live nominations lost';exception when sqlstate 'P1302' then null;end;
 -- E1 manager direct path shares the same ledger and duplicate protection.
 assert cs(31,'allocate',jsonb_build_object('id',f(8302),'quotaId',f(8200),'registrationId',f(10),'quantity',1))->>'status'='saved';
 assert cn(36,'assign',8300,10,null,null,8403)->>'status'='duplicate';
 begin perform cs(31,'allocate',jsonb_build_object('id',f(8303),'quotaId',f(8200),'registrationId',f(11),'quantity',1));raise exception 'direct/group duplicate';exception when unique_violation then null;end;
 select id into n from ceremony_nominees where child_id=f(40) and revoked_at is null;
 assert cn(36,'revoke',null,null,null,n,8403)->>'status'='saved';
 -- Move direct adult into the group: direct quota is freed, group budget unchanged.
 select id into n from ceremony_nominees where allocation_id=f(8302) and revoked_at is null;
 assert cn(31,'move',8300,null,null,n,8404)->>'status'='saved';
 assert (select revoked_at is not null from ceremony_allocations where id=f(8302));
 assert (select sum(quantity)=3 from ceremony_allocations where revoked_at is null);
 assert (select count(*)=total from check_ins), 'assignment is not admission';
 assert get_ceremony_distribution(f(1),f(36),'leader')::text !~ 'email|phone|birth|token';
end $$;
reset role;
-- Moving group retains the old decision for review and requires explicit release.
update participant_group_assignments set is_current=false where registration_id=f(10);
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values(f(10),f(8002),true,'manager','confirmed');
set local role service_role;
do $$ declare v jsonb;n uuid;begin
 v:=get_ceremony_distribution(f(1),f(36),'leader');
 assert jsonb_array_length(v->'people')=0;
 assert (select bool_and((x->>'review')::boolean) from jsonb_array_elements(v->'nominees') x);
 assert cn(31,'assign',8301,10,null,null,8405)->>'status'='duplicate';
 select id into n from ceremony_nominees where registration_id=f(10) and child_id is null and revoked_at is null;
 assert cn(31,'move',8301,null,null,n,8405)->>'status'='saved';
 assert cn(31,'assign',8301,10,40,null,8406)->>'status'='capacity';
 -- Original leader may still revoke their own no-seat choice after group change.
 select id into n from ceremony_nominees where child_id=f(41) and revoked_at is null;
 assert cn(36,'revoke',null,null,null,n,8406)->>'status'='saved';
 begin perform get_ceremony_distribution(f(2),f(33),'manager');raise exception 'foreign event';exception when insufficient_privilege then null;end;
end $$;
reset role;
delete from group_memberships where user_id=f(36) and group_id=f(8000);
set local role service_role;
do $$ begin
 begin perform get_ceremony_distribution(f(1),f(36),'leader');raise exception 'revoked access';exception when insufficient_privilege then null;end;
 assert not has_function_privilege('authenticated','public.set_ceremony_nominee(uuid,uuid,text,uuid,uuid,uuid,uuid,integer,uuid)','execute');
 assert not has_function_privilege('anon','public.get_my_ceremony_seats(uuid,uuid)','execute');
end $$;
reset role;
-- Complete event lists beyond the API default row limit.
insert into participants(id,first_name,last_name,public_code) select f(15000+n),'Synthetic','Distribution '||n,'D'||lpad(upper(to_hex(n)),3,'0') from generate_series(0,1100) n;
insert into registrations(id,event_id,participant_id) select f(17000+n),f(1),f(15000+n) from generate_series(0,1100) n;
do $$ declare v jsonb; begin
 v:=get_ceremony_distribution(f(1),f(31),'manager');
 assert jsonb_array_length(v->'people')>=1101;
 assert exists(select 1 from jsonb_array_elements(v->'people') x where x->>'registrationId'=f(18100)::text);
end $$;
rollback;
select 'PASS ceremony manager/leader distribution, independent child decisions, shared direct ledger, replay, scope, move and review';
