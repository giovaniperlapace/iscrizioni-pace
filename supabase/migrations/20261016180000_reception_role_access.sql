-- Operational reception is available to global Admin and current-event
-- Accoglienza, including cumulative roles and future role assignments.
-- Keep the Admin gate for unrelated management and credential operations.
begin;
create function app.require_reception_operator(p_event uuid,p_actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'service_role' and current_user<>'postgres' and p_actor is distinct from auth.uid() then raise insufficient_privilege; end if;
 perform 1 from public.event_user_roles where user_id=p_actor and
  ((role='admin' and event_id is null) or (role='accoglienza' and event_id=p_event)) for share;
 if not found then raise insufficient_privilege; end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise insufficient_privilege; end if;
end $$;
revoke all on function app.require_reception_operator(uuid,uuid) from public,anon,authenticated;
grant execute on function app.require_reception_operator(uuid,uuid) to service_role;

-- Replace only the operational gates; preserve signatures, grants and bodies.
do $$
declare target record; definition text; old_gate text; new_gate text;
begin
 for target in select * from (values
  ('public.reception_check_in(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)','p_event_id,p_actor_user_id'),
  ('public.reception_panel_check_in(text,uuid,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)','p_event_id,p_actor_user_id'),
  ('app.group_reception_operator(uuid,uuid)','p_event,p_actor')
 ) as functions(signature,arguments)
 loop
  definition:=pg_get_functiondef(target.signature::regprocedure);
  old_gate:='perform app.require_admin_reception_pilot('||target.arguments||');';
  new_gate:='perform app.require_reception_operator('||target.arguments||');';
  if strpos(definition,old_gate)=0 then raise exception 'Unexpected reception gate: %',target.signature; end if;
  execute replace(definition,old_gate,new_gate);
 end loop;
 definition:=pg_get_functiondef('public.qr_label_queue(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text)'::regprocedure);
 old_gate:=E'perform 1 from public.event_user_roles where user_id=p_actor and role=''admin'' and event_id is null for share;\n if not found then raise insufficient_privilege; end if;';
 if strpos(definition,old_gate)=0 then raise exception 'Unexpected QR label gate'; end if;
 execute replace(definition,old_gate,'perform app.require_reception_operator(p_event,p_actor);');
end $$;

create function public.reception_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.event_user_roles r join public.events e on e.is_current
  where r.user_id=auth.uid() and ((r.role='admin' and r.event_id is null) or (r.role='accoglienza' and r.event_id=e.id)))
$$;
revoke all on function public.reception_ready() from public,anon;
grant execute on function public.reception_ready() to authenticated;
notify pgrst,'reload schema';
commit;
