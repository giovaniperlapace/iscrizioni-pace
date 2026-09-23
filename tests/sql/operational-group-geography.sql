-- Disposable PostgreSQL database only; no network, real participants or emails.
create role anon; create role authenticated; create role service_role;
create schema extensions;
create extension unaccent with schema extensions;
create function f(n int) returns uuid language sql immutable as $$ select md5(n::text)::uuid $$;
create table events(id uuid primary key);
create table event_user_roles(user_id uuid,event_id uuid,role text);
create table countries(id uuid primary key default gen_random_uuid(),iso2 text unique,name_it text,name_en text,is_active boolean default true);
create table cities(id uuid primary key default gen_random_uuid(),country_id uuid references countries(id),name text,normalized_name text,is_active boolean default true,unique(country_id,normalized_name));
create table groups(id uuid primary key default gen_random_uuid(),event_id uuid references events(id),name text,public_label text,parent_group_id uuid references groups(id),node_type text default 'group',community_kind text default 'santegidio',age_brackets text[] default '{}',is_assignable boolean default true,is_public_catalog boolean default true,is_active boolean default true,public_order int default 100,country_id uuid references countries(id),city_id uuid references cities(id),primary_leader_name text,updated_at timestamptz default clock_timestamp(),unique(event_id,name));
create table audit_logs(event_id uuid,actor_user_id uuid,action text,entity_table text,entity_id uuid,metadata jsonb);
grant usage on schema public,extensions to service_role;
grant all on all tables in schema public to service_role;
\ir ../../supabase/migrations/20260923180000_operational_group_geography.sql
insert into events values(f(1)),(f(2));
insert into event_user_roles values(f(30),f(1),'manager'),(f(31),f(2),'manager'),(f(32),null,'admin'),(f(33),f(1),'manager_viewer'),(f(34),f(1),'capogruppo'),(f(35),f(1),'admin');
insert into countries values(f(10),'IT','Italia','Italy',true),(f(11),'CU','Cuba','Cuba',true);
insert into cities values(f(12),f(10),'Roma','roma',true),(f(13),f(11),'L’Avana','lavana',true);
create function settings(n text,p uuid default null,t text default 'group') returns jsonb language sql as $$ select jsonb_build_object('name',n,'public_label',n,'parent_group_id',p,'node_type',t,'community_kind','santegidio','age_brackets','[]'::jsonb,'is_assignable',true,'is_public_catalog',true,'is_active',true) $$;
set role service_role;
do $$ declare actor int; g uuid; child uuid; stamp timestamptz; count_before int; begin
 foreach actor in array array[31,33,34,35,40] loop
  begin perform save_operational_group(f(actor),f(1),null,null,settings('Forbidden'),'{}'); raise exception 'scope bypass';
  exception when insufficient_privilege then null; end;
 end loop;
 g := save_operational_group(f(30),f(1),null,null,settings('Italy group'),jsonb_build_object('country_id',f(10)));
 assert exists(select 1 from groups where id=g and country_id=f(10) and city_id is null);
 select updated_at into stamp from groups where id=g;
 perform save_operational_group(f(30),f(1),g,stamp,settings('Italy group'),jsonb_build_object('country_id',f(10),'city_name','Roma','city_normalized_name','roma'));
 assert exists(select 1 from groups where id=g and city_id=f(12));
 assert (select count(*) from cities)=2;
 begin perform save_operational_group(f(30),f(1),g,stamp,settings('stale'),'{}'); raise exception 'stale bypass'; exception when sqlstate 'PT409' then null; end;
 begin perform save_operational_group(f(30),f(1),null,null,settings('wrong city'),jsonb_build_object('country_id',f(10),'city_id',f(13))); raise exception 'city bypass'; exception when sqlstate 'PT422' then null; end;
 begin perform save_operational_group(f(30),f(1),null,null,settings('no country'),jsonb_build_object('city_id',f(12))); raise exception 'country bypass'; exception when sqlstate 'PT422' then null; end;
 child := save_operational_group(f(30),f(1),null,null,settings('inherited',g),'{}');
 assert exists(select 1 from groups where id=child and country_id is null and city_id is null);
 begin perform save_operational_group(f(30),f(1),null,null,settings('conflicting',g),jsonb_build_object('country_id',f(11))); raise exception 'parent bypass'; exception when sqlstate 'PT422' then null; end;
 select updated_at into stamp from groups where id=g;
 begin perform save_operational_group(f(30),f(1),g,stamp,settings('cycle',child),'{}'); raise exception 'cycle bypass'; exception when sqlstate 'PT422' then null; end;
 -- Explicit child city prevents changing the parent to another country.
 perform save_operational_group(f(30),f(1),child,(select updated_at from groups where id=child),settings('inherited',g),jsonb_build_object('city_id',f(12)));
 begin perform save_operational_group(f(30),f(1),g,stamp,settings('Italy group'),jsonb_build_object('country_id',f(11))); raise exception 'descendant bypass'; exception when sqlstate 'PT422' then null; end;
 -- Inactive catalog choices and cross-event parent/edit targets are rejected.
 update countries set is_active=false where id=f(11);
 begin perform save_operational_group(f(30),f(1),null,null,settings('inactive'),jsonb_build_object('country_id',f(11))); raise exception 'inactive bypass'; exception when sqlstate 'PT422' then null; end;
 update countries set is_active=true where id=f(11);
 begin perform save_operational_group(f(32),f(2),g,stamp,settings('wrong event'),'{}'); raise exception 'event bypass'; exception when insufficient_privilege then null; end;
 begin perform save_operational_group(f(32),f(2),null,null,settings('wrong parent',g),'{}'); raise exception 'parent event bypass'; exception when sqlstate 'PT422' then null; end;
 -- Catalog additions and group are atomic, with an audit of the same actor.
 g := save_operational_group(f(32),f(2),null,null,settings('Colombia'),'{"country_code":"CO","country_name_it":"Colombia","country_name_en":"Colombia","city_name":"Bogotá","city_normalized_name":"bogota"}');
 assert exists(select 1 from groups gr join cities c on c.id=gr.city_id join countries co on co.id=gr.country_id where gr.id=g and c.name='Bogotá' and co.iso2='CO');
 assert exists(select 1 from audit_logs where entity_id=g and actor_user_id=f(32) and metadata->'after'->>'name'='Colombia');
 -- Name collision rolls back newly inserted catalog rows and their audits.
 select count(*) into count_before from audit_logs;
 begin perform save_operational_group(f(32),f(2),null,null,settings('Colombia'),'{"country_code":"UG","country_name_it":"Uganda","country_name_en":"Uganda","city_name":"Kampala","city_normalized_name":"kampala"}'); raise exception 'duplicate bypass'; exception when unique_violation then null; end;
 assert not exists(select 1 from countries where iso2='UG');
 assert (select count(*) from audit_logs)=count_before;
 -- Clearing geography is explicit; update timestamp guards stale forms.
 perform save_operational_group(f(32),f(2),g,(select updated_at from groups where id=g),settings('Colombia'),'{}');
 assert exists(select 1 from groups where id=g and country_id is null and city_id is null);
 assert not has_function_privilege('anon','public.save_operational_group(uuid,uuid,uuid,timestamptz,jsonb,jsonb)','execute');
 assert not has_function_privilege('authenticated','public.save_operational_group(uuid,uuid,uuid,timestamptz,jsonb,jsonb)','execute');
end $$;
reset role;
select 'PASS manager/admin scope, wrong country/city, inheritance, cycle, descendant conflict, stale edit, catalog reuse, rollback, audit and grants';
