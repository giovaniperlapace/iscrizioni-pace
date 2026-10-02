-- Run only in a disposable local PostgreSQL database.
\ir assisted-demographics.sql
\ir ../../supabase/migrations/20261002140000_operational_association.sql
update registration_questionnaire_answers set answers=answers || '{"externalGroupAssociation":"Originale","hasPreviousSantegidioParticipation":false,"participatesWithGroup":false}' where registration_id=f(10);
do $$ declare original jsonb; result jsonb; actor int; before_answers jsonb; begin
 original:=get_operational_association(f(10),f(30));
 assert original->>'association'='Originale';
 foreach actor in array array[31,33,40,41,42,99] loop
  begin perform get_operational_association(f(10),f(actor));raise exception 'read bypass';exception when insufficient_privilege then null;end;
  begin perform update_operational_association(f(10),f(actor),original,'Unauthorized');raise exception 'write bypass';exception when insufficient_privilege then null;end;
 end loop;
 begin perform get_operational_association(f(12),f(32));raise exception 'deleted bypass';exception when insufficient_privilege then null;end;
 begin perform get_operational_association(f(11),f(32));raise exception 'past event bypass';exception when insufficient_privilege then null;end;
 select answers-'externalGroupAssociation' into before_answers from registration_questionnaire_answers where registration_id=f(10);
 result:=update_operational_association(f(10),f(30),original,'  Comunità di Sant’Egidio  ');
 assert result->>'association'='Comunità di Sant’Egidio';
 assert (select answers-'externalGroupAssociation'=before_answers from registration_questionnaire_answers where registration_id=f(10));
 begin perform update_operational_association(f(10),f(32),original,'Stale');raise exception 'stale bypass';exception when sqlstate 'PT409' then null;end;
 begin perform update_operational_association(f(10),f(32),result,repeat('x',201));raise exception 'length bypass';exception when invalid_parameter_value then null;end;
 result:=update_operational_association(f(10),f(32),result,'');assert result->>'association' is null;
 assert not exists(select 1 from audit_logs where metadata::text like '%Comunità%');
 assert not has_function_privilege('authenticated','update_operational_association(uuid,uuid,jsonb,text)','execute');
 assert not has_function_privilege('anon','get_operational_association(uuid,uuid)','execute');
 assert has_function_privilege('service_role','get_operational_association(uuid,uuid)','execute');
end $$;
-- A missing questionnaire is created without populating unrelated answers.
delete from registration_questionnaire_answers where registration_id=f(10);
do $$ declare snapshot jsonb; begin
 snapshot:=get_operational_association(f(10),f(30));assert snapshot->>'questionnaireId' is null;
 perform update_operational_association(f(10),f(30),snapshot,'Nuova associazione');
 assert (select answers='{"externalGroupAssociation":"Nuova associazione"}'::jsonb from registration_questionnaire_answers where registration_id=f(10));
end $$;
create function fail_association_audit() returns trigger language plpgsql as $$begin if new.action='registration.association_updated' then raise exception 'audit unavailable';end if;return new;end$$;
create trigger fail_association_audit before insert on audit_logs for each row execute function fail_association_audit();
do $$ declare snapshot jsonb; begin
 snapshot:=get_operational_association(f(10),f(30));
 begin perform update_operational_association(f(10),f(30),snapshot,'Must rollback');raise exception 'missing audit failure';exception when raise_exception then assert sqlerrm='audit unavailable';end;
 assert get_operational_association(f(10),f(30))=snapshot;
end $$;
select 'PASS association scope, update, clearing, preservation, conflict and audit rollback';
