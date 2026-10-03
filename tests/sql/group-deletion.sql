-- Disposable PostgreSQL only: psql -v ON_ERROR_STOP=1 -f tests/sql/group-deletion.sql
create role anon; create role authenticated; create role service_role;
create schema app;
create function f(n int) returns uuid language sql immutable as $$ select md5(n::text)::uuid $$;
create table events(id uuid primary key);
create table accounts(id uuid primary key, name text);
create table participants(id uuid primary key, account_id uuid references accounts(id), name text);
create table registrations(id uuid primary key,event_id uuid references events(id),participant_id uuid references participants(id),deleted_at timestamptz);
create table qr_tokens(id uuid,registration_id uuid references registrations(id),token text);
create table attendance(registration_id uuid references registrations(id),choice text);
create table children(registration_id uuid references registrations(id),name text);
create table event_user_roles(user_id uuid references accounts(id),event_id uuid,role text);
create table groups(id uuid primary key,event_id uuid references events(id),name text,parent_group_id uuid references groups(id) on delete set null,updated_at timestamptz default now());
create table group_memberships(id uuid primary key,group_id uuid references groups(id) on delete cascade,user_id uuid references accounts(id),role text);
create table group_registration_links(id uuid primary key,group_id uuid references groups(id) on delete cascade,event_id uuid,updated_at timestamptz default now(),is_canonical boolean default true,token_hash text unique,encrypted_token text);
create table group_assignment_rules(id uuid primary key,group_id uuid references groups(id) on delete cascade);
create table participant_group_assignments(id uuid primary key,registration_id uuid references registrations(id),group_id uuid references groups(id) on delete cascade,is_current boolean,escalated_from_group_id uuid references groups(id) on delete set null);
create table audit_logs(event_id uuid,actor_user_id uuid,action text,entity_table text,entity_id uuid,metadata jsonb);
grant usage on schema public to service_role, authenticated, anon;
grant all on all tables in schema public to service_role, authenticated, anon;
\ir ../../supabase/migrations/20260922180000_group_deletion.sql
-- Exercise the actual canonical-link protection installed in production.
create function app.protect_canonical_group_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.is_canonical and exists (select 1 from public.groups where id = old.group_id) then
    if tg_op = 'DELETE' then raise exception 'A canonical group link cannot be deleted'; end if;
    if not new.is_canonical or new.group_id <> old.group_id or new.event_id <> old.event_id then
      raise exception 'A canonical group link cannot be detached';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger protect_canonical_group_link before delete or update
on public.group_registration_links for each row execute function app.protect_canonical_group_link();

insert into events values(f(1)),(f(2));
insert into accounts select f(i),'Account '||i from generate_series(30,40) i;
insert into event_user_roles values(f(30),f(1),'manager'),(f(31),f(2),'manager'),(f(32),null,'admin'),(f(33),f(1),'manager_viewer'),(f(34),f(1),'capogruppo'),(f(35),f(1),'admin');
insert into participants values(f(90),f(34),'Participant unchanged');
insert into registrations values(f(10),f(1),f(90),null),(f(11),f(1),f(90),now());
insert into qr_tokens values(f(100),f(10),'unchanged');
insert into attendance values(f(10),'yes'); insert into children values(f(10),'Child unchanged');
insert into groups(id,event_id,name,parent_group_id) values(f(20),f(1),'Delete me',null),(f(21),f(1),'Keep me',null),(f(22),f(1),'Parent',null),(f(23),f(1),'Child',f(22)),(f(24),f(2),'Other event',null);
insert into group_memberships values(f(50),f(20),f(34),'capogruppo'),(f(51),f(21),f(34),'capogruppo');
insert into group_registration_links(id,group_id,event_id,token_hash,encrypted_token) values(f(60),f(20),f(1),'secret hash','secret encrypted token'),(f(61),f(21),f(1),'other','other');
insert into group_assignment_rules values(f(70),f(20)),(f(71),f(21));
insert into participant_group_assignments values(f(80),f(10),f(20),true,null),(f(81),f(11),f(20),false,null),(f(82),f(11),f(21),true,f(20));
create table preserved as select jsonb_build_array(
 (select jsonb_agg(a) from accounts a), (select jsonb_agg(p) from participants p),
 (select jsonb_agg(r) from registrations r), (select jsonb_agg(q) from qr_tokens q),
 (select jsonb_agg(a) from attendance a), (select jsonb_agg(c) from children c),
 (select jsonb_agg(e) from event_user_roles e)) as snapshot;
grant select on preserved to service_role;
set role service_role;
do $$ declare actor int; preview jsonb; begin
 foreach actor in array array[31,33,34,35,40] loop
  begin perform manage_group_deletion(f(20),f(actor)); raise exception 'scope bypass';
  exception when insufficient_privilege then null; end;
 end loop;
 preview := manage_group_deletion(f(20),f(30));
 assert (preview->>'currentAssignments')::int=1 and (preview->>'assignments')::int=3;
 assert (preview->>'memberships')::int=1 and (preview->>'links')::int=1;
 assert not exists(select 1 from audit_logs);
 begin perform manage_group_deletion(f(20),f(30),true,'stale'); raise exception 'stale bypass';
 exception when sqlstate 'PT409' then null; end;
 -- Every dependent change invalidates confirmation, even when counts stay constant.
 update participant_group_assignments set is_current=false where id=f(80);
 begin perform manage_group_deletion(f(20),f(30),true,preview->>'expected'); raise exception 'assignment race';
 exception when sqlstate 'PT409' then null; end;
 update participant_group_assignments set is_current=true where id=f(80);
 preview := manage_group_deletion(f(20),f(30));
 update group_memberships set user_id=f(36) where id=f(50);
 begin perform manage_group_deletion(f(20),f(30),true,preview->>'expected'); raise exception 'leader race';
 exception when sqlstate 'PT409' then null; end;
 update group_memberships set user_id=f(34) where id=f(50);
 preview := manage_group_deletion(f(22),f(30));
 begin perform manage_group_deletion(f(22),f(30),true,preview->>'expected'); raise exception 'children bypass';
 exception when sqlstate 'P0003' then null; end;
 assert exists(select 1 from groups where id=f(23) and parent_group_id=f(22));
