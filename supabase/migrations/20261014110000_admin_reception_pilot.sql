-- Admin-only rollout of imported reception features. Local diff; not applied remotely.
begin;
create function app.require_admin_reception_pilot(p_event uuid,p_actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'service_role' and current_user<>'postgres' and p_actor is distinct from auth.uid() then raise insufficient_privilege; end if;
 perform 1 from public.event_user_roles where user_id=p_actor and role='admin' and event_id is null for share;
 if not found then raise insufficient_privilege; end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise insufficient_privilege; end if;
end $$;
revoke all on function app.require_admin_reception_pilot(uuid,uuid) from public,anon,authenticated;
grant execute on function app.require_admin_reception_pilot(uuid,uuid) to service_role;

-- Preserve implementation, signatures, default arguments, grants and ceremony
-- projections. Gate the transactional bases so no wrapper bypasses the pilot.
do $$
declare target record; definition text; insertion integer;
begin
 for target in select * from (values
  ('public.reception_check_in(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)','p_event_id,p_actor_user_id'),
  ('public.reception_panel_check_in(text,uuid,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)','p_event_id,p_actor_user_id'),
  ('app.group_reception_operator(uuid,uuid)','p_event,p_actor'),
  ('public.group_reception_credential(uuid,uuid,uuid,text,text,text)','p_event,p_actor'),
  ('public.set_panel_reception_assignment(uuid,uuid,uuid,text,boolean)','p_event_id,auth.uid()')
 ) as functions(signature,arguments)
 loop
  definition:=pg_get_functiondef(target.signature::regprocedure);
  insertion:=strpos(lower(definition),'begin');
  if insertion=0 then raise exception 'Missing PL/pgSQL body for %',target.signature; end if;
  definition:=left(definition,insertion+4)||E'\n perform app.require_admin_reception_pilot('||target.arguments||');'||substr(definition,insertion+5);
  execute definition;
 end loop;
end $$;
create function public.admin_reception_pilot_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.event_user_roles where user_id=auth.uid() and role='admin' and event_id is null)
$$;
revoke all on function public.admin_reception_pilot_ready() from public,anon;
grant execute on function public.admin_reception_pilot_ready() to authenticated;
notify pgrst,'reload schema';
commit;
