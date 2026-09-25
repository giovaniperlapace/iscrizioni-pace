-- Disposable empty PostgreSQL only; reuse the real service schema/policy fixture.
create role anon; create role service_role;
\ir leader-service-read-only.sql
alter table participants add column first_name text, add column last_name text;
alter table registrations add column deleted_at timestamptz;
create table audit_logs(event_id uuid,actor_user_id uuid,action text,entity_table text,entity_id uuid,metadata jsonb);
insert into auth.users values(f(31)),(f(33));
\ir ../../supabase/migrations/20260925210000_service_excel_import.sql

update participants set first_name='Anna',last_name='Rossi' where id=f(10);
update participants set first_name='Marco',last_name='Bianchi' where id=f(11);
insert into participants(id,first_name,last_name) values
  (f(12),'Omonimo','Verdi'),(f(13),'Omonimo','Verdi'),
  (f(14),'Eliminato','Rossi'),(f(15),'Estero','Rossi'),
  (f(16),'Conflitto','Rossi'),(f(17),'Léa','D’Angelo'),
  (f(18),'Solo','Esistente'),(f(19),'Solo','Esistente'),(f(20),'Solo','Esistente');
insert into registrations values
  (f(12),f(12),f(1),null),(f(13),f(13),f(1),null),
  (f(14),f(14),f(1),now()),(f(15),f(15),f(2),null),
  (f(16),f(16),f(1),null),(f(17),f(17),f(1),null),
  (f(18),f(18),f(1),null),(f(19),f(19),f(1),now()),(f(20),f(20),f(2),null);
insert into event_services(id,event_id,label,is_active) values
  (f(41),f(1),'Accoglienza',true),(f(42),f(1),'Inattivo',false),(f(43),f(2),'Estero',true);
-- A namesake beyond the REST page cap still prevents any automatic assignment.
insert into participants(id,first_name,last_name)
  select f(1000+i),case when i in (1,1205) then 'Paginato' else 'Fixture '||i end,'Omonimo' from generate_series(1,1205) i;
insert into registrations(id,participant_id,event_id) select f(1000+i),f(1000+i),f(1) from generate_series(1,1205) i;
update participant_event_services set participant_note='Keep participant note',operator_note='Keep operator note',created_by=f(33)
  where participant_id=f(10);
create table protected_snapshot as select
  (select md5(jsonb_agg(to_jsonb(p) order by id)::text) from participants p) people,
  (select md5(jsonb_agg(to_jsonb(r) order by id)::text) from registrations r) registrations,
  (select md5(jsonb_agg(to_jsonb(r))::text) from event_user_roles r) roles;
create function import_row(n int,first_name text,last_name text,service text,error text default '') returns jsonb language sql as $$
  select jsonb_build_object('row',n,'firstName',first_name,'lastName',last_name,'service',service,'error',error)
