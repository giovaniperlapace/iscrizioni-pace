-- Disposable database only. The existing fixture also checks RLS, QR and queue lifecycle.
\ir participant-operations.sql
reset role;
-- Exercise migration of an already deleted, account-linked participant.
select set_registration_deleted(fixture_id(20),fixture_id(10),fixture_id(2),'Delete before migration');
\ir ../../supabase/migrations/20260922200000_deleted_registration_email_reuse.sql
do $$ begin
 assert (select auth_user_id is null from participants where id=fixture_id(10));
 assert (select email='fixture@example.test' from participant_contacts where participant_id=fixture_id(10));
 assert exists(select 1 from auth.users where id=fixture_id(5));
 assert not has_function_privilege('authenticated','public.set_registration_deleted(uuid,uuid,uuid,text,boolean)','execute');
end $$;
-- A fresh person can use the historical address; restoring the old one must fail.
insert into participant_contacts(participant_id,email,is_primary) values(fixture_id(11),'fixture@example.test',true);
set role service_role;
do $$ begin
 begin
  perform set_registration_deleted(fixture_id(20),fixture_id(10),fixture_id(1),'Restore after reuse',true);
  raise exception 'restore conflict accepted';
 exception when sqlstate 'PT409' then null; end;
 assert (select deleted_at is not null from registrations where id=fixture_id(20));
 assert (select auth_user_id is null from participants where id=fixture_id(10));
end $$;
-- Releasing the address again allows restoration, but does not silently restore ownership.
select set_registration_deleted(fixture_id(21),fixture_id(11),fixture_id(2),'Release new registration');
select set_registration_deleted(fixture_id(20),fixture_id(10),fixture_id(1),'Restore unused address',true);
update participants set auth_user_id=fixture_id(5) where id=fixture_id(10);
-- A live registration in another event keeps the shared participant account.
insert into registrations(id,event_id,participant_id) values(fixture_id(22),fixture_id(101),fixture_id(10));
select set_registration_deleted(fixture_id(20),fixture_id(10),fixture_id(2),'Delete one of two events');
do $$ begin assert (select auth_user_id=fixture_id(5) from participants where id=fixture_id(10)); end $$;
select set_registration_deleted(fixture_id(22),fixture_id(10),fixture_id(1),'Delete final active event');
do $$ begin
 assert (select auth_user_id is null from participants where id=fixture_id(10));
 assert exists(select 1 from audit_logs where entity_id=fixture_id(10) and action='participant.deleted_identity_detached');
 assert (select count(*)=4 from event_user_roles);
 assert (select count(*)=1 from registration_children where registration_id=fixture_id(20));
 assert (select count(*)=1 from registration_questionnaire_answers where registration_id=fixture_id(20));
end $$;
reset role;
do $$ begin assert exists(select 1 from auth.users where id=fixture_id(5)); end $$;
