-- Operational configuration through the existing Admin RPCs; no schema change.
-- Run inside one transaction after a verified backup. Set transaction-local
-- app.closing_event and app.closing_actor to the authorized event/Admin UUIDs.
do $$
declare
 e uuid := current_setting('app.closing_event')::uuid;
 actor uuid := current_setting('app.closing_actor')::uuid;
 p public.ceremony_plans;
 item record;
 sid uuid;
 result jsonb;
 config jsonb := jsonb_build_object(
  'location','Basilica di San Francesco · Piazza inferiore e superiore, Assisi',
  'capacity',4070,'startsAt','2026-10-27T16:15','endsAt','2026-10-27T19:30',
  'attendancePart','afternoon','state','validated');
begin
 if not app.ceremony_authorize(e,actor,true) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(e::text,1381));
 if not exists(select 1 from public.events where id=e and is_current
  and starts_on='2026-10-25' and ends_on='2026-10-27') then
  raise exception 'Unexpected event; closing configuration aborted';
 end if;
 -- Fail closed on any existing layout, including a retry after success.
 if exists(select 1 from public.ceremony_plans where event_id=e and kind='closing') then
  raise exception 'Closing ceremony already configured; inspect before any change';
 end if;
 result := public.save_ceremony(e,actor,'closing',-1,'configure',config);
 if result->>'status' is distinct from 'saved' then raise exception 'Closing configuration failed: %',result;end if;
 select * into strict p from public.ceremony_plans where event_id=e and kind='closing' for update;
 update public.ceremony_plans set layout_key='assisi-closing-2026' where id=p.id;
 for item in select * from (values
  ('A','A · Protocollo / VIP',350,0),
  ('B','B',350,350),('C','C',350,350),('D','D',350,350),('E','E',470,470),
  ('ESTERNO','Esterno basilica superiore',1200,1200),
  ('PRATO','Prato in piedi',1000,1000)
 ) as sectors(code,name,capacity,assignable) loop
  sid := md5(p.id::text||':sector:'||item.code)::uuid;
  result := public.save_ceremony(e,actor,'closing',p.revision,'sector',
   jsonb_build_object('id',sid,'name',item.name,'capacity',item.capacity));
  if result->>'status' is distinct from 'saved' then raise exception 'Sector configuration failed: %',result;end if;
  p.revision := (result->>'revision')::integer;
  -- Same metadata used by the opening layout; quantities remain under RPC guards.
  update public.ceremony_sectors set numbered=false,layout_code=item.code,
   assignable_limit=item.assignable where id=sid;
  result := public.save_ceremony(e,actor,'closing',p.revision,'quota',
   jsonb_build_object('id',md5(p.id::text||':quota:'||item.code)::uuid,
    'sectorId',sid,'category','Partecipanti','quantity',item.assignable));
  if result->>'status' is distinct from 'saved' then raise exception 'Quota configuration failed: %',result;end if;
  p.revision := (result->>'revision')::integer;
 end loop;
 if (select count(*)<>7 or sum(capacity)<>4070 or sum(assignable_limit)<>3720
  from public.ceremony_sectors where plan_id=p.id)
  or (select sum(quantity)<>3720 from public.ceremony_quotas where plan_id=p.id)
  or exists(select 1 from public.ceremony_allocations where plan_id=p.id)
  or exists(select 1 from public.ceremony_assignment_drafts where plan_id=p.id) then
  raise exception 'Unexpected closing totals; transaction aborted';
 end if;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(e,actor,'ceremony.closing_layout_configured','ceremony_plans',p.id,
  jsonb_build_object('source','User request 2026-10-26 and supplied plan',
   'capacity',4070,'seated',3070,'standing',1000,'protocol',350,'assignable',3720,
   'starts_at_rome','2026-10-27T16:15','ends_at_rome','2026-10-27T19:30'));
end $$;
