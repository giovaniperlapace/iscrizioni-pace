begin;
select set_reception_duties(fw(200),fw(11),fw(8),array['opening']);
insert into qr_tokens(id,registration_id,token_hash,created_at) values(fw(8990),fw(107),repeat('d',64),now());
create temp table original_entries as select * from check_ins;
create temp table original_requests as select * from check_in_requests;
create temp table original_audit as select * from audit_logs;
set local role service_role;
do $$ declare v jsonb; begin
 v:=reception_registration_check(fw(200),fw(8),'qr',repeat('d',64));
 assert v->>'status'='valid' and v->'persons'->0->>'firstName'='Synthetic 7';
 assert v->'persons'->0->>'checkedInAt' is null;
 assert jsonb_array_length(v->'persons')=1;
 assert reception_registration_check(fw(200),fw(8),'code','QQQ7')=v;
 assert reception_registration_check(fw(200),fw(8),'qr',repeat('0',64))='{"status":"invalid"}'::jsonb;
 foreach v in array array['10','11','12','1']::jsonb[] loop
  begin perform reception_registration_check(fw(200),fw(v::text::integer),'code','QQQ7');raise exception 'role bypass';exception when insufficient_privilege then null;end;
 end loop;
 begin perform reception_registration_check(fw(201),fw(8),'code','QQQ7');raise exception 'event bypass';exception when insufficient_privilege then null;end;
 assert not has_function_privilege('authenticated','public.reception_registration_check(uuid,uuid,text,text)','execute');
 assert not has_function_privilege('anon','public.reception_registration_check(uuid,uuid,text,text)','execute');
end $$;
reset role;
do $$ begin
 assert not exists((select * from check_ins except select * from original_entries) union all (select * from original_entries except select * from check_ins));
 assert not exists((select * from check_in_requests except select * from original_requests) union all (select * from original_requests except select * from check_in_requests));
 assert not exists((select * from audit_logs except select * from original_audit) union all (select * from original_audit except select * from audit_logs));
end $$;
insert into check_ins(event_id,registration_id,checked_in_by,source) values(fw(200),fw(107),fw(10),'manual');
do $$ begin assert reception_registration_check(fw(200),fw(8),'code','QQQ7')->'persons'->0->>'checkedInAt' is not null;end $$;
update check_ins set cancelled_at=now() where registration_id=fw(107) and moment_id is null;
do $$ begin assert reception_registration_check(fw(200),fw(8),'code','QQQ7')->'persons'->0->>'checkedInAt' is null;end $$;
update qr_tokens set revoked_at=now() where id=fw(8990);
do $$ begin assert reception_registration_check(fw(200),fw(8),'qr',repeat('d',64))='{"status":"invalid"}'::jsonb;end $$;
update qr_tokens set revoked_at=null,expires_at=now()-interval '1 minute' where id=fw(8990);
do $$ begin assert reception_registration_check(fw(200),fw(8),'qr',repeat('d',64))='{"status":"invalid"}'::jsonb;end $$;
update qr_tokens set expires_at=null where id=fw(8990);
insert into qr_tokens(registration_id,token_hash,created_at) values(fw(107),repeat('e',64),now()+interval '1 minute');
do $$ begin assert reception_registration_check(fw(200),fw(8),'qr',repeat('d',64))='{"status":"invalid"}'::jsonb;end $$;
update registrations set deleted_at=now(),deletion_reason='Synthetic verification' where id=fw(107);
do $$ begin assert reception_registration_check(fw(200),fw(8),'qr',repeat('e',64))='{"status":"invalid"}'::jsonb;end $$;
update registrations set deleted_at=null,cancelled_at=now() where id=fw(107);
do $$ begin assert reception_registration_check(fw(200),fw(8),'code','QQQ7')='{"status":"invalid"}'::jsonb;end $$;
select set_reception_duties(fw(200),fw(11),fw(8),'{}',app.reception_duty_keys(fw(200),fw(8)));
do $$ begin
 begin perform reception_registration_check(fw(200),fw(8),'code','QQQ7');raise exception 'revocation bypass';exception when insufficient_privilege then null;end;
end $$;
rollback;
\echo PASS registration verification: read-only snapshots, identity, badge active/revoked, invalid/expired/old QR, deleted/cancelled registration, role/event/ACL/revocation
