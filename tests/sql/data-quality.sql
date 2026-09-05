-- Only an EMPTY disposable local database. Includes real RLS fixtures.
\ir participant-operations.sql
\ir ../../supabase/migrations/20260615103000_add_participant_public_code.sql
\ir ../../supabase/migrations/20260615180000_store_retrievable_qr_tokens.sql
\ir ../../supabase/migrations/20260702100000_attendance_half_day_slots.sql
\ir ../../supabase/migrations/20260905210000_data_quality_excel.sql
update public.events set is_current=false where is_current;
update public.events set is_current=true where id=fixture_id(100);
set role service_role;
do $$ declare v text; payload jsonb; result jsonb; before_count integer; rid uuid; begin
 v:=public.quality_event_version(fixture_id(100),fixture_id(2));
 payload:=jsonb_build_array(jsonb_build_object('row',2,'firstName','Import','lastName','Fixture','email','import@example.test','phone','+393331234567','birthDate','1990-01-01','status','submitted','consent','si','privacyVersion','fixture','consentDate','2026-01-01','groupId',fixture_id(30),'serviceId',fixture_id(40),'tagIds',jsonb_build_array(fixture_id(50)),'qrHash','import-qr','qrEncrypted','synthetic'));
 select count(*) into before_count from public.registrations;
 begin
  perform public.commit_participant_import(fixture_id(70),fixture_id(100),fixture_id(3),v,'hash',payload,'[]');
  raise exception 'viewer import accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.commit_participant_import(fixture_id(70),fixture_id(100),fixture_id(6),v,'hash',payload,'[]');
  raise exception 'out of scope import accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.commit_participant_import(fixture_id(70),fixture_id(100),fixture_id(2),'stale','hash',payload,'[]');
  raise exception 'stale preview accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.commit_participant_import(fixture_id(70),fixture_id(100),fixture_id(2),v,'hash',payload||jsonb_build_array((payload->0)||jsonb_build_object('email','second@example.test','qrHash','second-qr','serviceId',fixture_id(41))),'[]');
  raise exception 'cross-event service accepted';
 exception when check_violation then null; end;
 assert (select count(*)=before_count from public.registrations),'partial import survived rollback';
 assert not exists(select 1 from public.participants where first_name='Import'),'orphan participant survived rollback';
 assert not exists(select 1 from public.participant_imports where id=fixture_id(70)), 'failed import marked committed';
 result:=public.commit_participant_import(fixture_id(70),fixture_id(100),fixture_id(2),v,'hash',payload,'[{"row":3,"reason":"invalid row"}]');
 assert result->>'imported'='1' and result->>'skipped'='1','bad import result';
 select r.id into rid from public.registrations r join public.participants p on p.id=r.participant_id where p.first_name='Import';
 assert exists(select 1 from public.qr_tokens where registration_id=rid and token_hash='import-qr'),'missing QR';
 assert exists(select 1 from public.participant_consents where registration_id=rid and privacy_version='fixture' and privacy_accepted_at::date='2026-01-01'),'consent fabricated';
 result:=public.commit_participant_import(fixture_id(70),fixture_id(100),fixture_id(2),v,'hash',payload,'[{"row":3,"reason":"invalid row"}]');
 assert result->>'replayed'='true','retry not idempotent';
 assert (select count(*)=before_count+1 from public.registrations),'retry created duplicates';
 begin
  perform public.commit_participant_import(fixture_id(70),fixture_id(100),fixture_id(2),v,'changed-hash',payload,'[]');
  raise exception 'different payload replay accepted';
 exception when check_violation then null; end;
 assert exists(select 1 from public.audit_logs where action='import.row_skipped' and entity_id=fixture_id(70)), 'skip not audited';