end $$;
-- Failure of audit must roll back every cascade.
reset role;
create function fail_audit() returns trigger language plpgsql as $$ begin raise exception 'synthetic audit failure'; end $$;
create trigger fail_audit before insert on audit_logs for each row execute function fail_audit();
set role service_role;
do $$ begin
 begin perform manage_group_deletion(f(20),f(30),true,manage_group_deletion(f(20),f(30))->>'expected');
  raise exception 'unexpected success';
 exception when raise_exception then assert sqlerrm='synthetic audit failure'; end;
 assert exists(select 1 from groups where id=f(20));
 assert exists(select 1 from participant_group_assignments where id=f(80));
 assert exists(select 1 from group_registration_links where id=f(60));
end $$;
reset role; drop trigger fail_audit on audit_logs; set role service_role;
select manage_group_deletion(f(20),f(30),true,manage_group_deletion(f(20),f(30))->>'expected');
do $$ begin
 assert not exists(select 1 from groups where id=f(20));
 assert not exists(select 1 from participant_group_assignments where group_id=f(20));
 assert exists(select 1 from participant_group_assignments where id=f(82) and group_id=f(21) and is_current and escalated_from_group_id is null);
 assert exists(select 1 from group_memberships where id=f(51));
 assert not exists(select 1 from group_memberships where id=f(50));
 assert exists(select 1 from group_registration_links where id=f(61));
 assert not exists(select 1 from group_registration_links where id=f(60));
 assert (select jsonb_array_length(metadata->'assignments')=3 and jsonb_array_length(metadata->'memberships')=1 from audit_logs where action='group.deleted');
 assert not exists(select 1 from audit_logs where metadata::text like '%secret%');
 assert (select snapshot from preserved) = jsonb_build_array(
 (select jsonb_agg(a) from accounts a), (select jsonb_agg(p) from participants p),
 (select jsonb_agg(r) from registrations r), (select jsonb_agg(q) from qr_tokens q),
 (select jsonb_agg(a) from attendance a), (select jsonb_agg(c) from children c),
 (select jsonb_agg(e) from event_user_roles e));
 begin perform manage_group_deletion(f(20),f(30)); raise exception 'missing bypass';
 exception when no_data_found then null; end;
end $$;
-- Global admin can remove other-event groups; another event's manager cannot.
select manage_group_deletion(f(24),f(32),true,manage_group_deletion(f(24),f(32))->>'expected');
reset role;
do $$ begin
 assert not has_function_privilege('authenticated','public.manage_group_deletion(uuid,uuid,boolean,text)','execute');
 assert not has_function_privilege('anon','public.manage_group_deletion(uuid,uuid,boolean,text)','execute');
 assert not has_table_privilege('authenticated','public.groups','delete');
 assert not has_table_privilege('anon','public.groups','delete');
 assert has_table_privilege('authenticated','public.groups','update');
end $$;
set role authenticated;
do $$ begin
 begin delete from groups where id=f(21); raise exception 'direct delete bypass';
 exception when insufficient_privilege then null; end;
 begin perform manage_group_deletion(f(21),f(32)); raise exception 'direct RPC bypass';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS group deletion: scope, history audit, no person/account/QR/registration changes, atomic rollback, conflicts and grants';

insert into groups(id,event_id,name) values(f(25),f(1),'Large synthetic group');
insert into registrations(id,event_id,participant_id) select f(i),f(1),f(90) from generate_series(1000,2204) i;
insert into participant_group_assignments(id,registration_id,group_id,is_current) select f(10000+i),f(i),f(25),true from generate_series(1000,2204) i;
set role service_role;
do $$ declare p jsonb; begin
 p := manage_group_deletion(f(25),f(30));
 assert (p->>'assignments')::int=1205 and (p->>'currentAssignments')::int=1205;
 perform manage_group_deletion(f(25),f(30),true,p->>'expected');
 assert (select count(*)=1207 from registrations);
 assert (select jsonb_array_length(metadata->'assignments')=1205 from audit_logs where entity_id=f(25));
end $$;
reset role;

-- Removed URLs cannot be reused on another group; unaffected links still work.
do $$ begin
 begin
  insert into group_registration_links(id,group_id,event_id,token_hash) values(f(62),f(21),f(1),'secret hash');
  raise exception 'deleted URL reused';
 exception when unique_violation then null; end;
 begin
  update group_registration_links set token_hash='secret hash' where id=f(61);
  raise exception 'deleted URL reused by update';
 exception when unique_violation then null; end;
 assert exists(select 1 from group_registration_links where id=f(61) and token_hash='other');
 assert not has_table_privilege('authenticated','app.deleted_group_link_tokens','select');
 assert not has_table_privilege('anon','app.deleted_group_link_tokens','insert');
end $$;
