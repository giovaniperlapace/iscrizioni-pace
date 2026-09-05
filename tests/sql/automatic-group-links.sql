-- Disposable empty PostgreSQL database only; no production data.
create schema app;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
create function app.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create table auth.users(id uuid primary key);
create table public.events(id uuid primary key);
create table public.groups(
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events,
 name text not null, public_label text, is_assignable boolean not null default true,
 is_active boolean default true, node_type text default 'group'
);
create table public.audit_logs(event_id uuid, actor_user_id uuid, action text, entity_table text, entity_id uuid, metadata jsonb);
create table public.group_registration_links(
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events,
 group_id uuid not null references public.groups on delete cascade,
 token_hash text not null unique, token_encrypted text, public_label text, internal_label text,
 created_by uuid references auth.users, created_at timestamptz default now(), updated_at timestamptz default now(),
 expires_at timestamptz, revoked_at timestamptz, revoked_by uuid, max_uses integer, use_count integer default 0
);
\ir ../../supabase/migrations/20260728120000_single_group_registration_link.sql
\ir ../../supabase/migrations/20260728150000_prevent_canonical_group_link_revocation.sql
insert into public.events values ('10000000-0000-4000-8000-000000000001');
insert into public.groups(name,event_id,node_type,is_assignable) values
 ('Structural city','10000000-0000-4000-8000-000000000001','city',false),
 ('Assignable country','10000000-0000-4000-8000-000000000001','country',true),
 ('Existing','10000000-0000-4000-8000-000000000001','group',true),
 ('New group','10000000-0000-4000-8000-000000000001','group',true);
insert into public.group_registration_links(event_id,group_id,token_hash,token_encrypted,expires_at,max_uses)
select event_id,id,encode(extensions.digest('legacy_slug','sha256'),'hex'),'unchanged ciphertext',now()-interval '1 day',1 from public.groups where name='Existing';
\ir ../../supabase/migrations/20260905170000_automatic_group_links.sql

do $$ declare g uuid; l uuid; previous_hash text; begin
 assert (select count(*)=3 from public.group_registration_links), 'backfill count';
 assert not exists(select 1 from public.group_registration_links l join public.groups g on l.group_id=g.id where not g.is_assignable), 'structural node got link';
 assert (select token_encrypted='unchanged ciphertext' and slug is null and expires_at is null and max_uses is null from public.group_registration_links where token_encrypted is not null), 'legacy link rotated or expired';
 assert (select count(*)=2 from public.audit_logs where metadata->>'automatic'='true'), 'backfill audit';
 update public.groups set is_assignable=is_assignable;
 assert (select count(*)=3 from public.group_registration_links), 'idempotency';
 -- Reserved names, duplicate names, accents, non-Latin names, short/long names.
 insert into public.groups(name,event_id) select name,'10000000-0000-4000-8000-000000000001' from unnest(array['Dashboard','Dashboard','Sant’André','Sant’André','Я','AB',repeat('A',180),'legacy slug']) name;
 assert (select count(*)=11 from public.group_registration_links), 'automatic creation missing';
 assert exists(select 1 from public.group_registration_links where slug='dashboard_2'), 'reserved route collision';
 assert exists(select 1 from public.group_registration_links where slug='dashboard_3'), 'duplicate name';
 assert exists(select 1 from public.group_registration_links where slug='legacy_slug_2'), 'legacy encrypted collision';
 assert (select bool_and(app.valid_group_link_slug(slug)) from public.group_registration_links where slug is not null), 'invalid automatic slug';
 select id, token_hash into l, previous_hash from public.group_registration_links where slug='dashboard_2';
 begin
  update public.group_registration_links set slug='dashboard_3',token_hash=encode(extensions.digest('dashboard_3','sha256'),'hex') where id=l;
  raise exception 'collision accepted';
 exception when unique_violation then null; end;
 assert (select token_hash=previous_hash and revoked_at is null from public.group_registration_links where id=l), 'collision damaged existing link';
 begin
  update public.group_registration_links set slug='api',token_hash=encode(extensions.digest('api','sha256'),'hex') where id=l;
  raise exception 'reserved slug accepted';
 exception when check_violation then null; end;
 update public.group_registration_links set public_label='Renamed',slug='updated_slug',token_hash=encode(extensions.digest('updated_slug','sha256'),'hex') where id=l;
 assert (select slug='updated_slug' and public_label='Renamed' and revoked_at is null from public.group_registration_links where id=l), 'slug update';
 begin
  delete from public.group_registration_links where id=l;
  raise exception 'delete allowed';
 exception when raise_exception then assert sqlerrm='A canonical group link cannot be deleted'; end;
 begin
  update public.group_registration_links set is_canonical=false where id=l;
  raise exception 'detach allowed';
 exception when raise_exception then assert sqlerrm='A canonical group link cannot be detached'; end;
 begin
  update public.group_registration_links set expires_at=now() where id=l;
  raise exception 'expiration allowed';
 exception when check_violation then null; end;
 begin
  update public.group_registration_links set max_uses=1 where id=l;
  raise exception 'quota allowed';
 exception when check_violation then null; end;
 begin
  update public.group_registration_links set revoked_at=now() where id=l;
  raise exception 'revocation allowed';
 exception when check_violation then null; end;
 select group_id into g from public.group_registration_links where id=l;
 delete from public.groups where id=g;
 assert not exists(select 1 from public.group_registration_links where id=l), 'group cascade blocked';
 update public.groups set is_assignable=true where name='Structural city';
 assert exists(select 1 from public.group_registration_links l join public.groups g on g.id=l.group_id where g.name='Structural city'), 'promotion missing link';
end $$;

-- Failure of link/audit creation rolls back the whole group insert.
alter table public.audit_logs add constraint test_audit_failure check (action <> 'group_registration_link.created') not valid;
do $$ begin
 begin
  insert into public.groups(name,event_id) values('Must roll back','10000000-0000-4000-8000-000000000001');
  raise exception 'audit failure ignored';
 exception when check_violation then null; end;
 assert not exists(select 1 from public.groups where name='Must roll back'), 'orphan group after failure';
end $$;
alter table public.audit_logs drop constraint test_audit_failure;
select 'PASS automatic links, backfill, collisions, updates, protection, atomic rollback' as result;
