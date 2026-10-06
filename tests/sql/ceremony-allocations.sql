-- Synthetic P13-E1 checks on the disposable database, after reception fixtures.
begin;
reset role;
create function public.cs(actor integer, kind text, op text, payload jsonb) returns jsonb language sql as $$
 select save_ceremony(f(1),f(actor),kind,coalesce((select revision from ceremony_plans where event_id=f(1) and ceremony_plans.kind=$2),-1),op,payload)
$$;
insert into groups(id,event_id,name,is_active) values(f(8000),f(1),'Ceremony group',true),(f(8001),f(2),'Foreign group',true);
delete from event_attendance_choices where registration_id in(f(10),f(11));
insert into event_attendance_choices(registration_id,day,day_part,choice) values(f(10),'2026-10-25','morning','yes'),(f(11),null,null,'unknown');
set local role service_role;
do $$ declare v jsonb; n integer; q jsonb; c jsonb; rev integer; before_checkins bigint; begin
 select count(*) into before_checkins from check_ins;
 assert get_ceremony(f(1),f(31),'opening')->'plan'='null'::jsonb;
 foreach n in array array[30,34,35,36,37] loop
 begin perform get_ceremony(f(1),f(n),'opening');raise exception 'read bypass';exception when insufficient_privilege then null;end;
 end loop;
 foreach n in array array[31,32] loop
 begin perform cs(n,'opening','configure','{"location":"Draft venue","state":"draft","attendancePart":"day"}');raise exception 'admin bypass';exception when insufficient_privilege then null;end;
 end loop;
 assert cs(33,'opening','configure','{"location":"Opening unknown venue","state":"draft","attendancePart":"day"}')->>'status'='saved';
 v:=get_ceremony(f(1),f(32),'opening');
 assert v->'plan'->'capacity'='null'::jsonb;
 assert (select bool_and(p->>'eligibility'='unknown') from jsonb_array_elements(v->'people') p);
 assert cs(33,'opening','sector',jsonb_build_object('id',f(8100),'name','North','capacity',2))->>'status'='saved';
 assert cs(31,'opening','quota',jsonb_build_object('id',f(8200),'sectorId',f(8100),'category','Delegations','quantity',3))->>'status'='capacity';
 assert cs(31,'opening','quota',jsonb_build_object('id',f(8200),'sectorId',f(8100),'category','Delegations','quantity',2))->>'status'='saved';
 q:=jsonb_build_object('id',f(8300),'quotaId',f(8200),'groupId',f(8000),'quantity',1);
 assert cs(31,'opening','allocate',q)->>'status'='unconfigured';
 assert cs(33,'opening','configure','{"location":"Opening real venue","capacity":2,"startsAt":"2026-10-25T10:00","endsAt":"2026-10-25T11:00","state":"validated","attendancePart":"morning"}')->>'status'='saved';
 -- Closing can have an entirely different place, size, time and sector structure.
 assert cs(33,'closing','configure','{"location":"Closing outdoor venue","capacity":300,"startsAt":"2026-10-27T18:00","endsAt":"2026-10-27T20:00","state":"validated","attendancePart":"afternoon"}')->>'status'='saved';
 assert (select count(distinct m.location_id)=2 from ceremony_plans p join event_moments m on m.id=p.moment_id where p.event_id=f(1));
 assert (select bool_and(not m.is_public and not m.check_in_enabled and m.moment_type='general') from ceremony_plans p join event_moments m on m.id=p.moment_id);
 assert cs(33,'closing','sector',jsonb_build_object('id',f(8101),'name','Square','capacity',300))->>'status'='saved';
 begin perform cs(31,'opening','quota',jsonb_build_object('id',f(8201),'sectorId',f(8101),'category','Cross','quantity',1));raise exception 'cross ceremony sector accepted';exception when invalid_parameter_value then null;end;
 assert cs(31,'opening','allocate',q)->>'status'='saved';
 assert cs(31,'opening','allocate',q)->>'status'='duplicate';
 assert cs(31,'opening','allocate',jsonb_build_object('id',f(8301),'quotaId',f(8200),'registrationId',f(11),'quantity',1))->>'status'='ineligible';
 assert cs(31,'opening','allocate',jsonb_build_object('id',f(8301),'quotaId',f(8200),'registrationId',f(10),'quantity',1))->>'status'='saved';
 assert cs(31,'opening','allocate',jsonb_build_object('id',f(8302),'quotaId',f(8200),'registrationId',f(10),'quantity',1))->>'status'='duplicate';
 assert cs(31,'opening','quota',jsonb_build_object('id',f(8200),'sectorId',f(8100),'category','Delegations','quantity',1))->>'status'='capacity';
 assert cs(33,'opening','sector',jsonb_build_object('id',f(8100),'name','North','capacity',1))->>'status'='capacity';
 assert cs(33,'opening','sector',jsonb_build_object('id',f(8102),'name','South','capacity',1))->>'status'='capacity';
 c:='{"location":"Changed","capacity":2,"startsAt":"2026-10-25T10:00","endsAt":"2026-10-25T11:00","state":"validated","attendancePart":"morning"}';
 assert cs(33,'opening','configure',c)->>'status'='in_use';
 assert get_ceremony(f(1),f(31),'closing')->'plan'->>'capacity'='300';
 assert (select count(*)=before_checkins from check_ins),'allocation recorded admission';
 select revision into rev from ceremony_plans where event_id=f(1) and kind='opening';
 assert save_ceremony(f(1),f(31),'opening',rev-1,'revoke',jsonb_build_object('id',f(8300)))->>'status'='conflict';
 assert cs(31,'opening','revoke',jsonb_build_object('id',f(8300)))->>'status'='saved';
 assert cs(31,'opening','allocate',jsonb_build_object('id',f(8303),'quotaId',f(8200),'groupId',f(8001),'quantity',1))->>'status'='ineligible';
 assert cs(31,'opening','allocate',jsonb_build_object('id',f(8303),'quotaId',f(8200),'groupId',f(8000),'quantity',2))->>'status'='capacity';
 begin perform cs(32,'opening','revoke',jsonb_build_object('id',f(8301)));raise exception 'viewer write bypass';exception when insufficient_privilege then null;end;
 begin perform get_ceremony(f(2),f(33),'opening');raise exception 'archived event allowed';exception when insufficient_privilege then null;end;
 begin update event_moments set capacity=1 where id=(select moment_id from ceremony_plans where kind='opening');raise exception 'legacy editor bypass';exception when insufficient_privilege then null;end;
 begin update event_locations set name='Bypass' where id=(select m.location_id from ceremony_plans p join event_moments m on m.id=p.moment_id where p.kind='opening');raise exception 'legacy location bypass';exception when insufficient_privilege then null;end;
 v:=get_ceremony(f(1),f(31),'opening');assert v::text !~ 'email|birth|phone|token';
 assert (select jsonb_array_length(p->'children')=2 from jsonb_array_elements(v->'people') p where p->>'id'=f(10)::text), 'accompanied children hidden';
