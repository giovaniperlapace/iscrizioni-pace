-- Synthetic group, after reception fixtures; no persistent or remote database.
begin;
reset role;
insert into groups(id,event_id,name,is_active) values(f(2000),f(1),'P13-G synthetic',true),(f(2001),f(1),'P13-G child',true),(f(2002),f(1),'P13-G other',true);
update groups set parent_group_id=f(2000) where id=f(2001);
insert into group_memberships(group_id,user_id) values(f(2000),f(36));
update participant_group_assignments set is_current=false where registration_id in(f(10),f(11));
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values(f(10),f(2000),true,'manager','confirmed'),(f(11),f(2001),true,'manager','confirmed');
set local role service_role;
do $$ declare v jsonb; s text; batch jsonb; n int; begin
 v:=group_reception_credential(f(1),f(36),f(2000),'get',repeat('9',64),'synthetic-encrypted');
 assert (v->>'active')::boolean;
 assert group_reception_credential(f(1),f(36),f(2001),'get',repeat('8',64),'synthetic')->>'active'='true';
 foreach n in array array[30,32,35,37] loop
 begin perform group_reception_credential(f(1),f(n),f(2000),'get',repeat('9',64),'synthetic');raise exception 'credential scope bypass';exception when insufficient_privilege then null;end;
 end loop;
 v:=reception_group_check_in(f(1),f(30),repeat('9',64));
 assert v->>'kind'='group' and jsonb_array_length(v->'persons')=3,'subgroup leaked';
 assert not exists(select 1 from jsonb_array_elements(v->'persons') p where p->>'id'=f(11)::text);
 assert v::text !~ 'email|birth|encrypted|token';
 s:=v->>'snapshot';
 assert reception_group_check_in(f(1),f(30),repeat('9',64),'enter',f(2100),array[f(10)],repeat('0',64))->>'status'='conflict';
 v:=reception_group_check_in(f(1),f(30),repeat('9',64),'correct',f(2101),array[f(40)],s);
 assert v->>'status'='valid';
 assert (select count(*)=1 from check_ins where registration_id=f(10) and moment_id is null and cancelled_at is null);
 assert (select child_id=f(40) from check_ins where registration_id=f(10) and moment_id is null and cancelled_at is null);
 assert reception_group_check_in(f(1),f(30),repeat('9',64),'correct',f(2101),array[f(40)],s)->>'outcome'='replayed';
 begin perform reception_group_check_in(f(1),f(30),repeat('9',64),'correct',f(2101),array[f(10)],s);raise exception 'changed retry accepted';exception when invalid_parameter_value then null;end;
 s:=v->>'snapshot';
 v:=reception_group_check_in(f(1),f(30),repeat('9',64),'enter',f(2102),array[f(10),f(40),f(41)],s);
 assert v->>'status'='valid';
 assert (select count(*)=3 from check_ins where registration_id=f(10) and moment_id is null and cancelled_at is null);
 s:=v->>'snapshot';
 assert reception_group_check_in(f(1),f(30),repeat('9',64),'enter',f(2103),array[f(10)],s)->>'outcome'='unchanged';
 begin perform reception_group_check_in(f(1),f(30),repeat('9',64),'enter',f(2104),array[f(11)],s);raise exception 'foreign member accepted';exception when invalid_parameter_value then null;end;
 foreach n in array array[32,34,35,36,37] loop
 begin perform reception_group_check_in(f(1),f(n),repeat('9',64));raise exception 'operator scope bypass';exception when insufficient_privilege then null;end;
 end loop;
 assert reception_group_check_in(f(1),f(30),repeat('7',64))->>'status'='invalid';
 batch:=group_badge_queue(f(1),f(30),repeat('9',64),'create',f(2200),array[f(10)],s);
 assert batch->>'status'='queue' and jsonb_array_length(batch->'items')=1;
 assert group_badge_queue(f(1),f(30),repeat('9',64),'create',f(2200),array[f(10)],s)=batch;
 assert group_badge_queue(f(1),f(31),repeat('9',64),'read')->>'batchId'=f(2200)::text;
 assert group_badge_queue(f(1),f(30),repeat('9',64),'prepare',f(2200),'{}',null,f(10))->>'status'='qr_unavailable';
