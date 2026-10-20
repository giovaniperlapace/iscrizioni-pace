\ir participant-operations.sql
\ir ../../supabase/migrations/20261020160000_manager_bulk_operations.sql
set role service_role;
select bulk_update_registration_operation(fixture_id(100),array[fixture_id(20),fixture_id(21)],fixture_id(2),'tags',fixture_id(51));
do $$ begin
 assert (select count(*)=2 from participant_operational_tags where tag_id=fixture_id(51)), 'bulk tag missing';
 assert exists(select 1 from participant_operational_tags where participant_id=fixture_id(10) and tag_id=fixture_id(50)), 'existing tag lost';
 assert not has_function_privilege('authenticated','public.bulk_update_registration_operation(uuid,uuid[],uuid,text,uuid)','execute');
 assert not has_function_privilege('anon','public.delete_operational_tag(uuid,uuid,uuid)','execute');
end $$;
select bulk_update_registration_operation(fixture_id(100),array[fixture_id(21),fixture_id(20)],fixture_id(2),'group',fixture_id(30));
select bulk_update_registration_operation(fixture_id(100),array[fixture_id(20),fixture_id(21)],fixture_id(1),'service',fixture_id(40));
do $$ declare actor integer; before_audit integer; begin
 assert (select count(*)=2 from participant_group_assignments where is_current and group_id=fixture_id(30));
 assert (select count(*)=2 from participant_event_services where service_id=fixture_id(40) and status='assigned');
 for actor in 3..6 loop
  begin
   perform bulk_update_registration_operation(fixture_id(100),array[fixture_id(20)],fixture_id(actor),'tags',fixture_id(50));
   raise exception 'unauthorized actor accepted';
  exception when insufficient_privilege then null; end;
  begin
   perform delete_operational_tag(fixture_id(100),fixture_id(50),fixture_id(actor));
   raise exception 'unauthorized deletion accepted';
  exception when insufficient_privilege then null; end;
 end loop;
 select count(*) into before_audit from audit_logs;
 begin
  perform bulk_update_registration_operation(fixture_id(100),array[fixture_id(20),fixture_id(21)],fixture_id(2),'group',fixture_id(32));
  raise exception 'foreign option accepted';
 exception when check_violation then null; end;
 begin
  perform bulk_update_registration_operation(fixture_id(100),array[fixture_id(20),fixture_id(999)],fixture_id(2),'tags',fixture_id(50));
  raise exception 'missing row accepted';
 exception when check_violation then null; end;
 begin
  perform bulk_update_registration_operation(fixture_id(100),array[fixture_id(20),fixture_id(20)],fixture_id(2),'tags',fixture_id(50));
  raise exception 'duplicate ids accepted';
 exception when check_violation then null; end;
 assert (select count(*)=before_audit from audit_logs), 'failed operations wrote audit';
 assert (select count(*)=2 from participant_group_assignments where is_current and group_id=fixture_id(30)), 'failed operation changed rows';
end $$;
-- Recheck role and eligibility on every invocation, including a stale selection.
select public.set_registration_deleted(fixture_id(21),fixture_id(11),fixture_id(1),'Synthetic bulk test',false);
do $$ begin
 begin
  perform bulk_update_registration_operation(fixture_id(100),array[fixture_id(20),fixture_id(21)],fixture_id(2),'tags',fixture_id(50));
  raise exception 'deleted registration accepted';
 exception when check_violation then null; end;
 begin
  perform bulk_update_registration_operation(fixture_id(100),'{}'::uuid[],fixture_id(2),'tags',fixture_id(50));
  raise exception 'empty batch accepted';
 exception when check_violation then null; end;
 begin
  perform bulk_update_registration_operation(fixture_id(100),array(select fixture_id(i) from generate_series(1000,1100) i),fixture_id(2),'tags',fixture_id(50));
  raise exception 'oversized batch accepted';
 exception when check_violation then null; end;
end $$;
select public.set_registration_deleted(fixture_id(21),fixture_id(11),fixture_id(1),'Synthetic bulk test restoration',true);
delete from public.event_user_roles where user_id=fixture_id(2);
do $$ begin
 begin
  perform bulk_update_registration_operation(fixture_id(100),array[fixture_id(20)],fixture_id(2),'tags',fixture_id(50));
  raise exception 'revoked manager accepted';
 exception when insufficient_privilege then null; end;
end $$;
insert into public.event_user_roles(user_id,event_id,role) values(fixture_id(2),fixture_id(100),'manager');
-- A failure in the second single-edit RPC must roll back the first edit and audit.
reset role;
create function public.reject_bulk_second() returns trigger language plpgsql set search_path = public as $$ begin
 if new.participant_id=(select participant_id from registrations where id in (fixture_id(20),fixture_id(21)) order by id desc limit 1) and new.tag_id=fixture_id(50) then raise check_violation; end if; return new;
end $$;
create trigger reject_bulk_second before insert on participant_operational_tags for each row execute function reject_bulk_second();
delete from participant_operational_tags where tag_id=fixture_id(50);
set role service_role;
do $$ declare n integer; begin
 select count(*) into n from audit_logs;
 begin
  perform bulk_update_registration_operation(fixture_id(100),array[fixture_id(20),fixture_id(21)],fixture_id(2),'tags',fixture_id(50));
  raise exception 'failed insert accepted';
 exception when check_violation then null; end;
 assert not exists(select 1 from participant_operational_tags where tag_id=fixture_id(50)), 'partial transaction';
 assert (select count(*)=n from audit_logs), 'partial audit';
end $$;
reset role;
drop trigger reject_bulk_second on participant_operational_tags;
set role service_role;
select delete_operational_tag(fixture_id(100),fixture_id(51),fixture_id(2));
do $$ begin
 assert not exists(select 1 from operational_tags where id=fixture_id(51));
 assert not exists(select 1 from participant_operational_tags where tag_id=fixture_id(51));
 assert exists(select 1 from operational_tags where id=fixture_id(52)), 'foreign tag deleted';
 assert exists(select 1 from audit_logs where action='operational_tag.deleted' and (metadata->>'removed_assignments')::integer=2);
 begin
  perform bulk_update_registration_operation(fixture_id(100),array[fixture_id(20)],fixture_id(2),'tags',fixture_id(51));
  raise exception 'deleted tag assignable';
 exception when check_violation then null; end;
end $$;
reset role;
select 'PASS bulk operations, additive tags, permissions, rollback and tag deletion';