end $$;
reset role;
insert into public.participants(id,first_name,last_name,birth_date) values(fixture_id(80),'Merge','Keep','1990-01-01'),(fixture_id(81),'Merge','Lose','1990-01-01');
insert into public.registrations(id,event_id,participant_id) values(fixture_id(82),fixture_id(100),fixture_id(80)),(fixture_id(83),fixture_id(100),fixture_id(81));
insert into public.participant_contacts(participant_id,email) values(fixture_id(81),'merge@example.test');
insert into public.qr_tokens(registration_id,token_hash) values(fixture_id(83),'loser-qr');
insert into public.participant_operational_tags(participant_id,tag_id) values(fixture_id(81),fixture_id(50));
set role service_role;
do $$ declare v text; a uuid:=least(fixture_id(82),fixture_id(83)); b uuid:=greatest(fixture_id(82),fixture_id(83)); begin
 v:=public.quality_event_version(fixture_id(100),fixture_id(2));
 begin
  perform public.review_participant_duplicate(fixture_id(100),fixture_id(3),a,b,'not_duplicate',null,'Different people',v,'a','b');
  raise exception 'viewer decision accepted';
 exception when insufficient_privilege then null; end;
 perform public.review_participant_duplicate(fixture_id(100),fixture_id(2),a,b,'not_duplicate',null,'Different people',v,'a','b');
 assert exists(select 1 from duplicate_reviews where left_id=a and decision='not_duplicate'),'false positive not remembered';
 assert exists(select 1 from audit_logs where action='duplicate.false_positive' and entity_id=a),'false positive not audited';
 v:=public.quality_event_version(fixture_id(100),fixture_id(2));
 perform public.review_participant_duplicate(fixture_id(100),fixture_id(2),a,b,'merged',fixture_id(82),'Verified duplicate',v,'a','b');
 assert exists(select 1 from registrations where id=fixture_id(83) and deleted_at is not null and merged_into_id=fixture_id(82)),'loser not archived and linked';
 assert exists(select 1 from participants where id=fixture_id(81)),'loser identity destroyed';
 assert exists(select 1 from participant_contacts where participant_id=fixture_id(80) and email='merge@example.test'),'missing contact not filled';
 assert exists(select 1 from participant_operational_tags where participant_id=fixture_id(80) and tag_id=fixture_id(50)),'tag not merged';
 assert exists(select 1 from qr_tokens where registration_id=fixture_id(83) and status='revoked'),'loser QR active';
 begin
  perform public.set_registration_deleted(fixture_id(83),fixture_id(81),fixture_id(1),'Restore merge',true);
  raise exception 'merged source restored';
 exception when check_violation then null; end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub',fixture_id(3)::text,false);
do $$ begin
 assert exists(select 1 from public.duplicate_reviews),'scoped viewer cannot read reviews';
 assert not has_function_privilege('authenticated','public.commit_participant_import(uuid,uuid,uuid,text,text,jsonb,jsonb)','execute'),'actor spoofable import';
 assert not has_function_privilege('anon','public.review_participant_duplicate(uuid,uuid,uuid,uuid,text,uuid,text,text,text,text)','execute'),'anonymous merge';
end $$;
select set_config('request.jwt.claim.sub',fixture_id(6)::text,false);
do $$ begin assert not exists(select 1 from public.duplicate_reviews),'other event sees reviews'; assert not exists(select 1 from public.participant_imports),'other event sees imports'; end $$;
reset role;
-- Audit failure rolls back the entire merge, including preliminary field/tag writes.
insert into public.participants(id,first_name,last_name) values(fixture_id(90),'Audit','Keep'),(fixture_id(91),'Audit','Lose');
insert into public.registrations(id,event_id,participant_id) values(fixture_id(92),fixture_id(100),fixture_id(90)),(fixture_id(93),fixture_id(100),fixture_id(91));
insert into public.participant_contacts(participant_id,email) values(fixture_id(91),'rollback@example.test');
create function public.fixture_quality_audit_failure() returns trigger language plpgsql as $$ begin if new.action in ('participant.merged','import.committed') then raise check_violation using message='Fixture audit failure'; end if; return new; end $$;
create trigger fixture_quality_audit_failure before insert on public.audit_logs for each row execute function public.fixture_quality_audit_failure();
set role service_role;
do $$ declare v text; a uuid:=least(fixture_id(92),fixture_id(93)); b uuid:=greatest(fixture_id(92),fixture_id(93)); begin
 v:=public.quality_event_version(fixture_id(100),fixture_id(2));
 begin
  perform public.review_participant_duplicate(fixture_id(100),fixture_id(2),a,b,'merged',fixture_id(92),'Audit rollback',v,'a','b');
  raise exception 'audit failure ignored';
 exception when check_violation then null; end;
 assert exists(select 1 from registrations where id=fixture_id(93) and deleted_at is null and merged_into_id is null),'partial merge survived audit failure';
 assert not exists(select 1 from participant_contacts where participant_id=fixture_id(90)), 'contact copy survived audit failure';
 assert not exists(select 1 from duplicate_reviews where left_id=a),'review survived audit failure';
 begin
  perform public.commit_participant_import(fixture_id(94),fixture_id(100),fixture_id(2),v,'hash','[]','[{"row":2,"reason":"Discarded invalid row"}]');
  raise exception 'import audit failure ignored';
 exception when check_violation then null; end;
 assert not exists(select 1 from participant_imports where id=fixture_id(94)), 'import history survived failed audit';
 assert not exists(select 1 from audit_logs where entity_id=fixture_id(94)), 'partial skip audit survived failed commit';
