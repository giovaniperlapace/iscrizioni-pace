-- Disposable local database only. Existing merge/import/delete regressions first.
\ir data-quality.sql
\ir ../../supabase/migrations/20261024120000_duplicate_pair_review.sql
insert into public.participants(id,first_name,last_name) values(fixture_id(201),'Review','One'),(fixture_id(202),'Review','Two'),(fixture_id(203),'Unrelated','Person');
insert into public.registrations(id,event_id,participant_id) values(fixture_id(211),fixture_id(100),fixture_id(201)),(fixture_id(212),fixture_id(100),fixture_id(202)),(fixture_id(213),fixture_id(100),fixture_id(203));
set role service_role;
do $$ declare a uuid:=least(fixture_id(211),fixture_id(212)); b uuid:=greatest(fixture_id(211),fixture_id(212)); v text; global_version text; n integer; begin
 v:=public.quality_duplicate_pair_version(fixture_id(100),fixture_id(2),a,b);
 global_version:=public.quality_event_version(fixture_id(100),fixture_id(2));
 update participants set first_name='Changed elsewhere' where id=fixture_id(203);
 assert public.quality_event_version(fixture_id(100),fixture_id(2))<>global_version,'fixture must reproduce old global conflict';
 assert public.quality_duplicate_pair_version(fixture_id(100),fixture_id(2),a,b)=v,'unrelated change invalidated pair';
 perform public.dismiss_participant_duplicate(fixture_id(100),fixture_id(2),a,b,'Different people',v,repeat('a',64),repeat('b',64));
 assert exists(select 1 from duplicate_reviews where left_id=a and right_id=b and decision='not_duplicate'),'decision missing';
 assert (select count(*)=2 from registrations where id in(a,b) and deleted_at is null),'dismissal altered registrations';
 select count(*) into n from audit_logs where entity_id=a and action='duplicate.false_positive';
 perform public.dismiss_participant_duplicate(fixture_id(100),fixture_id(2),a,b,'Different people',v,repeat('a',64),repeat('b',64));
 assert (select count(*)=n from audit_logs where entity_id=a and action='duplicate.false_positive'),'retry duplicated audit';
 update participants set first_name='Actually changed pair' where id=fixture_id(201);
 begin
  perform public.dismiss_participant_duplicate(fixture_id(100),fixture_id(2),a,b,'Changed reason',v,repeat('a',64),repeat('b',64));
  raise exception 'changed pair accepted';
 exception when serialization_failure then null; end;
 v:=public.quality_duplicate_pair_version(fixture_id(100),fixture_id(2),a,b);
 insert into participant_contacts(participant_id,email,is_primary) values(fixture_id(201),'new@example.invalid',true);
 assert v<>public.quality_duplicate_pair_version(fixture_id(100),fixture_id(2),a,b),'new contact missed';
 v:=public.quality_duplicate_pair_version(fixture_id(100),fixture_id(2),a,b);
 begin
  perform public.dismiss_participant_duplicate(fixture_id(100),fixture_id(3),a,b,'Viewer forbidden',v,repeat('a',64),repeat('b',64));
  raise exception 'viewer wrote decision';
 exception when insufficient_privilege then null; end;
 begin
  perform public.quality_duplicate_pair_version(fixture_id(100),fixture_id(6),a,b);
  raise exception 'other manager read pair';
 exception when insufficient_privilege then null; end;
 begin
  perform public.quality_duplicate_pair_version(fixture_id(101),fixture_id(1),a,b);
  raise exception 'wrong event accepted';
 exception when check_violation then null; end;
 begin
  perform public.quality_duplicate_pair_version(fixture_id(100),fixture_id(2),a,a);
  raise exception 'same registration twice';
 exception when check_violation then null; end;
 assert not has_function_privilege('authenticated','public.dismiss_participant_duplicate(uuid,uuid,uuid,uuid,text,text,text,text)','execute'),'client may dismiss';
 assert not has_function_privilege('anon','public.quality_duplicate_pair_version(uuid,uuid,uuid,uuid)','execute'),'anonymous pair read';
end $$;
reset role;
-- Audit errors must roll back the review atomically.
create function public.reject_pair_audit() returns trigger language plpgsql as $$ begin
 if new.action='duplicate.false_positive' and new.metadata->>'reason'='Audit failure' then raise check_violation; end if; return new;
end $$;
create trigger reject_pair_audit before insert on audit_logs for each row execute function public.reject_pair_audit();
set role service_role;
do $$ declare a uuid:=least(fixture_id(211),fixture_id(212)); b uuid:=greatest(fixture_id(211),fixture_id(212)); v text; begin
 v:=public.quality_duplicate_pair_version(fixture_id(100),fixture_id(2),a,b);
 begin
  perform public.dismiss_participant_duplicate(fixture_id(100),fixture_id(2),a,b,'Audit failure',v,repeat('a',64),repeat('b',64));
  raise exception 'audit failure accepted';
 exception when check_violation then null; end;
 assert (select reason='Different people' from duplicate_reviews where left_id=a and right_id=b),'review survived audit failure';
end $$;
reset role;
drop trigger reject_pair_audit on audit_logs;
-- Changes to context shown in the comparison are also stale, not only names.
set role service_role;
do $$ declare a uuid:=least(fixture_id(211),fixture_id(212)); b uuid:=greatest(fixture_id(211),fixture_id(212)); v text; begin
 v:=public.quality_duplicate_pair_version(fixture_id(100),fixture_id(2),a,b);
 insert into registration_children(registration_id,first_name,last_name,birth_date,position)
 values(fixture_id(211),'Child','Synthetic','2016-01-01',1);
 assert v<>public.quality_duplicate_pair_version(fixture_id(100),fixture_id(2),a,b),'new child missed';
 begin
  perform public.set_registration_deleted(fixture_id(211),fixture_id(201),fixture_id(2),'Synthetic deletion');
  perform public.quality_duplicate_pair_version(fixture_id(100),fixture_id(2),a,b);
  raise exception 'deleted pair allowed';
 exception when check_violation then null; end;
 assert (select deleted_at is null from registrations where id=fixture_id(211)),'test deletion not rolled back';
end $$;
reset role;
