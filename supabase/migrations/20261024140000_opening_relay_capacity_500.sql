-- Maintenance of the existing Assisi opening ceremony only. Historical layout
-- initialization and numbered seat maps remain unchanged.
do $$
declare
 p public.ceremony_plans;
 s public.ceremony_sectors;
 m public.event_moments;
 q public.ceremony_quotas;
 prior_setting text;
begin
 for p in select cp.* from public.ceremony_plans cp
  join public.events e on e.id=cp.event_id
  where e.is_current and cp.kind='opening' and cp.layout_key='assisi-opening-2026'
  order by cp.id
 loop
  perform pg_advisory_xact_lock(hashtextextended(p.event_id::text,1381));
  select * into p from public.ceremony_plans where id=p.id for update;
  select * into s from public.ceremony_sectors where plan_id=p.id and layout_code='F' for update;
  select * into m from public.event_moments where id=p.moment_id for update;
  if s.id is null or s.name<>'F' or s.numbered
   or (select count(*) from public.ceremony_quotas where sector_id=s.id)<>1 then
   raise exception 'Unexpected opening relay configuration';
  end if;
  select * into q from public.ceremony_quotas where sector_id=s.id for update;
  -- Exact completed state is a no-op, including revision and audit.
  if s.capacity=500 and s.assignable_limit=500 and q.quantity=500
   and m.capacity=3640 then continue;end if;
  if s.capacity is distinct from 400 or s.assignable_limit is distinct from 400
   or q.quantity<>400 or q.category<>'Partecipanti' or m.capacity is distinct from 3540
   or (select sum(capacity) from public.ceremony_sectors where plan_id=p.id)<>3540
   or (select sum(quantity) from public.ceremony_quotas where plan_id=p.id)<>3250
   or not exists(select 1 from public.event_locations where id=m.location_id and max_capacity=3540)
   or exists(select 1 from public.event_moments where location_id=m.location_id and id<>m.id) then
   raise exception 'Unexpected opening relay capacity; maintenance aborted';
  end if;
  prior_setting:=current_setting('app.ceremony_write',true);
  perform set_config('app.ceremony_write','on',true);
  update public.event_locations set max_capacity=3640 where id=m.location_id;
  update public.event_moments set capacity=3640 where id=m.id;
  perform set_config('app.ceremony_write',coalesce(prior_setting,''),true);
  update public.ceremony_sectors set capacity=500,assignable_limit=500 where id=s.id;
  update public.ceremony_quotas set quantity=500 where id=q.id;
  update public.ceremony_plans set revision=revision+1 where id=p.id;
  insert into public.audit_logs(event_id,action,entity_table,entity_id,metadata)
   values(p.event_id,'ceremony.relay_capacity_updated','ceremony_sectors',s.id,
    jsonb_build_object('migration','20261024140000','previous_capacity',400,'capacity',500));
 end loop;
end $$;
