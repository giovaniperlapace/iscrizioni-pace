-- Disposable PostgreSQL only; final schema after the Admin pilot regressions.
begin;
reset role;
insert into groups(id,event_id,name,is_active) values(f(9800),f(1),'Reception access test',true);
insert into group_reception_tokens(group_id,token_hash,token_encrypted) values(f(9800),repeat('5',64),'synthetic');
update participant_group_assignments set is_current=false where registration_id=f(10);
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values(f(10),f(9800),true,'manager','confirmed');
create temp table access_baseline as select
 (select md5(jsonb_agg(to_jsonb(r) order by id)::text) from registrations r) registrations,
 (select md5(jsonb_agg(to_jsonb(q) order by id)::text) from qr_tokens q) qr,
 (select md5(jsonb_agg(to_jsonb(c) order by id)::text) from check_ins c) attendance;
set local role service_role;
do $$ declare actor int; begin
 foreach actor in array array[30,33] loop
  assert reception_event_check_in('event_entry',f(1),f(actor),'code','TST1')->>'status'='valid';
  assert reception_group_check_in(f(1),f(actor),repeat('5',64))->>'status'='valid';
  assert qr_label_queue(f(1),f(actor),'read',null,f(10))->>'status'='queue';
  assert qr_label_queue(f(1),f(actor),'read',f(9800))->>'status'='queue';
  perform group_badge_queue(f(1),f(actor),repeat('5',64),'read');
 end loop;
 foreach actor in array array[31,32,34,35,36,37] loop
  begin perform reception_check_in(f(1),f(actor),'code','TST1');raise exception 'Scanner bypass';exception when insufficient_privilege then null;end;
  begin perform reception_group_check_in(f(1),f(actor),repeat('5',64));raise exception 'Group bypass';exception when insufficient_privilege then null;end;
  begin perform qr_label_queue(f(1),f(actor),'read',null,f(10));raise exception 'Print bypass';exception when insufficient_privilege then null;end;
  begin perform group_badge_queue(f(1),f(actor),repeat('5',64),'read');raise exception 'Badge bypass';exception when insufficient_privilege then null;end;
  begin perform reception_panel_check_in('panel_entry',f(1),f(9999),f(actor),'code','TST1');raise exception 'Panel bypass';exception when insufficient_privilege then null;end;
 end loop;
 begin perform qr_label_queue(f(2),f(30),'read',null,f(13));raise exception 'Foreign event';exception when insufficient_privilege then null;end;
 begin perform app.require_admin_reception_pilot(f(1),f(30));raise exception 'Other Admin features widened';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 assert (select registrations=(select md5(jsonb_agg(to_jsonb(r) order by id)::text) from registrations r) from access_baseline);
 assert (select qr=(select md5(jsonb_agg(to_jsonb(q) order by id)::text) from qr_tokens q) from access_baseline);
 assert (select attendance=(select md5(jsonb_agg(to_jsonb(c) order by id)::text) from check_ins c) from access_baseline);
end $$;
-- Future assignment to an existing Manager is immediately effective.
insert into event_user_roles(user_id,event_id,role) values(f(31),f(1),'accoglienza');
set local role service_role;
do $$ declare v jsonb; s text; begin
 v:=reception_event_check_in('event_entry',f(1),f(31),'code','TST1','enter',f(9810),array[f(10)]);
 assert v->>'status'='valid';
 assert reception_event_check_in('event_entry',f(1),f(31),'code','TST1','enter',f(9810),array[f(10)])->>'outcome'='replayed';
 s:=qr_label_queue(f(1),f(31),'read',f(9800))->>'snapshot';
 assert qr_label_queue(f(1),f(31),'request',f(9800),null,array[f(10)],s,f(9811),'continuous-29x45')->>'status'='claimed';
 assert qr_label_queue(f(1),f(31),'request',f(9800),null,array[f(10)],s,f(9811),'continuous-29x45')->>'status'='replayed';
 assert qr_label_queue(f(1),f(31),'outcome',f(9800),null,'{}',null,f(9811),null,'browser_returned')->>'status'='queue';
 s:=reception_group_check_in(f(1),f(31),repeat('5',64))->>'snapshot';
 assert group_badge_queue(f(1),f(31),repeat('5',64),'create',f(9812),array[f(10)],s)->>'status'='queue';
 assert group_badge_queue(f(1),f(31),repeat('5',64),'prepare',f(9812),'{}',null,f(10))->>'status'='ready';
 assert (select count(*)=1 from audit_logs where actor_user_id=f(31) and metadata->>'request_id'=f(9811)::text and action in ('qr_label.print','qr_label.reprint'));
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',f(31)::text,true);
do $$ begin
 assert reception_ready(),'Cumulative-role readiness';
 assert not admin_reception_pilot_ready(),'Unrelated Admin gate changed';
 begin perform set_panel_reception_assignment(f(1),f(9999),f(31),'panel_entry',true);raise exception 'Assignment management widened';exception when insufficient_privilege then null;end;
 begin perform qr_label_queue(f(1),f(33),'read',null,f(10));raise exception 'Actor forgery';exception when insufficient_privilege then null;end;
 begin perform 1 from group_badge_items;raise exception 'Private queue leaked';exception when insufficient_privilege then null;end;
end $$;
reset role;
delete from event_user_roles where user_id=f(31) and role='accoglienza';
set local role service_role;
do $$ begin
 begin perform reception_event_check_in('event_entry',f(1),f(31),'code','TST1','enter',f(9810),array[f(10)]);raise exception 'Revoked attendance retry';exception when insufficient_privilege then null;end;
 begin perform qr_label_queue(f(1),f(31),'read',f(9800));raise exception 'Revoked print';exception when insufficient_privilege then null;end;
 begin perform group_badge_queue(f(1),f(31),repeat('5',64),'read');raise exception 'Revoked badge';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$ begin assert not reception_ready(),'Revoked readiness';end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.reception_ready()','execute');
 assert not has_function_privilege('authenticated','app.require_reception_operator(uuid,uuid)','execute');
 assert not has_function_privilege('authenticated','public.qr_label_queue(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text)','execute');
end $$;
rollback;
select 'PASS reception operator roles, future cumulative grants, revocation/retry, scanner/group/badge/labels, minimal reads and unchanged Admin management';
