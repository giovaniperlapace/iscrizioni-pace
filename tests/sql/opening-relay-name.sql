-- Uses the published assignments and pending F draft of the capacity fixture.
create temp table name_before as select revision from ceremony_plans where kind='opening';
create temp table sectors_before as select * from ceremony_sectors;
-- APPLY NAME MIGRATION HERE

do $$ declare t record; snapshot jsonb; p uuid; result jsonb; begin
 select id into p from ceremony_plans where kind='opening';
 assert (select revision from ceremony_plans where id=p)=(select revision+1 from name_before);
 assert (select name='F: Sala Maschiella in collegamento' and capacity=500 and assignable_limit=500 from ceremony_sectors where plan_id=p and layout_code='F');
 assert not exists(select 1 from sectors_before b full join ceremony_sectors s on s.id=b.id
  where s.id is null or b.id is null or (to_jsonb(s)-'name')<>(to_jsonb(b)-'name')
  or (s.layout_code<>'F' and s.name<>b.name));
 for t in select * from relay_preserved loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb) from public.%I x',t.table_name) into snapshot;
  assert snapshot=t.rows,t.table_name||' changed';
 end loop;
 result:=get_ceremony_draft_desk(f(1),f(31),'opening');
 assert exists(select 1 from jsonb_array_elements(result->'sectors') s where s->>'layoutCode'='F' and s->>'name'='F: Sala Maschiella in collegamento');
 assert exists(select 1 from jsonb_array_elements(result->'drafts') d where d->>'sector'='F: Sala Maschiella in collegamento');
 result:=get_ceremony_leader_tickets(f(1),f(36));
 assert exists(select 1 from jsonb_array_elements(result->'allocations') a where a->>'sector'='F: Sala Maschiella in collegamento');
end $$;
select 'PASS relay rename: stable code/IDs/capacity, published assignments and drafts preserved, updated manager/leader reads';
