begin;
reset role;
insert into groups(id,event_id,name,is_active) values
 (f(99800),f(1),'Print group',true),(f(99801),f(1),'Inactive',false),(f(99802),f(2),'Foreign',true),(f(99803),f(1),'Subgroup',true);
update groups set parent_group_id=f(99800) where id=f(99803);
update participant_group_assignments set is_current=false where registration_id in(f(10),f(11));
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values
 (f(10),f(99800),true,'manager','confirmed'),(f(11),f(99803),true,'manager','confirmed');
update qr_tokens set token_encrypted='synthetic-only' where registration_id=f(10);
create temp table print_presence_before as select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') payload from check_ins c;
set local role service_role;
do $$ declare v jsonb; snap text; n int; begin
 foreach n in array array[30,31,33] loop
  assert qr_label_queue(f(1),f(n),'read',f(99800))->>'status'='queue';
 end loop;
 foreach n in array array[32,34,35,36,37] loop
  begin perform qr_label_queue(f(1),f(n),'read',f(99800));raise exception 'Unauthorized print';exception when insufficient_privilege then null;end;
 end loop;
 foreach n in array array[99801,99802] loop
  begin perform qr_label_queue(f(1),f(31),'read',f(n));raise exception 'Foreign or inactive group';exception when insufficient_privilege then null;end;
 end loop;
 begin perform qr_label_queue(f(2),f(31),'read',f(99802));raise exception 'Noncurrent event';exception when insufficient_privilege then null;end;
 begin perform qr_label_queue(f(1),f(31),'read',null,f(10));raise exception 'Generic printing opened';exception when insufficient_privilege then null;end;
 begin perform reception_event_check_in('event_entry',f(1),f(31),'code','TST1');raise exception 'Scanner opened';exception when insufficient_privilege then null;end;
 v:=qr_label_queue(f(1),f(31),'read',f(99800));snap:=v->>'snapshot';
 assert jsonb_array_length(v->'items')=1,'Subgroup leaked';
 begin perform qr_label_queue(f(1),f(31),'request',f(99800),null,array[f(11)],snap,f(99810),'continuous-29x45');raise exception 'Foreign selection';exception when invalid_parameter_value then null;end;
 assert qr_label_queue(f(1),f(31),'request',f(99800),null,array[f(10)],'bad',f(99810),'continuous-29x45')->>'status'='conflict';
 assert qr_label_queue(f(1),f(31),'request',f(99800),null,array[f(10)],snap,f(99810),'continuous-29x45')->>'status'='claimed';
 assert qr_label_queue(f(1),f(31),'request',f(99800),null,array[f(10)],snap,f(99810),'continuous-29x45')->>'status'='replayed';
 begin perform qr_label_queue(f(1),f(33),'outcome',f(99800),null,'{}',null,f(99810),null,'browser_returned');raise exception 'Foreign outcome';exception when insufficient_privilege then null;end;
 assert qr_label_queue(f(1),f(31),'outcome',f(99800),null,'{}',null,f(99810),null,'browser_returned')->>'status'='queue';
end $$;
reset role;
do $$ begin
 assert (select payload=(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from check_ins c) from print_presence_before),'Printing changed attendance';
 assert not has_function_privilege('authenticated','public.qr_label_queue(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text)','execute');
 assert not has_function_privilege('anon','app.qr_label_queue_core(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text)','execute');
end $$;
delete from event_user_roles where user_id=f(31) and role='manager';
set local role service_role;
do $$ begin
 begin perform qr_label_queue(f(1),f(31),'read',f(99800));raise exception 'Revoked read';exception when insufficient_privilege then null;end;
 begin perform qr_label_queue(f(1),f(31),'outcome',f(99800),null,'{}',null,f(99810),null,'browser_returned');raise exception 'Revoked outcome';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'PASS Manager group printing: selection, scope, subgroups, replay, revision, outcomes, revocation, unchanged attendance and scanner gates';