end $$;
reset role;
update qr_tokens set token_encrypted='synthetic' where registration_id=f(10);
set local role service_role;
do $$ declare v jsonb; begin
 v:=group_badge_queue(f(1),f(30),repeat('9',64),'prepare',f(2200),'{}',null,f(10));
 assert v->>'status'='ready';
 assert group_badge_queue(f(1),f(30),repeat('9',64),'prepare',f(2200),'{}',null,f(10))->>'status'='already_prepared';
 assert group_badge_queue(f(1),f(30),repeat('9',64),'reprint',f(2200),'{}',null,f(10),0)->>'status'='conflict';
 assert group_badge_queue(f(1),f(30),repeat('9',64),'verify',f(2200),'{}',null,f(10),1)->'items'->0->>'state'='verified';
 assert group_badge_queue(f(1),f(30),repeat('9',64),'reprint',f(2200),'{}',null,f(10),1)->'items'->0->>'state'='pending';
 assert group_badge_queue(f(1),f(30),repeat('9',64),'prepare',f(2200),'{}',null,f(10))->>'status'='ready';
 assert group_badge_queue(f(1),f(30),repeat('9',64),'reprint',f(2200),'{}',null,f(10),1)->>'status'='conflict';
 perform group_reception_credential(f(1),f(36),f(2000),'revoke');
 assert reception_group_check_in(f(1),f(30),repeat('9',64))->>'status'='invalid';
 assert group_badge_queue(f(1),f(30),repeat('9',64),'read')->>'status'='invalid';
end $$;
reset role;
-- Membership change invalidates a confirmed snapshot.
do $$ declare v jsonb; begin
 perform group_reception_credential(f(1),f(36),f(2000),'renew',repeat('9',64),'synthetic');
 v:=reception_group_check_in(f(1),f(30),repeat('9',64));
 update participant_group_assignments set group_id=f(2002) where registration_id=f(10) and is_current;
 assert reception_group_check_in(f(1),f(30),repeat('9',64),'enter',f(2400),array[f(10)],v->>'snapshot')->>'status'='conflict';
 assert group_badge_queue(f(1),f(30),repeat('9',64),'read')->'items'->0->>'available'='false';
 assert group_badge_queue(f(1),f(30),repeat('9',64),'prepare',f(2200),'{}',null,f(10))->>'status'='conflict';
end $$;
set local role authenticated;
do $$ begin
 begin perform reception_group_check_in(f(1),f(30),repeat('9',64));raise exception 'direct RPC bypass';exception when insufficient_privilege then null;end;
 begin perform group_reception_credential(f(1),f(36),f(2000),'get');raise exception 'credential forgery';exception when insufficient_privilege then null;end;
 begin perform group_badge_queue(f(1),f(30),repeat('9',64),'read');raise exception 'queue bypass';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- The RPC aggregates the complete group, beyond PostgREST's default row limit.
insert into participants(id,first_name,last_name,public_code)
 select f(10000+n),'Synthetic','Bulk',upper(lpad(to_hex(4096+n),4,'0')) from generate_series(1,1001) n;
insert into registrations(id,event_id,participant_id,status)
 select f(20000+n),f(1),f(10000+n),'confirmed' from generate_series(1,1001) n;
insert into participant_group_assignments(registration_id,group_id,is_current,source,status)
 select f(20000+n),f(2000),true,'manager','confirmed' from generate_series(1,1001) n;
set local role service_role;
do $$ begin assert jsonb_array_length(reception_group_check_in(f(1),f(30),repeat('9',64))->'persons')=1001,'group truncated at 1000';end $$;
rollback;
select 'PASS P13-G scope, partial/all entry, children, conflict, replay, role/QR revocation and durable badge queue';
