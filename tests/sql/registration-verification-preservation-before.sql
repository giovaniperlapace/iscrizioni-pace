set transaction isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='120s';
create function pg_temp.data_fingerprints() returns table(table_name text, row_count bigint, digest text) language plpgsql as $$
declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' order by tablename loop
  return query execute format('select %L::text,count(*),md5(coalesce(string_agg(h,'''' order by h),'''')) from (select md5(to_jsonb(t)::text) h from public.%I t) x',t.tablename,t.tablename);
 end loop;
end $$;
create temporary table before_data as select * from pg_temp.data_fingerprints();
create temporary table before_functions as select p.oid,p.proacl,p.proowner,p.prosecdef,p.provolatile,p.proconfig,md5(pg_get_functiondef(p.oid)) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app') and p.prokind='f';
create temporary table before_tables as select c.oid,c.relacl,c.relowner,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p');
create temporary table before_policies as select * from pg_policies where schemaname='public';
create temporary table before_triggers as select t.* from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public';
