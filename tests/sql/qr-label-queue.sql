-- Uses only the disposable runner fixtures. No remote DB.
begin;
reset role;
create temp table label_baseline as select
 (select md5(jsonb_agg(to_jsonb(r) order by id)::text) from registrations r) registrations,
 (select md5(jsonb_agg(to_jsonb(q) order by id)::text) from qr_tokens q) qr,
 (select md5(jsonb_agg(to_jsonb(c) order by id)::text) from check_ins c) attendance;
-- Synthetic token storage prepared before the immutable-operation snapshot.
update qr_tokens set token_encrypted='synthetic-only' where registration_id=f(10);
update label_baseline set qr=(select md5(jsonb_agg(to_jsonb(q) order by id)::text) from qr_tokens q);
insert into groups(id,event_id,name,is_active) values(f(9100),f(1),'Label group',true),(f(9101),f(1),'Label subgroup',true);
update groups set parent_group_id=f(9100) where id=f(9101);
update participant_group_assignments set is_current=false where registration_id in(f(10),f(11),f(12),f(14),f(15));
-- Model retained historical assignments, including a subsequently deleted member.
alter table participant_group_assignments disable trigger user;
insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values
 (f(10),f(9100),true,'manager','confirmed'),(f(11),f(9101),true,'manager','confirmed'),(f(12),f(9100),true,'manager','confirmed'),(f(14),f(9100),true,'manager','confirmed'),(f(15),f(9100),true,'manager','confirmed');
alter table participant_group_assignments enable trigger user;
set local role service_role;
do $$ declare v jsonb; s text; n int; begin
 foreach n in array array[30,31,32,34,35,36,37] loop
  begin perform qr_label_queue(f(1),f(n),'read',f(9100)); raise exception 'Non-admin queue bypass'; exception when insufficient_privilege then null; end;
  begin perform reception_check_in(f(1),f(n),'code','TST1'); raise exception 'Non-admin scanner bypass'; exception when insufficient_privilege then null; end;
 end loop;
 begin perform qr_label_queue(f(2),f(33),'read',null,f(13));raise exception 'Historical event bypass';exception when insufficient_privilege then null;end;
 assert reception_event_check_in('event_entry',f(1),f(33),'code','TST1')->>'status'='valid','Admin scanner failed';
 v:=qr_label_queue(f(1),f(33),'read',f(9100));
 assert jsonb_array_length(v->'items')=4,'Wrong group scope or child QR';
 assert not exists(select 1 from jsonb_array_elements(v->'items') x where x->>'registrationId'=f(11)::text),'Subgroup leaked';
 assert (select count(*)=3 from jsonb_array_elements(v->'items') x where x->>'reason' is not null),'Inactive records silently omitted';
 s:=v->>'snapshot';
 assert qr_label_queue(f(1),f(33),'print',f(9100),null,array[f(10)],'bad',f(9200),'continuous-29x45')->>'status'='conflict';
 assert qr_label_queue(f(1),f(33),'print',f(9100),null,array[f(10)],s,f(9200),'continuous-29x45')->>'status'='claimed';
 assert qr_label_queue(f(1),f(33),'print',f(9100),null,array[f(10)],s,f(9200),'continuous-29x45')->>'status'='replayed';
 assert qr_label_queue(f(1),f(33),'print',f(9100),null,array[f(10)],s,f(9201),'continuous-29x45')->>'status'='conflict';
 v:=qr_label_queue(f(1),f(33),'read',null,f(10));
 assert v->'items'->0->>'state'='prepared' and v->'items'->0->>'attempts'='1';
 assert qr_label_queue(f(1),f(33),'print',null,f(10),array[f(10)],v->>'snapshot',f(9202),'continuous-29x45')->>'status'='conflict','Individual bypassed group deduplication';
 v:=qr_label_queue(f(1),f(33),'outcome',f(9100),null,'{}',null,f(9200),null,'browser_returned');
 assert v->'items'->0 is not null;
 v:=qr_label_queue(f(1),f(33),'read',null,f(10));
 assert v->'items'->0->>'state'='prepared','Browser callback falsely verified physical printing';
 v:=qr_label_queue(f(1),f(33),'verify',null,f(10),array[f(10)],v->>'snapshot');
 assert v->'items'->0->>'state'='verified';
 assert qr_label_queue(f(1),f(33),'reprint',null,f(10),array[f(10)],v->>'snapshot',f(9203),'continuous-29x45')->>'status'='claimed';
 v:=qr_label_queue(f(1),f(33),'read',null,f(10));
 assert v->'items'->0->>'attempts'='2' and v->'items'->0->>'state'='prepared';
 assert (select count(*)=1 from group_badge_items where registration_id=f(10) and artifact='qr_label');
 assert (select jsonb_array_length(manifest)=1 from group_badge_batches where id=f(9203));
 -- The full badge and its ceremony projection remain separate and usable.
 perform group_reception_credential(f(1),f(33),f(9100),'get',repeat('6',64),'synthetic-group');
 s:=reception_group_check_in(f(1),f(33),repeat('6',64))->>'snapshot';
 v:=group_badge_queue(f(1),f(33),repeat('6',64),'create',f(9400),array[f(10)],s);
 assert v->>'status'='queue' and v->>'batchId'=f(9400)::text,'Label attempt shadowed full badge queue';
 v:=group_badge_queue(f(1),f(33),repeat('6',64),'prepare',f(9400),'{}',null,f(10));
 assert v->>'status'='ready' and v ? 'ceremonies','Full badge lost ceremony projection';
 assert (select count(*)=1 from group_badge_items where registration_id=f(10) and artifact='qr_label');

