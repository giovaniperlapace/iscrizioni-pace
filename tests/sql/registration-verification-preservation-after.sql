do $$ begin
 if exists(select 1 from before_functions b left join pg_proc p on p.oid=b.oid left join pg_namespace n on n.oid=p.pronamespace where p.oid is null or (p.proacl,p.proowner,p.prosecdef,p.provolatile,p.proconfig) is distinct from (b.proacl,b.proowner,b.prosecdef,b.provolatile,b.proconfig) or (md5(pg_get_functiondef(p.oid))<>b.definition)) then raise exception 'Unexpected function/ACL change';end if;
 if exists(select 1 from before_tables b left join pg_class c on c.oid=b.oid where c.oid is null or (c.relacl,c.relowner,c.relrowsecurity,c.relforcerowsecurity) is distinct from (b.relacl,b.relowner,b.relrowsecurity,b.relforcerowsecurity)) then raise exception 'Table security changed';end if;
 if exists((select * from before_policies except select * from pg_policies where schemaname='public') union all (select * from pg_policies where schemaname='public' except select * from before_policies)) then raise exception 'Policy changed';end if;
 if exists(select 1 from before_triggers b left join pg_trigger t on t.oid=b.oid where t.oid is null or to_jsonb(t)<>to_jsonb(b)) then raise exception 'Trigger changed';end if;
 if exists((select * from before_data except select * from pg_temp.data_fingerprints()) union all (select * from pg_temp.data_fingerprints() except select * from before_data)) then raise exception 'Data changed';end if;
 assert (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app') and p.prokind='f')=(select count(*)+1 from before_functions),'Expected only one new function';
 assert not has_function_privilege('authenticated','public.reception_registration_check(uuid,uuid,text,text)','execute');
 assert not has_function_privilege('anon','public.reception_registration_check(uuid,uuid,text,text)','execute');
 assert has_function_privilege('service_role','public.reception_registration_check(uuid,uuid,text,text)','execute');
 raise notice 'Guard passed: % tables / % original rows / % function ACLs checked', (select count(*) from before_data),(select sum(row_count) from before_data),(select count(*) from before_functions);
end $$;
