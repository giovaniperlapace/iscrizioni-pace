-- New/previously requested labels share one explicit, atomic print job.
begin;
reset role;
insert into groups(id,event_id,name,is_active) values(f(9510),f(1),'Simple label test',true);
update participant_group_assignments set is_current=false where registration_id in(f(10),f(11));
insert into participant_group_assignments(registration_id,group_id,is_current,source,status)
 values(f(10),f(9510),true,'manager','confirmed'),(f(11),f(9510),true,'manager','confirmed');
update qr_tokens set status='active',revoked_at=null,expires_at=null,token_encrypted='synthetic-only' where registration_id in(f(10),f(11));
create temp table simple_label_baseline as select
 (select md5(jsonb_agg(to_jsonb(r) order by id)::text) from registrations r) registrations,
 (select md5(jsonb_agg(to_jsonb(q) order by id)::text) from qr_tokens q) qr,
 (select md5(jsonb_agg(to_jsonb(c) order by id)::text) from check_ins c) attendance;
grant select on simple_label_baseline to service_role;
set local role service_role;
do $$ declare v jsonb; s text; begin
 v:=qr_label_queue(f(1),f(33),'read',null,f(10));
 assert qr_label_queue(f(1),f(33),'print',null,f(10),array[f(10)],v->>'snapshot',f(9601),'continuous-29x45')->>'status'='claimed';
 v:=qr_label_queue(f(1),f(33),'read',f(9510)); s:=v->>'snapshot';
 assert qr_label_queue(f(1),f(33),'request',f(9510),null,array[f(10),f(11)],s,f(9602),'continuous-29x45')->>'status'='claimed';
 assert (select attempts=2 and state='prepared' from group_badge_items where artifact='qr_label' and registration_id=f(10));
 assert (select attempts=1 and state='prepared' from group_badge_items where artifact='qr_label' and registration_id=f(11));
 assert (select jsonb_array_length(manifest)=2 from group_badge_batches where id=f(9602));
 assert (select count(*)=1 from audit_logs where action='qr_label.reprint' and metadata->>'request_id'=f(9602)::text);
 assert (select count(*)=1 from audit_logs where action='qr_label.print' and metadata->>'request_id'=f(9602)::text);
 assert qr_label_queue(f(1),f(33),'request',f(9510),null,array[f(10),f(11)],s,f(9602),'continuous-29x45')->>'status'='replayed';
 assert qr_label_queue(f(1),f(33),'request',f(9510),null,array[f(10),f(11)],s,f(9603),'continuous-29x45')->>'status'='conflict';
 assert not exists(select 1 from group_badge_batches where id=f(9603));
 perform qr_label_queue(f(1),f(33),'outcome',f(9510),null,'{}',null,f(9602),null,'browser_returned');
 assert (select count(*)=2 from group_badge_items where artifact='qr_label' and registration_id in(f(10),f(11)) and state='prepared' and label_outcome='browser_returned');
 assert (select registrations=(select md5(jsonb_agg(to_jsonb(r) order by id)::text) from registrations r) from simple_label_baseline);
 assert (select qr=(select md5(jsonb_agg(to_jsonb(q) order by id)::text) from qr_tokens q) from simple_label_baseline);
 assert (select attendance=(select md5(jsonb_agg(to_jsonb(c) order by id)::text) from check_ins c) from simple_label_baseline);
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.qr_label_queue(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text)','execute');
 assert not has_function_privilege('authenticated','public.qr_label_queue(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text)','execute');
 assert has_function_privilege('service_role','public.qr_label_queue(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text)','execute');
end $$;
rollback;
select 'PASS one mixed print run, existing history/audit, replay, no auto-verification, unchanged registrations/QR/attendance and grants';
