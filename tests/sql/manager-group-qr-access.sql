-- Disposable PostgreSQL only, after all reception access migrations.
begin;
reset role;
insert into groups(id,event_id,name,is_active) values
 (f(99700),f(1),'Manager QR',true),(f(99701),f(1),'Inactive QR',false),
 (f(99702),f(2),'Foreign QR',true),(f(99703),f(1),'Historical QR',true),
 (f(99704),f(1),'Leader descendant',true);
update groups set parent_group_id=f(99700) where id=f(99704);
insert into group_memberships(group_id,user_id,role) values(f(99700),f(36),'capogruppo');
insert into event_user_roles(event_id,user_id,role) values(f(2),f(37),'manager');
insert into group_reception_tokens(group_id,token_hash,token_encrypted,revoked_at)
 values(f(99703),repeat('7',64),'historical-revoked',now());
set local role service_role;
do $$ declare v jsonb; n int; command text; begin
 v:=group_reception_credential(f(1),f(31),f(99700),'get',repeat('8',64),'manager-original');
 assert v->>'active'='true';
 foreach n in array array[31,33,36] loop
  assert group_reception_credential(f(1),f(n),f(99700),'get',repeat('9',64),'replacement')=v;
  foreach command in array array['revoke','renew','cancel','unknown',null] loop
   begin perform group_reception_credential(f(1),f(n),f(99700),command);raise exception 'Credential management enabled';exception when invalid_parameter_value then null;end;
  end loop;
 end loop;
 assert group_reception_credential(f(1),f(36),f(99704),'get',md5('manager-descendant')||md5('manager-descendant'),'descendant')->>'active'='true';
 foreach n in array array[30,32,34,35,37] loop
  begin perform group_reception_credential(f(1),f(n),f(99700),'get');raise exception 'Unauthorized role accepted';exception when insufficient_privilege then null;end;
 end loop;
 foreach n in array array[99701,99702] loop
  begin perform group_reception_credential(f(1),f(31),f(n),'get');raise exception 'Inactive/foreign group accepted';exception when insufficient_privilege then null;end;
 end loop;
 begin perform group_reception_credential(f(2),f(37),f(99702),'get');raise exception 'Noncurrent event accepted';exception when insufficient_privilege then null;end;
 assert group_reception_credential(f(1),f(31),f(99703),'get',repeat('a',64),'replacement')->>'active'='false';
 assert (select count(*)=1 from audit_logs where entity_id=f(99700) and action='group_qr.create');
 -- New QR permission never grants the group scanner or group-label queue.
 begin perform reception_group_check_in(f(1),f(31),repeat('8',64));raise exception 'Manager scanner enabled';exception when insufficient_privilege then null;end;
 begin perform qr_label_queue(f(1),f(31),'read',f(99700));raise exception 'Manager group printing enabled';exception when insufficient_privilege then null;end;
end $$;
reset role;
delete from event_user_roles where user_id=f(31) and role='manager';
delete from group_memberships where user_id=f(36) and group_id=f(99700);
set local role service_role;
do $$ declare n int; begin
 foreach n in array array[31,36] loop
  begin perform group_reception_credential(f(1),f(n),f(99700),'get');raise exception 'Revoked role retained access';exception when insufficient_privilege then null;end;
 end loop;
end $$;
set local role authenticated;
do $$ begin
 begin perform group_reception_credential(f(1),f(33),f(99700),'get');raise exception 'Forged RPC accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.group_reception_credential(uuid,uuid,uuid,text,text,text)','execute');
 assert not has_function_privilege('authenticated','public.group_reception_credential(uuid,uuid,uuid,text,text,text)','execute');
 assert has_function_privilege('service_role','public.group_reception_credential(uuid,uuid,uuid,text,text,text)','execute');
 assert (select token_hash=repeat('7',64) and token_encrypted='historical-revoked' and revoked_at is not null from group_reception_tokens where group_id=f(99703));
end $$;
rollback;
select 'PASS Manager group QR: event scope, active groups, stable shared credential, role revocation, leader descendants, historical revocation, service-only ACLs and scanner/printing gates';
