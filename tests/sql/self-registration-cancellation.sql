-- Disposable EMPTY PostgreSQL only. Reuse lifecycle/RLS baseline assertions.
\ir participant-operations.sql
\ir ../../supabase/migrations/20260922200000_deleted_registration_email_reuse.sql
\ir ../../supabase/migrations/20260922210000_self_registration_cancellation.sql
update events set is_current=false;
update events set is_current=true where id=fixture_id(100);
-- Re-arm synthetic recipients for this test, including a delegated unrelated recipient.
update email_campaign_recipients set status='scheduled' where campaign_id=fixture_id(60);
insert into email_campaign_recipients(campaign_id,participant_id,registration_id,recipient_key,recipient_type,delivery_kind,status,delegate_user_id)
values(fixture_id(60),fixture_id(11),fixture_id(21),'unrelated-delegate','participant','delegated','scheduled',fixture_id(5));
set role service_role;
do $$ declare actor uuid; begin
 foreach actor in array array[fixture_id(1),fixture_id(2),fixture_id(3),fixture_id(4),fixture_id(6),null::uuid] loop
  begin
   perform cancel_own_registration(fixture_id(20),actor);
   raise exception 'nonowner accepted';
  exception when insufficient_privilege then null; end;
 end loop;
 begin
  perform cancel_own_registration(fixture_id(999),fixture_id(5));
  raise exception 'missing registration accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update events set is_current=false where id=fixture_id(100);
set role service_role;
do $$ begin
 begin
  perform cancel_own_registration(fixture_id(20),fixture_id(5));
  raise exception 'old event accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update events set is_current=true,registration_closes_at=now()-interval '1 day' where id=fixture_id(100);
-- Cancellation remains available after the editing deadline; audit failure is atomic.
create function fixture_fail_self_cancel() returns trigger language plpgsql as $$ begin
 if new.action='registration.self_cancelled' then raise check_violation; end if; return new;
end $$;
create trigger fixture_fail_self_cancel before insert on audit_logs for each row execute function fixture_fail_self_cancel();
set role service_role;
do $$ begin
 begin
  perform cancel_own_registration(fixture_id(20),fixture_id(5));
  raise exception 'audit failure ignored';
 exception when check_violation then null; end;
 assert (select deleted_at is null from registrations where id=fixture_id(20));
 assert (select status='active' from qr_tokens where token_hash='fixture-active');
 assert (select auth_user_id=fixture_id(5) from participants where id=fixture_id(10));
 assert (select status='scheduled' from email_campaign_recipients where recipient_key='participant:fixture' and campaign_id=fixture_id(60));
end $$;
reset role;
drop trigger fixture_fail_self_cancel on audit_logs;
set role service_role;
select cancel_own_registration(fixture_id(20),fixture_id(5));
select cancel_own_registration(fixture_id(20),fixture_id(5));
do $$ begin
 assert (select deleted_at is not null and deleted_by=fixture_id(5) from registrations where id=fixture_id(20));
 assert (select status='revoked' from qr_tokens where token_hash='fixture-active');
 assert (select auth_user_id is null from participants where id=fixture_id(10));
 assert (select count(*)=1 from audit_logs where action='registration.self_cancelled');
 assert (select count(*)=1 from registration_children where registration_id=fixture_id(20));
 assert (select count(*)=1 from check_ins where registration_id=fixture_id(20));
 assert (select count(*)=4 from event_user_roles);
 assert (select status='skipped' from email_campaign_recipients where campaign_id=fixture_id(60) and registration_id=fixture_id(20));
 assert (select status='scheduled' from email_campaign_recipients where recipient_key='unrelated-delegate');
 assert (select status='sent' from email_campaign_recipients where campaign_id=fixture_id(61));
 begin
  insert into check_ins(registration_id,event_id) values(fixture_id(20),fixture_id(100));
  raise exception 'cancelled check-in accepted';
 exception when check_violation then null; end;
end $$;
reset role;
-- Auth retained; a new identity can use the same account and email, history stays detached.
insert into participant_contacts(participant_id,email) values(fixture_id(10),'self@example.test');
insert into participants(id,auth_user_id,first_name,last_name) values(fixture_id(12),fixture_id(5),'New','Registration');
insert into participant_contacts(participant_id,email) values(fixture_id(12),'self@example.test');
insert into registrations(id,event_id,participant_id) values(fixture_id(23),fixture_id(100),fixture_id(12));
-- Existing live registration in a second event preserves its ownership.
insert into registrations(id,event_id,participant_id) values(fixture_id(24),fixture_id(101),fixture_id(12));
set role service_role;
select cancel_own_registration(fixture_id(23),fixture_id(5));
do $$ begin assert (select auth_user_id=fixture_id(5) from participants where id=fixture_id(12)); end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub',fixture_id(5)::text,false);
do $$ begin
 assert not has_function_privilege('authenticated','public.cancel_own_registration(uuid,uuid)','execute');
 assert not has_function_privilege('anon','public.cancel_own_registration(uuid,uuid)','execute');
 assert has_function_privilege('service_role','public.cancel_own_registration(uuid,uuid)','execute');
 assert not exists(select 1 from registrations where id=fixture_id(20));
 assert not exists(select 1 from registration_children where registration_id=fixture_id(20));
end $$;
reset role;
select 'PASS self cancellation: ownership, current event, audit rollback, idempotency, QR, history, queue scope, email/account reuse, RLS' as result;
