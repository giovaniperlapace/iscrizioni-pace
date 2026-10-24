begin;
-- All Forum/event reception operators receive all current duties.
create or replace function public.set_reception_duties(p_event uuid,p_actor uuid,p_user uuid,p_keys text[],p_expected text[] default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare old_keys text[]; k text;
begin
 perform 1 from public.event_user_roles where user_id=p_actor and ((role='admin' and event_id is null) or (role='manager' and event_id=p_event)) for share;
 if not found then raise insufficient_privilege; end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise insufficient_privilege; end if;
 perform 1 from public.profiles where id=p_user for update;
 if not found then raise invalid_parameter_value; end if;
 old_keys:=app.reception_duty_keys(p_event,p_user);
 if p_expected is not null and not (old_keys @> p_expected and old_keys <@ p_expected) then raise exception 'duties changed' using errcode='40001'; end if;
 if p_keys is null or array_position(p_keys,null) is not null or cardinality(p_keys)>1000 then raise invalid_parameter_value; end if;
 foreach k in array p_keys loop
  if not exists(select 1 from jsonb_array_elements(app.reception_duty_catalog(p_event)) c where c->>'key'=k) then raise invalid_parameter_value; end if;
 end loop;
 -- Any nonempty grant includes the entire current catalogue. Empty means revoke.
 if cardinality(p_keys)>0 then
  select array_agg(c->>'key' order by c->>'key') into p_keys
  from jsonb_array_elements(app.reception_duty_catalog(p_event)) c;
 end if;
 if p_user=p_actor and not(old_keys <@ p_keys) then raise insufficient_privilege using message='self removal forbidden'; end if;
 -- New grants are additive; editing sends the previously displayed set.
 if p_expected is null then p_keys:=array(select distinct unnest(p_keys||old_keys)); end if;
 delete from public.panel_reception_assignments where event_id=p_event and user_id=p_user and duty='panel_entry' and not(panel_id::text=any(p_keys));
 delete from public.ceremony_reception_assignments where event_id=p_event and user_id=p_user and not(kind=any(p_keys));
 foreach k in array p_keys loop
  if k in ('opening','closing') then
   insert into public.ceremony_reception_assignments values(p_event,p_user,k,p_actor) on conflict do nothing;
  else
   insert into public.panel_reception_assignments(event_id,user_id,panel_id,duty,created_by) values(p_event,p_user,k::uuid,'panel_entry',p_actor) on conflict do nothing;
  end if;
 end loop;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(p_event,p_actor,'reception.duties_updated','profiles',p_user,jsonb_build_object('before',old_keys,'after',p_keys));
 return true;
end $$;

-- Expand existing operators only in the current event, preserving original grants.
-- Retain the original assigning actor as provenance; audit identifies the migration.
do $$
declare operator record; old_keys text[]; new_keys text[];
begin
 for operator in
  select distinct on (event_id,user_id) event_id,user_id,created_by from (
   select a.event_id,a.user_id,a.created_by from public.panel_reception_assignments a
    join public.events e on e.id=a.event_id and e.is_current where a.duty='panel_entry'
   union all
   select a.event_id,a.user_id,a.created_by from public.ceremony_reception_assignments a
    join public.events e on e.id=a.event_id and e.is_current
  ) operators order by event_id,user_id,created_by
 loop
  old_keys:=app.reception_duty_keys(operator.event_id,operator.user_id);
  insert into public.panel_reception_assignments(event_id,user_id,panel_id,duty,created_by)
   select operator.event_id,operator.user_id,m.id,'panel_entry',operator.created_by
   from public.event_moments m where m.event_id=operator.event_id and m.moment_type='panel'
   on conflict do nothing;
  insert into public.ceremony_reception_assignments(event_id,user_id,kind,created_by)
   select operator.event_id,operator.user_id,k,operator.created_by from unnest(array['opening','closing']) k
   on conflict do nothing;
  new_keys:=app.reception_duty_keys(operator.event_id,operator.user_id);
  if old_keys is distinct from new_keys then
   insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
   values(operator.event_id,null,'reception.duties_completed','profiles',operator.user_id,
    jsonb_build_object('before',old_keys,'after',new_keys,'migration','20261023130000'));
  end if;
 end loop;
end $$;

commit;
