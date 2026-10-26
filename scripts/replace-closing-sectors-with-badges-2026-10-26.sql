-- Apply in one transaction after a verified backup and the badge migration.
-- Uses app.closing_event and app.closing_actor transaction-local settings.
-- Refuses existing operational records. Terminal email history may remain only
-- after the separately authorized, audited legacy reset in this transaction.
do $$
declare e uuid:=current_setting('app.closing_event')::uuid; actor uuid:=current_setting('app.closing_actor')::uuid;
 p public.ceremony_plans; item record; sid uuid; result jsonb; previous jsonb;
begin
 if not app.ceremony_authorize(e,actor,true) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(e::text,1381));
 if not exists(select 1 from public.events where id=e and is_current and starts_on='2026-10-25' and ends_on='2026-10-27') then raise exception 'Unexpected event';end if;
 select * into p from public.ceremony_plans where event_id=e and kind='closing' for update;
 if p.id is null or p.layout_key is distinct from 'assisi-closing-2026' then raise exception 'Unexpected closing layout; inspect before replacing';end if;
 if exists(select 1 from public.ceremony_allocations where plan_id=p.id)
 or exists(select 1 from public.ceremony_nominees where plan_id=p.id)
 or exists(select 1 from public.ceremony_assignment_drafts where plan_id=p.id)
 or (exists(select 1 from public.ceremony_publication_emails where plan_id=p.id) and
  (current_setting('app.closing_reset_archive',true) is distinct from p.id::text
   or not exists(select 1 from public.audit_logs where entity_id=p.id and action='ceremony.closing_legacy_archived')
   or exists(select 1 from public.ceremony_publication_emails where plan_id=p.id and state in('queued','sending'))))
 or exists(select 1 from public.ceremony_map_versions where plan_id=p.id) then
  raise exception 'Closing operational records exist; replacement aborted, reconciliation required';
 end if;
 previous:=public.get_ceremony(e,actor,'closing');
 delete from public.ceremony_quotas where plan_id=p.id;
 delete from public.ceremony_sectors where plan_id=p.id;
 result:=public.save_ceremony(e,actor,'closing',p.revision,'configure',jsonb_build_object(
 'location','Basilica di San Francesco · Chiesa inferiore, Piazza inferiore e Prato superiore',
 'capacity',3500,'startsAt','2026-10-27T16:15','endsAt','2026-10-27T19:30','attendancePart','afternoon','state','validated'));
 if result->>'status' is distinct from 'saved' then raise exception 'Closing configuration failed: %',result;end if;
 p.revision:=(result->>'revision')::integer;
 update public.ceremony_plans set layout_key='assisi-closing-badges-2026' where id=p.id;
 for item in select * from (values
  ('CLOSING_ORANGE','Chiesa Basilica inferiore',200),
  ('CLOSING_PURPLE','Piazza inferiore',1100),
  ('CLOSING_GREEN','Prato Basilica superiore',2200)
 ) sectors(code,name,capacity) loop
  sid:=md5(p.id::text||':sector:'||item.code)::uuid;
  result:=public.save_ceremony(e,actor,'closing',p.revision,'sector',jsonb_build_object('id',sid,'name',item.name,'capacity',item.capacity));
  if result->>'status' is distinct from 'saved' then raise exception 'Sector failed: %',result;end if;
  p.revision:=(result->>'revision')::integer;
  update public.ceremony_sectors set numbered=false,layout_code=item.code,assignable_limit=item.capacity where id=sid;
  result:=public.save_ceremony(e,actor,'closing',p.revision,'quota',jsonb_build_object('id',md5(p.id::text||':quota:'||item.code)::uuid,'sectorId',sid,'category','Partecipanti','quantity',item.capacity));
  if result->>'status' is distinct from 'saved' then raise exception 'Quota failed: %',result;end if;
  p.revision:=(result->>'revision')::integer;
 end loop;
 insert into public.closing_ceremony_badge_settings(plan_id,enabled) values(p.id,false);
 if (select count(*)<>3 or sum(capacity)<>3500 or sum(assignable_limit)<>3500 or bool_or(numbered) from public.ceremony_sectors where plan_id=p.id)
 or (select sum(quantity)<>3500 from public.ceremony_quotas where plan_id=p.id) then raise exception 'Unexpected closing badge totals';end if;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(e,actor,'ceremony.closing_badge_sectors','ceremony_plans',p.id,jsonb_build_object('previous',previous,'capacity',3500,'delivery_enabled',false));
end $$;
