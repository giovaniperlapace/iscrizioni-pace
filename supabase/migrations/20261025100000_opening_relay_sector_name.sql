-- Keep F as the layout code; only its user-facing name changes.
-- Deploy the layout-code-based sector map before applying this maintenance.
do $$
declare p public.ceremony_plans; s public.ceremony_sectors;
begin
 for p in select cp.* from public.ceremony_plans cp join public.events e on e.id=cp.event_id
  where e.is_current and cp.kind='opening' and cp.layout_key='assisi-opening-2026' order by cp.id
 loop
  perform pg_advisory_xact_lock(hashtextextended(p.event_id::text,1381));
  select * into p from public.ceremony_plans where id=p.id for update;
  select * into s from public.ceremony_sectors where plan_id=p.id and layout_code='F' for update;
  if s.id is null or s.numbered or s.capacity is distinct from 500 or s.assignable_limit is distinct from 500 then
   raise exception 'Unexpected opening relay configuration; rename aborted';
  end if;
  if s.name='F: Sala Maschiella in collegamento' then continue;end if;
  if s.name<>'F' then raise exception 'Unexpected opening relay name; rename aborted';end if;
  update public.ceremony_sectors set name='F: Sala Maschiella in collegamento' where id=s.id;
  update public.ceremony_plans set revision=revision+1 where id=p.id;
  insert into public.audit_logs(event_id,action,entity_table,entity_id,metadata)
   values(p.event_id,'ceremony.relay_sector_renamed','ceremony_sectors',s.id,
    jsonb_build_object('migration','20261025100000','previous_name',s.name,'name','F: Sala Maschiella in collegamento'));
 end loop;
end $$;