end $$;
reset role;
update participant_group_assignments set is_current=false where registration_id=f(10);
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values(f(10),f(8000),true,'manager','confirmed');
do $$ begin assert (get_ceremony(f(1),f(31),'opening')->'allocations'->0->>'review')::boolean, 'group change not flagged';end $$;
update event_attendance_choices set choice='no'  where registration_id=f(10);
set local role service_role;
do $$ declare v jsonb; begin
 v:=get_ceremony(f(1),f(31),'opening');
 assert (v->'allocations'->0->>'review')::boolean;
 assert (select sum(quantity)=1 from ceremony_allocations where revoked_at is null),'released automatically';
 assert app.ceremony_eligibility(f(10),'2026-10-25','day')='absent';
 assert app.ceremony_eligibility(f(11),'2026-10-25','day')='unknown';
end $$;
reset role;
-- Verify the aggregated snapshot does not truncate at the PostgREST row limit.
insert into participants(id,first_name,last_name,public_code) select f(9000+n),'Synthetic','Person '||n,'X'||lpad(upper(to_hex(n)),3,'0') from generate_series(0,1100) n;
insert into registrations(id,event_id,participant_id) select f(10000+n),f(1),f(9000+n) from generate_series(0,1100) n;
do $$ declare v jsonb; begin
 v:=get_ceremony(f(1),f(32),'opening');
 assert jsonb_array_length(v->'people')>=1101;
 assert exists(select 1 from jsonb_array_elements(v->'people') p where p->>'id'=f(11100)::text);
 assert not has_function_privilege('authenticated','public.save_ceremony(uuid,uuid,text,integer,text,jsonb)','execute');
 assert not has_function_privilege('anon','public.get_ceremony(uuid,uuid,text)','execute');
 assert (select count(*)=4 from pg_class where relname in ('ceremony_plans','ceremony_sectors','ceremony_quotas','ceremony_allocations') and relrowsecurity);
end $$;
set local role authenticated;
do $$ begin
 begin perform 1 from ceremony_plans;raise exception 'direct table access';exception when insufficient_privilege then null;end;
 begin perform get_ceremony(f(1),f(33),'opening');raise exception 'forged RPC actor';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS ceremony configuration, independent venues, budgets, scope, review and revocation';
