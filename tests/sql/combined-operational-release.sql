-- Run as postgres only in an EMPTY disposable database, never in production.
-- Verifies the three migrations together against the existing operational schema.
\ir participant-operations.sql
\ir ../../supabase/migrations/20260617130000_group_registration_links.sql
\ir ../../supabase/migrations/20260922180000_group_deletion.sql
\ir ../../supabase/migrations/20260922190000_operational_registration_additions.sql
\ir ../../supabase/migrations/20260922200000_deleted_registration_email_reuse.sql
grant all on public.group_registration_links to service_role;
update public.events set is_current=false where is_current;
update public.events set is_current=true where id=fixture_id(100);

set role service_role;
select public.add_operational_child(fixture_id(20),fixture_id(4),fixture_id(90),
  '{"first_name":"Added","last_name":"Child","birth_date":"2018-01-01"}');
select public.update_operational_accessibility(fixture_id(20),fixture_id(4),
  public.get_operational_accessibility(fixture_id(20),fixture_id(4)),
  '{"hearing":true,"walkingOrSteps":false,"wheelchairOrMobilityAid":false}');
select public.manage_group_deletion(fixture_id(30),fixture_id(2),true,
  public.manage_group_deletion(fixture_id(30),fixture_id(2))->>'expected');
do $$ begin
  assert exists(select 1 from participants where id=fixture_id(10) and auth_user_id=fixture_id(5));
  assert exists(select 1 from registrations where id=fixture_id(20) and deleted_at is null);
  assert (select count(*)=2 from registration_children where registration_id=fixture_id(20));
  assert not exists(select 1 from participant_group_assignments where group_id=fixture_id(30));
  begin
    perform public.add_operational_child(fixture_id(20),fixture_id(4),fixture_id(91),
      '{"first_name":"Denied","last_name":"Child","birth_date":"2018-01-01"}');
    raise exception 'Former group leader retained child access';
  exception when insufficient_privilege then null; end;
  begin
    perform public.get_operational_accessibility(fixture_id(20),fixture_id(4));
    raise exception 'Former group leader retained accessibility access';
  exception when insufficient_privilege then null; end;
  assert public.get_operational_accessibility(fixture_id(20),fixture_id(2))->'answers'->>'hearing'='true';
end $$;
select public.set_registration_deleted(fixture_id(20),fixture_id(10),fixture_id(2),'Combined release fixture');
do $$ begin
  assert (select auth_user_id is null from participants where id=fixture_id(10));
  assert (select count(*)=2 from registration_children where registration_id=fixture_id(20));
  begin
    perform public.get_operational_accessibility(fixture_id(20),fixture_id(2));
    raise exception 'Deleted registration remained editable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert exists(select 1 from auth.users where id=fixture_id(4));
  assert exists(select 1 from auth.users where id=fixture_id(5));
end $$;
select 'PASS combined migrations: child/accessibility preservation, group scope revocation, deleted identity detachment' as result;