$$;
create table input_fixture as select jsonb_build_array(
  import_row(2,'  ANNA  ','rossi','accoglienza'),
  import_row(3,'Anna','Rossi','Accoglienza'),
  import_row(4,'Assente','Rossi','Accoglienza'),
  import_row(5,'Omonimo','Verdi','Accoglienza'),
  import_row(6,'Eliminato','Rossi','Accoglienza'),
  import_row(7,'Estero','Rossi','Accoglienza'),
  import_row(8,'Conflitto','Rossi','Accoglienza'),
  import_row(9,'Conflitto','Rossi','Fixture'),
  import_row(10,'Marco','Bianchi','Inattivo'),
  import_row(11,'','Rossi','Accoglienza','nome: obbligatorio'),
  import_row(12,'Léa','D’Angelo','Accoglienza'),
  import_row(13,'Lea','D’Angelo','Accoglienza'),
  import_row(14,'Paginato','Omonimo','Accoglienza'),
  import_row(15,'Solo','Esistente','Accoglienza')
) rows;
do $$ declare result jsonb; actor int; begin
  assert not has_function_privilege('anon','import_participant_services(uuid,uuid,uuid,jsonb)','execute');
  assert not has_function_privilege('authenticated','import_participant_services(uuid,uuid,uuid,jsonb)','execute');
  assert has_function_privilege('service_role','import_participant_services(uuid,uuid,uuid,jsonb)','execute');
  assert not has_table_privilege('authenticated','service_import_runs','select');
  assert (select relrowsecurity from pg_class where oid='service_import_runs'::regclass);
  foreach actor in array array[30,32,34,99] loop
    begin perform import_participant_services(f(500),f(1),f(actor),(select rows from input_fixture));
      raise exception 'permission bypass'; exception when insufficient_privilege then null; end;
  end loop;
  begin perform import_participant_services(f(500),f(2),f(33),(select rows from input_fixture));
    raise exception 'historical event allowed'; exception when insufficient_privilege then null; end;
  result := import_participant_services(f(500),f(1),f(31),(select rows from input_fixture));
  assert (select jsonb_agg(r->>'status') from jsonb_array_elements(result->'rows') r) =
    '["updated","duplicate","not_found","ambiguous","not_found","not_found","conflict","conflict","invalid_service","invalid_row","updated","not_found","ambiguous","updated"]'::jsonb, result::text;
  assert result->'rows'->3->'registrationId'='null'::jsonb, 'ambiguous candidate exposed';
  assert (select service_id=f(41) and participant_note='Keep participant note' and operator_note='Keep operator note' and created_by=f(33)
    and source='manager' and status='assigned' from participant_event_services where participant_id=f(10));
  assert not exists(select 1 from participant_event_services where participant_id in(f(12),f(13),f(14),f(15),f(16)));
  assert (select count(*)=1 from service_import_runs);
  assert (select count(*)=4 from audit_logs);
  assert (import_participant_services(f(500),f(1),f(31),(select rows from input_fixture))->>'replayed')::boolean;
  assert (select count(*)=4 from audit_logs), 'retry changed audit';
  begin perform import_participant_services(f(500),f(1),f(33),(select rows from input_fixture));
    raise exception 'receipt actor bypass'; exception when sqlstate 'PT409' then null; end;
  begin perform import_participant_services(f(500),f(1),f(31),jsonb_build_array(import_row(2,'Anna','Rossi','Fixture')));
    raise exception 'request payload bypass'; exception when sqlstate 'PT409' then null; end;
  result := import_participant_services(f(501),f(1),f(33),jsonb_build_array(import_row(2,'Anna','Rossi','Accoglienza')));
  assert result->'rows'->0->>'status'='unchanged';
  result := import_participant_services(f(502),f(1),f(33),jsonb_build_array(import_row(2,'Marco','Bianchi','Estero')));
  assert result->'rows'->0->>'status'='invalid_service';
  -- Decomposed Unicode matches the same accented spelling; unaccented did not.
  result := import_participant_services(f(503),f(1),f(33),jsonb_build_array(import_row(2,U&'Le\0301a','D’Angelo','Accoglienza')));
  assert result->'rows'->0->>'status'='unchanged';
end $$;
-- Entire batch rolls back when auditing fails after an assignment write.
create function fail_import_audit() returns trigger language plpgsql as $$begin
  if new.action='participant.event_service_imported' then raise exception 'synthetic audit error' using errcode='23514'; end if;
  return new;
end$$;
create trigger fail_import_audit before insert on audit_logs for each row execute function fail_import_audit();
do $$ begin
  begin perform import_participant_services(f(504),f(1),f(31),jsonb_build_array(import_row(2,'Anna','Rossi','Fixture')));
    raise exception 'audit failure ignored'; exception when check_violation then null; end;
  assert (select service_id=f(41) from participant_event_services where participant_id=f(10));
  assert not exists(select 1 from service_import_runs where id=f(504));
end$$;
drop trigger fail_import_audit on audit_logs;
-- Input errors abort before any receipt or write.
do $$ declare input jsonb; begin
  foreach input in array array['{}'::jsonb,'[]'::jsonb,'[null]'::jsonb,
    jsonb_build_array(import_row(1,'Anna','Rossi','Accoglienza')),
    jsonb_build_array(import_row(2,'Anna','Rossi','Accoglienza'),import_row(2,'Marco','Bianchi','Accoglienza')),
    (select jsonb_agg(import_row(i+1,'Anna','Rossi','Accoglienza')) from generate_series(1,501) i)] loop
    begin perform import_participant_services(f(505),f(1),f(31),input);
      raise exception 'invalid input allowed'; exception when invalid_parameter_value then null; end;
  end loop;
  assert (select people=(select md5(jsonb_agg(to_jsonb(p) order by id)::text) from participants p) and
    registrations=(select md5(jsonb_agg(to_jsonb(r) order by id)::text) from registrations r) and
    roles=(select md5(jsonb_agg(to_jsonb(r))::text) from event_user_roles r) from protected_snapshot), 'protected data changed';
end$$;
select 'PASS matching, ambiguity beyond REST cap, deleted/history isolation, service scope, duplicate/conflict, retry, notes, permissions, atomic audit and protected data';
