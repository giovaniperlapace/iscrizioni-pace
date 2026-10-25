begin;
-- Only advance opening selection. Preserve the current catalogue and its ACL.
do $$
declare definition text;
begin
 select pg_get_functiondef('app.reception_duty_catalog(uuid)'::regprocedure) into definition;
 if position('WHEN (key = ''opening''::text) THEN ''14:00:00''::time without time zone' in definition)>0 then
  definition:=replace(definition,'WHEN (key = ''opening''::text) THEN ''14:00:00''::time without time zone','WHEN (key = ''opening''::text) THEN ''13:30:00''::time without time zone');
 elsif position('when key=''opening'' then time ''14:00''' in definition)>0 then
  definition:=replace(definition,'when key=''opening'' then time ''14:00''','when key=''opening'' then time ''13:30''');
 else
  raise exception 'Unexpected opening availability definition';
 end if;
 execute definition;
end $$;
commit;
