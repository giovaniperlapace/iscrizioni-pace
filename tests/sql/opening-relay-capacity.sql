reset role;
-- Keep a real draft alongside the fixture's published group and child tickets.
do $$ begin
 assert manage_ceremony_drafts(f(1),f(31),(select id from ceremony_plans where kind='opening'),
  (select revision from ceremony_plans where kind='opening'),f(14001),'save',null,
  jsonb_build_object('action','group','sectorId',(select id from ceremony_sectors where name='F'),
   'quantity',10,'seatIds','[]'::jsonb,'subjects','[]'::jsonb,'groupId',f(7701)))->>'status'='saved';
end $$;
create temp table relay_preserved(table_name text primary key, rows jsonb);
do $$ declare t text; snapshot jsonb; begin
 foreach t in array array['ceremony_allocations','ceremony_nominees','ceremony_seat_claims',
  'ceremony_map_versions','ceremony_seat_identities','ceremony_assignment_drafts',
  'ceremony_draft_requests','ceremony_publication_emails'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb) from public.%I x',t) into snapshot;
  insert into relay_preserved values(t,snapshot);
 end loop;
end $$;
create temp table relay_before as select revision,
 (select (s->>'remaining')::integer from jsonb_array_elements(get_ceremony_draft_desk(f(1),f(31),'opening')->'sectors') s where s->>'name'='F') remaining
 from ceremony_plans where kind='opening';
-- APPLY CAPACITY MIGRATION HERE

do $$ declare t record; snapshot jsonb; p uuid; rev integer; result jsonb; begin
 select id,revision into p,rev from ceremony_plans where kind='opening';
 assert rev=(select revision+1 from relay_before);
 assert (select capacity=500 and assignable_limit=500 and not numbered from ceremony_sectors where plan_id=p and name='F');
 assert (select sum(capacity)=3640 from ceremony_sectors where plan_id=p);
 assert (select sum(quantity)=3350 from ceremony_quotas where plan_id=p);
 assert (select m.capacity=3640 and l.max_capacity=3640 from ceremony_plans cp join event_moments m on m.id=cp.moment_id join event_locations l on l.id=m.location_id where cp.id=p);
 assert (select (s->>'remaining')::integer from jsonb_array_elements(get_ceremony_draft_desk(f(1),f(31),'opening')->'sectors') s where s->>'name'='F')=(select remaining+100 from relay_before);
 for t in select * from relay_preserved loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb) from public.%I x',t.table_name) into snapshot;
  assert snapshot=t.rows,t.table_name||' changed';
 end loop;
 -- A stale open desk cannot save against the previous capacity revision.
 result:=manage_ceremony_drafts(f(1),f(31),p,rev-1,f(14002),'save',null,
  jsonb_build_object('action','group','sectorId',(select id from ceremony_sectors where name='F'),
   'quantity',1,'seatIds','[]'::jsonb,'subjects','[]'::jsonb,'groupId',f(7702)));
 assert result->>'status'='conflict',result;
 -- Fill the new capacity: 1 published + 10 draft + 489 new = 500.
 result:=manage_ceremony_drafts(f(1),f(31),p,rev,f(14003),'save',null,
  jsonb_build_object('action','group','sectorId',(select id from ceremony_sectors where name='F'),
   'quantity',489,'seatIds','[]'::jsonb,'subjects','[]'::jsonb,'groupId',f(7702)));
 assert result->>'status'='saved',result;
 result:=manage_ceremony_drafts(f(1),f(31),p,(select revision from ceremony_plans where id=p),f(14004),'save',null,
  jsonb_build_object('action','group','sectorId',(select id from ceremony_sectors where name='F'),
   'quantity',1,'seatIds','[]'::jsonb,'subjects','[]'::jsonb,'groupId',f(7702)));
 assert result->>'status'='capacity',result;
end $$;
select 'PASS relay capacity 500: +100 remaining, assignments/maps/drafts/email preserved, stale revision refused, 500 accepted and 501 refused';