end $$;
reset role;
drop trigger fixture_quality_audit_failure on public.audit_logs;
-- Account-linked losing records and cross-event pairs are rejected.
update public.participants set auth_user_id=fixture_id(5) where id=fixture_id(91);
set role service_role;
do $$ declare v text; a uuid:=least(fixture_id(92),fixture_id(93)); b uuid:=greatest(fixture_id(92),fixture_id(93)); begin
 v:=public.quality_event_version(fixture_id(100),fixture_id(2));
 begin
  perform public.review_participant_duplicate(fixture_id(100),fixture_id(2),a,b,'merged',fixture_id(92),'Account conflict',v,'a','b');
  raise exception 'account detached';
 exception when check_violation then null; end;
 assert exists(select 1 from participants where id=fixture_id(91) and auth_user_id=fixture_id(5)), 'account link changed';
 begin
  perform public.review_participant_duplicate(fixture_id(101),fixture_id(1),a,b,'merged',fixture_id(92),'Wrong event',public.quality_event_version(fixture_id(101),fixture_id(1)),'a','b');
  raise exception 'cross-event pair accepted';
 exception when no_data_found then null; end;
end $$;
reset role;
-- Import remembers intra-file false positives and preserves pending service state.
set role service_role;
do $$ declare payload jsonb; v text; result jsonb; a uuid; b uuid; begin
 v:=public.quality_event_version(fixture_id(100),fixture_id(2));
 payload:=jsonb_build_array(
  jsonb_build_object('row',2,'firstName','Family','lastName','One','email','family@example.test','phone','','status','submitted','consent','si','privacyVersion','fixture','consentDate','2026-01-01','serviceId',fixture_id(40),'serviceStatus','proposal_pending','qrHash','family-one-qr','qrEncrypted','synthetic','distinctReason','Family shared contact','fingerprint','one','candidates',jsonb_build_array(jsonb_build_object('id','row-3','fingerprint','two'))),
  jsonb_build_object('row',3,'firstName','Family','lastName','Two','email','family@example.test','phone','','status','submitted','consent','si','privacyVersion','fixture','consentDate','2026-01-01','qrHash','family-two-qr','qrEncrypted','synthetic','distinctReason','Family shared contact','fingerprint','two','candidates',jsonb_build_array(jsonb_build_object('id','row-2','fingerprint','one')))
 );
 result:=public.commit_participant_import(fixture_id(95),fixture_id(100),fixture_id(2),v,'family-hash',payload,'[]');
 assert result->>'imported'='2','distinct family not imported';
 select r.id into a from registrations r join participants p on p.id=r.participant_id where p.first_name='Family' and p.last_name='One';
 select r.id into b from registrations r join participants p on p.id=r.participant_id where p.first_name='Family' and p.last_name='Two';
 assert exists(select 1 from duplicate_reviews where left_id=least(a,b) and right_id=greatest(a,b) and decision='not_duplicate'),'intra-file decision not persisted';
 assert exists(select 1 from participant_event_services where registration_id=a and status='proposal_pending' and assigned_at is null),'proposal became assignment';
end $$;
reset role;
