-- Disposable PostgreSQL only. Run after the Admin rollout and leader QR migration.
begin;
reset role;
create temp table leader_qr_baseline as select
 (select md5(jsonb_agg(to_jsonb(r) order by id)::text) from registrations r) registrations,
 (select md5(jsonb_agg(to_jsonb(q) order by id)::text) from qr_tokens q) personal_qr,
 (select md5(jsonb_agg(to_jsonb(c) order by id)::text) from check_ins c) attendance;
insert into groups(id,event_id,name,is_active) values
 (f(9600),f(1),'Leader root',true),(f(9601),f(1),'Leader child',true),
 (f(9602),f(1),'Unrelated group',true),(f(9603),f(1),'Inactive group',false),
 (f(9604),f(2),'Other event group',true);
update groups set parent_group_id=f(9600) where id in (f(9601),f(9603));
insert into group_memberships(group_id,user_id,role) values(f(9600),f(36),'capogruppo'),(f(9604),f(36),'capogruppo');
set local role service_role;
do $$ declare v jsonb; n int; begin
 v:=group_reception_credential(f(1),f(36),f(9600),'get',repeat('1',64),'synthetic-root');
 assert v->>'active'='true' and v->>'encrypted'='synthetic-root';
 assert group_reception_credential(f(1),f(36),f(9600),'get',repeat('2',64),'replacement')=v,'Repeated get rotated credential';
 assert group_reception_credential(f(1),f(36),f(9601),'get',repeat('2',64),'synthetic-child')->>'active'='true';
 foreach n in array array[9602,9603,9604] loop
  begin perform group_reception_credential(f(1),f(36),f(n),'get',repeat('3',64),'synthetic');raise exception 'Foreign/inactive group accepted';exception when insufficient_privilege then null;end;
 end loop;
 begin perform group_reception_credential(f(2),f(36),f(9604),'get',repeat('3',64),'synthetic');raise exception 'Other event accepted';exception when insufficient_privilege then null;end;
 foreach n in array array[30,31,32,34,35,37] loop
  begin perform group_reception_credential(f(1),f(n),f(9600),'get');raise exception 'Unassigned role accepted';exception when insufficient_privilege then null;end;
 end loop;
 begin perform group_reception_credential(f(1),f(36),f(9600),'revoke');raise exception 'Leader revoked QR';exception when insufficient_privilege then null;end;
 begin perform group_reception_credential(f(1),f(36),f(9600),'renew',repeat('4',64),'replacement');raise exception 'Leader rotated QR';exception when insufficient_privilege then null;end;
 perform group_reception_credential(f(1),f(33),f(9600),'revoke');
 assert group_reception_credential(f(1),f(36),f(9600),'get')->>'active'='false','Leader revived revoked QR';
 assert group_reception_credential(f(1),f(33),f(9600),'renew',repeat('4',64),'admin-renewed')->>'active'='true';
 begin perform reception_group_check_in(f(1),f(36),repeat('4',64));raise exception 'Leader scanner enabled';exception when insufficient_privilege then null;end;
 begin perform qr_label_queue(f(1),f(36),'read',f(9600));raise exception 'Leader printing enabled';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Actual membership removal must immediately revoke access, including descendants.
delete from group_memberships where group_id=f(9600) and user_id=f(36);
set local role service_role;
do $$ begin
 begin perform group_reception_credential(f(1),f(36),f(9601),'get');raise exception 'Removed leader retained access';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$ begin
 begin perform group_reception_credential(f(1),f(33),f(9600),'get');raise exception 'Forged Admin RPC';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.group_reception_credential(uuid,uuid,uuid,text,text,text)','execute');
 assert not has_function_privilege('authenticated','public.group_reception_credential(uuid,uuid,uuid,text,text,text)','execute');
 assert has_function_privilege('service_role','public.group_reception_credential(uuid,uuid,uuid,text,text,text)','execute');
 assert (select registrations=(select md5(jsonb_agg(to_jsonb(r) order by id)::text) from registrations r)
  and personal_qr=(select md5(jsonb_agg(to_jsonb(q) order by id)::text) from qr_tokens q)
  and attendance=(select md5(jsonb_agg(to_jsonb(c) order by id)::text) from check_ins c) from leader_qr_baseline);
end $$;
rollback;
select 'PASS leader group QR: own/descendant scope, stable token, other roles/events denied, revocation, Admin-only operations, immutable participant data';
