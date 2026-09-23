-- Disposable database only. Also rerun the previous single-city contract first.
\ir operational-group-geography.sql
alter role service_role bypassrls;
\ir ../../supabase/migrations/20260923210000_group_multiple_cities.sql
set role service_role;
do $$ declare g uuid; child uuid; stamp timestamptz; before_links jsonb; before_audit bigint; ids uuid[]; begin
 g := save_operational_group(f(30),f(1),null,null,settings('Regional group'),jsonb_build_object('country_id',f(10),'city_scope','cities','cities',jsonb_build_array(jsonb_build_object('city_id',f(12)),jsonb_build_object('city_name','Perugia','city_normalized_name','perugia'),jsonb_build_object('city_name','Assisi','city_normalized_name','assisi'))));
 assert (select city_id from groups where id=g) is null;
 assert (select count(*) from group_suggestion_cities where group_id=g)=3;
 assert exists(select 1 from audit_logs where entity_id=g and jsonb_array_length(metadata->'after'->'suggestion_city_ids')=3);
 select updated_at into stamp from groups where id=g;
 select jsonb_agg(to_jsonb(x) order by city_id) into before_links from group_suggestion_cities x where group_id=g;
 select count(*) into before_audit from audit_logs;
 -- A wrong-country city later in the list rolls back catalog additions and edits.
 begin
  perform save_operational_group(f(30),f(1),g,stamp,settings('Regional changed'),jsonb_build_object('country_id',f(10),'city_scope','cities','cities',jsonb_build_array(jsonb_build_object('city_name','New synthetic','city_normalized_name','new synthetic'),jsonb_build_object('city_id',f(13)))));
  raise exception 'country mismatch accepted';
 exception when sqlstate 'PT422' then null; end;
 assert not exists(select 1 from cities where name='New synthetic');
 assert (select jsonb_agg(to_jsonb(x) order by city_id) from group_suggestion_cities x where group_id=g)=before_links;
 assert (select count(*) from audit_logs)=before_audit;
 -- Scope and optimistic concurrency cannot be bypassed by the new list.
 begin perform save_operational_group(f(31),f(1),g,stamp,settings('Forbidden'),'{"city_scope":"country","cities":[]}'); raise exception 'scope bypass'; exception when insufficient_privilege then null; end;
 begin perform save_operational_group(f(30),f(1),g,'1900-01-01',settings('Stale'),'{"city_scope":"country","cities":[]}'); raise exception 'stale bypass'; exception when sqlstate 'PT409' then null; end;
 begin perform save_operational_group(f(30),f(1),g,stamp,settings('Old browser'),'{}'); raise exception 'old client erased cities'; exception when sqlstate 'PT409' then null; end;
 -- A national child intentionally stops inherited cities.
 child := save_operational_group(f(30),f(1),null,null,settings('National child',g),'{"city_scope":"country","cities":[]}');
 assert exists(select 1 from groups where id=child and city_id is null and city_scope='country');
 -- A child linked only to an additional city must prevent changing the ancestor country.
 select array_agg(city_id order by city_id) into ids from group_suggestion_cities where group_id=g;
 perform save_operational_group(f(30),f(1),child,(select updated_at from groups where id=child),settings('National child',g),jsonb_build_object('city_scope','cities','cities',jsonb_build_array(jsonb_build_object('city_id',ids[1]),jsonb_build_object('city_id',ids[2]))));
 begin perform save_operational_group(f(30),f(1),g,stamp,settings('Regional group'),jsonb_build_object('country_id',f(11),'city_scope','country','cities','[]'::jsonb)); raise exception 'descendant bypass'; exception when sqlstate 'PT422' then null; end;
 -- Clear a child to inherit, then replace three cities with one, deduplicating aliases.
 perform save_operational_group(f(30),f(1),child,(select updated_at from groups where id=child),settings('National child',g),'{"city_scope":"inherit","cities":[]}');
 assert not exists(select 1 from group_suggestion_cities where group_id=child);
 perform save_operational_group(f(30),f(1),g,stamp,settings('Regional group'),jsonb_build_object('country_id',f(10),'city_scope','cities','cities',jsonb_build_array(jsonb_build_object('city_id',f(12)),jsonb_build_object('city_name','Roma','city_normalized_name','roma'))));
 assert not exists(select 1 from group_suggestion_cities where group_id=g);
 assert (select city_id from groups where id=g)=f(12);
 -- Empty or contradictory scopes are never interpreted as country-wide.
 begin perform save_operational_group(f(30),f(1),null,null,settings('empty'),'{"city_scope":"cities","cities":[]}'); raise exception 'empty bypass'; exception when invalid_parameter_value then null; end;
 begin perform save_operational_group(f(30),f(1),null,null,settings('contradictory'),jsonb_build_object('city_scope','country','cities',jsonb_build_array(jsonb_build_object('city_id',f(12))))); raise exception 'scope bypass'; exception when invalid_parameter_value then null; end;
 assert not has_table_privilege('anon','public.group_suggestion_cities','select');
 assert not has_table_privilege('authenticated','public.group_suggestion_cities','insert');
 assert not has_function_privilege('authenticated','public.save_operational_group(uuid,uuid,uuid,timestamptz,jsonb,jsonb)','execute');
end $$;
reset role;
select 'PASS multi-city save/replacement/inheritance/national scope/audit/rollback/scope/stale';