end $$;
reset role;
do $$ declare v jsonb; begin
 update participants set first_name='Changed synthetic' where id=f(20);
 v:=qr_label_queue(f(1),f(33),'read',null,f(10));
 assert qr_label_queue(f(1),f(33),'verify',null,f(10),array[f(10)],v->>'snapshot')->>'status'='conflict','Changed identity falsely verified';
 update participants set first_name='Adult' where id=f(20);
 insert into qr_tokens(registration_id,token_hash,status,created_at) values(f(10),repeat('7',64),'revoked',clock_timestamp()+interval '1 second');
 v:=qr_label_queue(f(1),f(33),'read',null,f(10));
 assert v->'items'->0->>'reason'='revoked';
 assert qr_label_queue(f(1),f(33),'reprint',null,f(10),array[f(10)],v->>'snapshot',f(9204),'continuous-29x45')->>'status'='conflict','Older active QR reused';
 delete from qr_tokens where token_hash=repeat('7',64);
 assert (select registrations=(select md5(jsonb_agg(to_jsonb(r) order by id)::text) from registrations r) from label_baseline);
 assert (select qr=(select md5(jsonb_agg(to_jsonb(q) order by id)::text) from qr_tokens q) from label_baseline);
 assert (select attendance=(select md5(jsonb_agg(to_jsonb(c) order by id)::text) from check_ins c) from label_baseline);
end $$;
-- Complete aggregation beyond PostgREST's default 1,000 rows.
insert into participants(id,first_name,last_name,public_code)
 select f(110000+n),'Synthetic','Label bulk',upper(lpad(to_hex(40000+n),4,'0')) from generate_series(1,1001) n;
insert into registrations(id,event_id,participant_id,status)
 select f(120000+n),f(1),f(110000+n),'confirmed' from generate_series(1,1001) n;
insert into participant_group_assignments(registration_id,group_id,is_current,source,status)
 select f(120000+n),f(9100),true,'manager','confirmed' from generate_series(1,1001) n;
do $$ begin
 assert jsonb_array_length(qr_label_queue(f(1),f(33),'read',f(9100))->'items')=1005,'Label group truncated';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',f(33)::text,true);
do $$ begin
 assert admin_reception_pilot_ready(),'Admin readiness unavailable';
end $$;
select set_config('request.jwt.claim.sub',f(31)::text,true);
do $$ begin
 assert not admin_reception_pilot_ready(),'Readiness leaked to Manager';
 begin perform set_panel_reception_assignment(f(1),f(9999),f(31),'panel_entry',true);raise exception 'Manager assignment bypass';exception when insufficient_privilege then null;end;

 begin perform qr_label_queue(f(1),f(33),'read',null,f(10));raise exception 'Authenticated RPC bypass';exception when insufficient_privilege then null;end;
 begin perform 1 from group_badge_items;raise exception 'Queue table leaked';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'PASS Admin pilot, exact group scope, canonical group/individual deduplication, retry, physical confirmation, QR/identity changes and immutable attendance';
